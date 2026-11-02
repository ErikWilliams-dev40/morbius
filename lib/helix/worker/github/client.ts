/**
 * Read-only GitHub status client adapted from the supplied Helix control plane.
 * Only approved repository reads and static GraphQL queries are used by Mobius.
 * Runtime credentials and upstream error bodies are never exposed or logged.
 */

export const ORG = "House-of-Helix-CMD";
export const TEMPLATE_REPO = "helix-project-template";
export const PROJECT_TOPIC = "helix-project";

/** Repositories that are Helix infrastructure, never executive projects. */
export const EXCLUDED_REPOS = new Set([
  "helix-engineering",
  "helix-control-plane",
  "helix-project-template",
]);

/**
 * Bot and app logins that must never satisfy a human-approval requirement.
 *
 * Lives here rather than beside either caller: both project derivation and
 * release decisions need it, and neither should import the other.
 */
export function isProbablyBot(login: string | null | undefined): boolean {
  if (!login) return true;
  return /\[bot\]$/i.test(login) || /^(github-actions|dependabot|renovate|copilot)/i.test(login);
}

const API_ROOT = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = "helix-mobius-status";

export type GitHubFailureKind =
  "unauthorized" | "forbidden" | "not_found" | "conflict" | "timeout" | "unavailable";

/**
 * Carries a failure kind and an HTTP status, never upstream response text.
 * Upstream bodies are discarded at the point of failure so nothing unexpected
 * can be reflected into a response or a log line.
 */
export class GitHubError extends Error {
  readonly kind: GitHubFailureKind;
  readonly status: number;

  constructor(kind: GitHubFailureKind, status = 0) {
    super(`github_${kind}`);
    this.name = "GitHubError";
    this.kind = kind;
    this.status = status;
  }
}

function classify(status: number): GitHubFailureKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409 || status === 422) return "conflict";
  return "unavailable";
}

interface GraphQLError {
  type?: string;
  message?: string;
}

/**
 * Classify a GraphQL failure that returned no usable data. A genuinely bad
 * credential arrives as HTTP 401 and is handled before the body is read, but an
 * insufficient permission or scope can also appear inside the errors array, so
 * distinguish that from a generic outage instead of defaulting to "unauthorized".
 */
function classifyGraphQLErrors(errors: GraphQLError[]): GitHubFailureKind {
  const messages = errors.map((e) => e?.message ?? "").join(" ");
  if (/bad credential/i.test(messages)) return "unauthorized";
  if (
    errors.some((e) => e?.type === "FORBIDDEN") ||
    /not accessible|insufficient|scope/i.test(messages)
  ) {
    return "forbidden";
  }
  return "unavailable";
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Treat these statuses as a normal result rather than an error. */
  allowStatuses?: number[];
  timeoutMs?: number;
}

export interface GitHubResponse<T> {
  status: number;
  data: T;
}

/**
 * Minimal read-only adapter; GitHub mutations stay in the Helix control plane.
 */
export class GitHubClient {
  readonly #token: string;
  readonly #timeoutMs: number;

  constructor(token: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.#token = token;
    this.#timeoutMs = timeoutMs;
  }

  /** REST call. Path is appended to the API root; never accepts a full URL. */
  async rest<T = unknown>(path: string, options: RequestOptions = {}): Promise<GitHubResponse<T>> {
    const { method = "GET", body, allowStatuses = [], timeoutMs } = options;

    if (method !== "GET" || !path.startsWith("/repos/") || path.includes(".."))
      throw new GitHubError("forbidden");
    const response = await this.#fetch(
      `${API_ROOT}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${this.#token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": USER_AGENT,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      timeoutMs,
    );

    if (!response.ok && !allowStatuses.includes(response.status)) {
      throw new GitHubError(classify(response.status), response.status);
    }

    if (response.status === 204) {
      return { status: response.status, data: undefined as T };
    }

    let data: T;
    try {
      data = (await response.json()) as T;
    } catch {
      data = undefined as T;
    }
    return { status: response.status, data };
  }

  /** GraphQL call. Used where it materially reduces round trips. */
  async graphql<T = unknown>(query: string, variables: Record<string, unknown>): Promise<T> {
    if (!query.trimStart().startsWith("query ")) throw new GitHubError("forbidden");
    const response = await this.#fetch(`${API_ROOT}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.#token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 401) throw new GitHubError("unauthorized", 401);
    if (response.status === 403) throw new GitHubError("forbidden", 403);
    if (!response.ok) throw new GitHubError("unavailable", response.status);

    let envelope: { data?: T; errors?: GraphQLError[] };
    try {
      envelope = (await response.json()) as { data?: T; errors?: GraphQLError[] };
    } catch {
      throw new GitHubError("unavailable", response.status);
    }

    // GraphQL surfaces field-level permission problems as HTTP 200 with PARTIAL
    // `data` alongside an `errors` array: GitHub nulls only the forbidden field
    // and returns everything else. The live case here is check-run data, which
    // fine-grained tokens on this org cannot be granted — every project comes
    // back intact except its per-check contexts. Rejecting that whole response
    // as a bad credential is wrong and blanks the dashboard, so when usable data
    // is present we return it and let the null field degrade downstream. Only a
    // response with NO data is a hard failure, classified by the error type
    // rather than assumed to be an authorization problem.
    if (envelope.data) return envelope.data;

    if (envelope.errors?.length) throw new GitHubError(classifyGraphQLErrors(envelope.errors), 200);
    throw new GitHubError("unavailable", 200);
  }

  async #fetch(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.#timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal, redirect: "error" });
    } catch (cause) {
      // `cause` is deliberately not inspected beyond abort detection and never logged.
      if (cause instanceof Error && cause.name === "AbortError") {
        throw new GitHubError("timeout");
      }
      throw new GitHubError("unavailable");
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Credential seam. Today: a Worker secret. Later: a GitHub App installation
 * token. Callers never see which.
 */
export interface CredentialSource {
  getClient(): GitHubClient | null;
}

export function credentialFromEnv(token: string | undefined): CredentialSource {
  const trimmed = token?.trim();
  return {
    getClient: () => (trimmed ? new GitHubClient(trimmed) : null),
  };
}
