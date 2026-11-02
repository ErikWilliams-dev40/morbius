import { companies } from "./domain.ts";
import { authenticate, readAccessConfig, parseEmailAllowlist } from "./helix/worker/auth.ts";

export interface AccessEnv {
  MOBIUS_AUTH_MODE?: string;
  MOBIUS_REVIEW_OWNER_ID?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  PROJECT_CREATOR_EMAILS?: string;
  APPROVER_EMAILS?: string;
  MOBIUS_BUILDER_EMAILS?: string;
  MOBIUS_ADMIN_EMAILS?: string;
  /** Explicit per-person company assignments. Never returned to the client. */
  MOBIUS_MEMBER_SCOPES?: string;
}

export type Capabilities = {
  canRequest: boolean;
  canBuild: boolean;
  canApprovePrototype: boolean;
  canManage: boolean;
};
export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  mode: "helix" | "sites_owner";
  companies: string[];
  capabilities: Capabilities;
};

export class AccessError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function parseAssignments(raw?: string): Record<string, string[]> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: Record<string, string[]> = Object.create(null);
    for (const [key, list] of Object.entries(value)) {
      if (!Array.isArray(list) || !list.every((v) => typeof v === "string")) return {};
      result[key.trim().toLowerCase()] = [...new Set(list)];
    }
    return result;
  } catch {
    return {};
  }
}

export async function identifyUser(request: Request, env: AccessEnv): Promise<User> {
  // A private Sites review is a separately configured deployment, never a fallback
  // from failed Helix authentication. Its owner must be assigned before first use.
  if (env.MOBIUS_AUTH_MODE === "sites_owner") {
    if (env.ACCESS_TEAM_DOMAIN || env.ACCESS_AUD || !env.MOBIUS_REVIEW_OWNER_ID)
      throw new AccessError(503, "The private review identity configuration needs attention.");
    const id = request.headers.get("oai-authenticated-user-id");
    const email = request.headers.get("oai-authenticated-user-email");
    if (!id || !email) throw new AccessError(401, "Sign in to your private review workspace.");
    if (id !== env.MOBIUS_REVIEW_OWNER_ID)
      throw new AccessError(403, "Your account has not been granted access to this workspace.");
    return {
      id,
      email,
      name: email,
      role: "Private review owner",
      mode: "sites_owner",
      companies: companies.map((c) => c.id),
      capabilities: {
        canRequest: true,
        canBuild: true,
        canApprovePrototype: true,
        canManage: true,
      },
    };
  }
  if (env.MOBIUS_AUTH_MODE !== "helix")
    throw new AccessError(503, "Ask your technical admin to configure Mobius sign-in.");
  const result = await authenticate(request, readAccessConfig(env));
  if (!result.ok)
    throw new AccessError(
      result.reason === "not_configured" ? 503 : 401,
      result.reason === "not_configured"
        ? "Helix sign-in is not configured."
        : "Sign in through Helix to continue.",
    );
  const email = result.identity.email;
  const assigned = (parseAssignments(env.MOBIUS_MEMBER_SCOPES)[email] || []).filter((id) =>
    companies.some((c) => c.id === id),
  );
  if (!assigned.length)
    throw new AccessError(403, "No companies have been assigned to your Mobius account.");
  const allowed = (raw?: string) => parseEmailAllowlist(raw).has(email);
  const canRequest = allowed(env.PROJECT_CREATOR_EMAILS);
  return {
    id: email,
    email,
    name: email,
    role: "Helix member",
    mode: "helix",
    companies: assigned,
    capabilities: {
      canRequest,
      canBuild: canRequest || allowed(env.MOBIUS_BUILDER_EMAILS),
      canApprovePrototype: allowed(env.APPROVER_EMAILS),
      canManage: allowed(env.MOBIUS_ADMIN_EMAILS),
    },
  };
}

export function requireCompany(user: User, company: string) {
  if (!user.companies.includes(company)) {
    console.warn(JSON.stringify({ event: "mobius_company_access_denied", status: 404 }));
    throw new AccessError(404, "Project not found.");
  }
}
export function requireCapability(user: User, capability: keyof Capabilities) {
  if (!user.capabilities[capability])
    throw new AccessError(403, "Your account does not have permission for this action.");
}
