import { parseAssignments, type User } from "./access.ts";
import { GitHubClient, EXCLUDED_REPOS, ORG } from "./helix/worker/github/client.ts";
import { listProjects } from "./helix/worker/github/projects.ts";
import type { Project, ProjectDiagnostics } from "./helix/shared/projects.ts";

export interface HelixEnv {
  HELIX_GITHUB_READ_TOKEN?: string;
  MOBIUS_GITHUB_APPROVED?: string;
  /**
   * Narrow publication credential: issue comments on assigned repositories
   * only. Distinct from the read token so a leak cannot widen write scope.
   */
  HELIX_GITHUB_WRITE_TOKEN?: string;
  /** A technical admin records approval of the publication integration here. */
  MOBIUS_GITHUB_WRITE_APPROVED?: string;
  /** Company ID -> assigned repository slugs. No inferred assignments. */
  MOBIUS_COMPANY_REPOS?: string;
}
export type DevelopmentState = {
  connection: "not_configured" | "mapping_required" | "connected";
  generatedAt: string | null;
  dashboardUrl: string;
  projects: Project[];
  diagnostics: ProjectDiagnostics[];
};
export const HELIX_DASHBOARD = "https://helix.helixcmd.com";
export function repositoriesFor(env: HelixEnv, companyIds: string[]) {
  const assignments = parseAssignments(env.MOBIUS_COMPANY_REPOS);
  return [...new Set(companyIds.flatMap((id) => assignments[id] || []))].filter(
    (s) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(s) && !EXCLUDED_REPOS.has(s),
  );
}
export function githubConfigured(env: HelixEnv) {
  return !!env.HELIX_GITHUB_READ_TOKEN && env.MOBIUS_GITHUB_APPROVED === "true";
}
/** Decision-record publication is a separate, explicitly approved integration. */
export function githubPublicationConfigured(env: HelixEnv) {
  return !!env.HELIX_GITHUB_WRITE_TOKEN && env.MOBIUS_GITHUB_WRITE_APPROVED === "true";
}
export async function developmentState(env: HelixEnv, user: User): Promise<DevelopmentState> {
  const base = { dashboardUrl: HELIX_DASHBOARD, generatedAt: null, projects: [], diagnostics: [] };
  if (!githubConfigured(env)) return { ...base, connection: "not_configured" };
  const assigned = repositoriesFor(env, user.companies);
  if (!assigned.length) return { ...base, connection: "mapping_required" };
  const result = await listProjects(new GitHubClient(env.HELIX_GITHUB_READ_TOKEN!), assigned);
  return { ...base, ...result, connection: "connected", generatedAt: new Date().toISOString() };
}

/** Strictly parse a GitHub issue URL into its repository slug and number. */
export function issueRefFromUrl(issueUrl: string): { repo: string; number: number } | null {
  let url: URL;
  try {
    url = new URL(issueUrl);
  } catch {
    return null;
  }
  if (url.origin !== "https://github.com" || url.username || url.password || url.search || url.hash)
    return null;
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/issues\/([1-9][0-9]*)$/);
  if (!match || match[1] !== ORG) return null;
  return { repo: match[2], number: Number(match[3]) };
}

/** A real, assigned GitHub issue is required before AI work enters the queue. */
export async function verifyIssue(env: HelixEnv, company: string, issueUrl: string) {
  if (!githubConfigured(env)) return false;
  const ref = issueRefFromUrl(issueUrl);
  if (!ref || !repositoriesFor(env, [company]).includes(ref.repo)) return false;
  const client = new GitHubClient(env.HELIX_GITHUB_READ_TOKEN!);
  const { data, status } = await client.rest<{
    html_url?: string;
    state?: string;
    pull_request?: unknown;
  }>(`/repos/${ORG}/${ref.repo}/issues/${ref.number}`, { allowStatuses: [404] });
  return (
    status === 200 && data?.html_url === issueUrl && data.state === "open" && !data.pull_request
  );
}
