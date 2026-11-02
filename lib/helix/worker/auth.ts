/**
 * Cloudflare Access authentication and Helix authorization.
 *
 * Two distinct questions, answered separately:
 *   1. Authentication — who is this? Proven by a verified Access JWT.
 *   2. Authorization  — may they create projects? Answered by an allowlist.
 *
 * SECURITY: the `Cf-Access-Authenticated-User-Email` header is NEVER trusted.
 * Without Access in front of the Worker, anyone can set that header on a direct
 * request to the workers.dev hostname. Only the `Cf-Access-Jwt-Assertion` token
 * is trusted, and only after its signature, issuer, audience and validity window
 * have been checked against the team's published keys.
 *
 * Fails closed: if Access configuration is absent, no request is authenticated
 * and every mutation is refused.
 */

export interface AccessConfig {
  /** e.g. "yourteam.cloudflareaccess.com" */
  teamDomain: string;
  /** Application Audience (AUD) tag from the Access application. */
  aud: string;
}

export interface Identity {
  email: string;
}

export type AuthResult =
  | { ok: true; identity: Identity }
  | { ok: false; reason: "not_configured" | "missing" | "invalid" };

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
}

/** Cached team keys. Access rotates them, so this is short-lived. */
interface KeyCacheEntry {
  keys: Jwk[];
  fetchedAt: number;
}
const KEY_TTL_MS = 10 * 60 * 1000;
const keyCache = new Map<string, KeyCacheEntry>();

export function readAccessConfig(env: {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}): AccessConfig | null {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim();
  const aud = env.ACCESS_AUD?.trim();
  if (
    !teamDomain ||
    !aud ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(teamDomain)
  )
    return null;
  return { teamDomain, aud };
}

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(segment: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function fetchKeys(teamDomain: string, now: number): Promise<Jwk[]> {
  const cached = keyCache.get(teamDomain);
  if (cached && now >= cached.fetchedAt && now - cached.fetchedAt < KEY_TTL_MS) return cached.keys;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      redirect: "error",
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { keys?: Jwk[] };
    const keys = Array.isArray(body.keys)
      ? body.keys.filter(
          (key) =>
            key &&
            key.kty === "RSA" &&
            typeof key.kid === "string" &&
            typeof key.n === "string" &&
            typeof key.e === "string" &&
            (!key.alg || key.alg === "RS256"),
        )
      : [];
    keyCache.set(teamDomain, { keys, fetchedAt: now });
    return keys;
  } catch {
    // A failed refresh never extends the lifetime of stale keys.
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verify a Cloudflare Access JWT.
 *
 * Checks, in order: structure, matching key by `kid`, RS256 signature,
 * issuer, audience, and the validity window. Any failure is `invalid`.
 */
export async function verifyAccessJwt(
  token: string,
  config: AccessConfig,
  now: number = Date.now(),
): Promise<Identity | null> {
  if (token.length > 16384) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJson(headerPart);
  const payload = decodeJson(payloadPart);
  if (!header || !payload) return null;
  if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

  const keys = await fetchKeys(config.teamDomain, now);
  const jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) return null;

  let verified = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlToBytes(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
  } catch {
    return null;
  }
  if (!verified) return null;

  // Issuer must be the configured team, not merely any Access team.
  if (payload.iss !== `https://${config.teamDomain}`) return null;

  // `aud` may be a string or an array; the configured tag must be present.
  const aud = payload.aud;
  const audMatches = Array.isArray(aud) ? aud.includes(config.aud) : aud === config.aud;
  if (!audMatches) return null;

  const seconds = Math.floor(now / 1000);
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || seconds >= payload.exp)
    return null;
  if (
    payload.nbf !== undefined &&
    (typeof payload.nbf !== "number" || !Number.isFinite(payload.nbf) || seconds < payload.nbf)
  )
    return null;

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email) return null;

  return { email };
}

/** Authenticate a request. Never falls back to a header-only identity. */
export async function authenticate(
  request: Request,
  config: AccessConfig | null,
  now: number = Date.now(),
): Promise<AuthResult> {
  if (!config) return { ok: false, reason: "not_configured" };

  const token =
    request.headers.get("Cf-Access-Jwt-Assertion") ??
    // Access also sets this cookie; accepted only because it carries the same signed JWT.
    readCookie(request.headers.get("Cookie"), "CF_Authorization");

  if (!token) return { ok: false, reason: "missing" };

  const identity = await verifyAccessJwt(token, config, now);
  return identity ? { ok: true, identity } : { ok: false, reason: "invalid" };
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }
  return null;
}

/**
 * Authorization. Each power has its own comma-separated allowlist, held as a
 * Worker secret. A list is never sent to the client — only the boolean outcome
 * for the current identity.
 *
 * Creating a project and approving a release are separate powers on purpose.
 * A project manager may need the first without ever holding the second.
 */
export function parseEmailAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** `PROJECT_CREATOR_EMAILS`. */
export const parseCreatorAllowlist = parseEmailAllowlist;

/** `APPROVER_EMAILS`. Who may record a business decision on a release. */
export const parseApproverAllowlist = parseEmailAllowlist;

/** Unconfigured means nobody, not everybody. */
function isAllowed(identity: Identity | null, allowlist: Set<string>): boolean {
  if (!identity) return false;
  if (allowlist.size === 0) return false;
  return allowlist.has(identity.email.toLowerCase());
}

export function canCreateProjects(identity: Identity | null, allowlist: Set<string>): boolean {
  return isAllowed(identity, allowlist);
}

export function canApproveReleases(identity: Identity | null, allowlist: Set<string>): boolean {
  return isAllowed(identity, allowlist);
}
