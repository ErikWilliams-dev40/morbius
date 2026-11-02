/**
 * Project discovery and status derivation.
 *
 * One GraphQL query fetches every `helix-project` repository with its open PRs,
 * review decision, check rollup and labels — avoiding an N+1 REST walk.
 *
 * Every derivation here **fails closed**: a condition is true only when GitHub
 * positively says so. Missing, pending, ambiguous or unparseable evidence is
 * false, never "probably fine".
 */

import type { Project, ProjectDiagnostics, ProjectStatus } from "../../shared/projects.ts";
import { parsePreviewMarker, slugToDisplayName, validatePreviewUrl } from "../naming.ts";
import { EXCLUDED_REPOS, GitHubClient, isProbablyBot, ORG } from "./client.ts";
import { readJsonFile } from "./contents.ts";
// Read-only label constant from Helix; release mutation code is not imported.
const DECISION_LABELS = { changesRequested: { name: "changes-requested" } };

const PROJECTS_QUERY = `
query HelixProjects($query: String!, $limit: Int!) {
  search(query: $query, type: REPOSITORY, first: $limit) {
    nodes {
      ... on Repository {
        name
        url
        isArchived
        pushedAt
        updatedAt
        defaultBranchRef { name }
        openIssues: issues(states: OPEN, first: 50, labels: ["blocked"]) {
          totalCount
        }
        pullRequests(states: OPEN, first: 20, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            number
            title
            url
            body
            isDraft
            updatedAt
            reviewDecision
            headRefOid
            author { login }
            labels(first: 20) { nodes { name } }
            latestReviews(first: 20) {
              nodes {
                state
                author { login }
                authorAssociation
              }
            }
            commits(last: 1) {
              nodes {
                commit {
                  statusCheckRollup {
                    state
                    contexts(first: 50) {
                      nodes {
                        __typename
                        ... on CheckRun { name status conclusion }
                        ... on StatusContext { context state }
                      }
                    }
                  }
                  deployments(last: 5) {
                    nodes {
                      environment
                      state
                      latestStatus { environmentUrl }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

interface RawLabel {
  name: string;
}
interface RawReview {
  state: string;
  author: { login: string } | null;
  authorAssociation: string;
}
interface RawCheckNode {
  __typename: string;
  name?: string | null;
  status?: string | null;
  conclusion?: string | null;
  context?: string | null;
  state?: string | null;
}
interface RawDeployment {
  environment: string | null;
  state: string | null;
  latestStatus: { environmentUrl: string | null } | null;
}
interface RawPullRequest {
  number: number;
  title: string;
  url: string;
  body: string | null;
  isDraft: boolean;
  updatedAt: string;
  reviewDecision: string | null;
  headRefOid: string;
  author: { login: string } | null;
  labels: { nodes: RawLabel[] };
  latestReviews: { nodes: RawReview[] };
  commits: {
    nodes: Array<{
      commit: {
        statusCheckRollup: {
          state: string | null;
          // Elements come back `null` when the token may read the rollup but not
          // the individual check contexts (fine-grained tokens on this org cannot
          // be granted Checks). The aggregate `state` above remains readable.
          contexts: { nodes: Array<RawCheckNode | null> };
        } | null;
        deployments: { nodes: RawDeployment[] };
      };
    }>;
  };
}
interface RawRepository {
  name: string;
  url: string;
  isArchived: boolean;
  pushedAt: string | null;
  updatedAt: string;
  defaultBranchRef: { name: string } | null;
  openIssues: { totalCount: number };
  pullRequests: { nodes: RawPullRequest[] };
}

/* -------------------------------------------------------------------------
 * Derivations — each one fails closed
 * ----------------------------------------------------------------------- */

/**
 * Tests passed: every check on the PR head must have concluded successfully.
 *
 * When every check context is readable, each one is inspected directly: NEUTRAL
 * and SKIPPED count as passing because GitHub uses them for legitimately-not-
 * applicable jobs; anything else non-success is a failure.
 *
 * When no context is readable, or some were dropped as forbidden (this org's
 * fine-grained tokens cannot read check runs), the readable subset cannot be
 * trusted — a hidden failing check must not be masked by a visible passing one —
 * so the decision defers to GitHub's aggregate rollup state, which spans every
 * check regardless of token permission.
 *
 * Every branch fails closed: absent a positive SUCCESS signal the answer is
 * false, because "nothing ran" or "cannot tell" is not "everything passed", and
 * treating it as success is precisely how a false green reaches an executive.
 */
export function deriveTestsPassed(
  contexts: RawCheckNode[],
  rollupState: string | null = null,
  contextsIncomplete = false,
): boolean {
  // Any unreadable (dropped) context, or no readable contexts at all, means the
  // subset in hand is not the whole picture — defer to the aggregate rollup.
  if (contextsIncomplete || contexts.length === 0) return rollupState === "SUCCESS";

  return contexts.every((node) => {
    if (node.status !== undefined && node.status !== null) {
      if (node.status !== "COMPLETED") return false;
      return (
        node.conclusion === "SUCCESS" ||
        node.conclusion === "NEUTRAL" ||
        node.conclusion === "SKIPPED"
      );
    }
    return node.state === "SUCCESS";
  });
}

/**
 * Reviewed: GitHub's own review decision must be APPROVED, and at least one
 * approving review must come from a human who is not the PR author.
 *
 * Both conditions are required. `reviewDecision` alone can be APPROVED in
 * configurations we do not control, and an approval from a bot is not a human
 * accountable for the decision.
 */
export function deriveReviewed(pr: RawPullRequest): boolean {
  if (pr.reviewDecision !== "APPROVED") return false;

  const author = pr.author?.login ?? null;
  return pr.latestReviews.nodes.some((review) => {
    if (review.state !== "APPROVED") return false;
    const login = review.author?.login ?? null;
    if (!login) return false;
    if (author && login === author) return false;
    return !isProbablyBot(login);
  });
}

/**
 * Preview URL: a real GitHub deployment environment URL, else an explicit
 * `Preview: <https url>` marker in the PR body. Never invented.
 */
export function derivePreview(pr: RawPullRequest): {
  url: string | null;
  source: "deployment" | "pr-body" | "none";
} {
  const deployments = pr.commits.nodes[0]?.commit.deployments.nodes ?? [];

  for (const deployment of deployments) {
    // Only an active deployment counts; a failed or inactive one is not a preview.
    if (deployment.state !== "ACTIVE") continue;
    const url = validatePreviewUrl(deployment.latestStatus?.environmentUrl);
    if (url) return { url, source: "deployment" };
  }

  const marker = parsePreviewMarker(pr.body);
  if (marker) return { url: marker, source: "pr-body" };

  return { url: null, source: "none" };
}

/**
 * Has the business already asked for changes on this work?
 *
 * Applied by the dashboard when an approver presses Request Changes, and cleared
 * by a developer when the work is ready to be looked at again. It is what makes
 * that button do something visible: the project leaves the executive queue
 * instead of sitting there still described as awaiting a decision.
 */
export function deriveChangesRequested(pr: RawPullRequest | null): boolean {
  if (!pr) return false;
  const label = DECISION_LABELS.changesRequested.name;
  return pr.labels.nodes.some((node) => node.name.toLowerCase() === label);
}

/** Blocked requires an explicit `blocked` label. Inactivity is never blocked. */
export function deriveBlocked(repo: RawRepository, pr: RawPullRequest | null): boolean {
  if (repo.openIssues.totalCount > 0) return true;
  if (!pr) return false;
  return pr.labels.nodes.some((label) => label.name.toLowerCase() === "blocked");
}

export function deriveStatus(
  blocked: boolean,
  pr: RawPullRequest | null,
  reviewed: boolean,
  testsPassed: boolean,
  readyForJack: boolean,
): ProjectStatus {
  if (blocked) return "blocked";
  // All three gates cleared and no decision taken yet: it is on Jack's desk, not
  // the reviewer's. This is the state the Ready-for-Jack panel acts on.
  if (readyForJack) return "awaiting_decision";
  // Ready for review means a non-draft PR has actually reached technical review:
  // checks are green and GitHub reports a review decision beyond "none". It has
  // NOT yet cleared review + preview, so it is not yet awaiting a decision.
  if (pr && !pr.isDraft && testsPassed && (reviewed || pr.reviewDecision === "REVIEW_REQUIRED")) {
    return "ready_for_review";
  }
  return "in_progress";
}

function describeUpdate(
  status: ProjectStatus,
  pr: RawPullRequest | null,
  testsPassed: boolean,
  reviewed: boolean,
  changesRequested: boolean,
): string {
  if (status === "blocked") return "Blocked — waiting on a resolution";
  if (!pr) return "Project set up, no active work yet";
  if (changesRequested) return "Changes requested — back with the developer";
  if (!testsPassed) return "Automated testing in progress";
  if (!reviewed) return "Waiting for technical review";
  if (status === "awaiting_decision") return "Ready for your go / no-go decision";
  // Reviewed, but not yet cleared for a decision — a preview is still missing.
  // Kept in the "In Review" vocabulary so the badge and this line never fight:
  // review is done, the preview is what remains before it can reach Jack.
  return "Reviewed — preparing a preview before it goes to Jack";
}

/* -------------------------------------------------------------------------
 * Assembly
 * ----------------------------------------------------------------------- */

export interface ProjectsResult {
  projects: Project[];
  diagnostics: ProjectDiagnostics[];
}

/**
 * What `.helix/project.json` declares about a project. Every field is optional:
 * the file is written at provisioning time but a project may predate it, and a
 * hand-edited file may be missing anything.
 */
export interface ProjectMetadata {
  displayName: string | null;
  /**
   * Where an approved release deploys. Absent or null means no target, which is
   * the truthful state until someone replaces the `CUSTOMIZE` step in that
   * project's `production-deploy.yml`.
   */
  deployTarget: string | null;
}

/** Project metadata keyed by repository slug. */
export type MetadataLookup = Map<string, ProjectMetadata>;

export function buildProjects(
  repositories: RawRepository[],
  metadata: MetadataLookup,
): ProjectsResult {
  const projects: Project[] = [];
  const diagnostics: ProjectDiagnostics[] = [];

  for (const repo of repositories) {
    if (repo.isArchived) continue;
    if (EXCLUDED_REPOS.has(repo.name)) continue;

    // Most recently updated open PR represents the current work.
    const pr = repo.pullRequests.nodes[0] ?? null;
    const rollup = pr?.commits.nodes[0]?.commit.statusCheckRollup ?? null;
    // Drop the null context entries the token could not read. If any were
    // dropped, the readable subset is incomplete and must not be trusted on its
    // own — deriveTestsPassed then defers to the aggregate rollup state.
    const rawContexts = rollup?.contexts.nodes ?? [];
    const contexts = rawContexts.filter((node): node is RawCheckNode => node != null);
    const contextsIncomplete = contexts.length < rawContexts.length;

    const testsPassed = pr
      ? deriveTestsPassed(contexts, rollup?.state ?? null, contextsIncomplete)
      : false;
    const reviewed = pr ? deriveReviewed(pr) : false;
    const preview = pr ? derivePreview(pr) : { url: null, source: "none" as const };
    const previewReady = preview.url !== null;
    const blocked = deriveBlocked(repo, pr);
    const changesRequested = deriveChangesRequested(pr);
    // All three gates, positively established, and no decision already taken.
    // Computed before the status so the badge and this flag can never disagree.
    const readyForJack = testsPassed && reviewed && previewReady && !changesRequested;
    const status = deriveStatus(blocked, pr, reviewed, testsPassed, readyForJack);

    const declared = metadata.get(repo.name) ?? null;

    projects.push({
      repository: repo.name,
      displayName: declared?.displayName ?? slugToDisplayName(repo.name),
      repositoryUrl: repo.url,
      status,
      developer: pr?.author?.login ?? null,
      latestUpdate: describeUpdate(status, pr, testsPassed, reviewed, changesRequested),
      updatedAt: pr?.updatedAt ?? repo.pushedAt ?? repo.updatedAt,
      activePullRequest: pr
        ? { number: pr.number, title: pr.title, url: pr.url, commitSha: pr.headRefOid }
        : null,
      previewUrl: preview.url,
      deployTarget: declared?.deployTarget ?? null,
      testsPassed,
      reviewed,
      previewReady,
      // Established above, before the status, so the two can never disagree. A
      // decision already taken removes it from the queue: an approver who asked
      // for changes must not be shown the same project again as though nothing
      // happened.
      readyForJack,
    });

    diagnostics.push({
      repository: repo.name,
      headSha: pr ? pr.headRefOid.slice(0, 7) : null,
      checkSummary: contextsIncomplete
        ? `checks not fully readable (token lacks Checks); rollup state ${rollup?.state ?? "none"}, passing: ${testsPassed}`
        : contexts.length > 0
          ? `${contexts.length} check(s), passing: ${testsPassed}`
          : "No checks reported",
      reviewSummary: pr ? `reviewDecision: ${pr.reviewDecision ?? "none"}` : "No open pull request",
      previewSource: preview.source,
    });
  }

  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { projects, diagnostics };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Read one project's `.helix/project.json`.
 *
 * Best-effort by design: a missing or malformed file yields nulls rather than an
 * error, so the dashboard degrades to a slug-derived name instead of going dark.
 */
export async function readProjectMetadata(
  client: GitHubClient,
  repo: string,
): Promise<ProjectMetadata> {
  const parsed = await readJsonFile<{ displayName?: unknown; deployTarget?: unknown }>(
    client,
    repo,
    ".helix/project.json",
  );

  return {
    displayName: readString(parsed?.displayName),
    deployTarget: readString(parsed?.deployTarget),
  };
}

/** Fetch metadata for many projects at once. Never fails the request. */
export async function fetchProjectMetadata(
  client: GitHubClient,
  repos: string[],
): Promise<MetadataLookup> {
  const lookup: MetadataLookup = new Map();

  await Promise.all(
    repos.map(async (repo) => {
      lookup.set(repo, await readProjectMetadata(client, repo));
    }),
  );

  return lookup;
}

/** Scope the GitHub query before fetching; reject unexpected repositories again below. */
export async function listProjects(
  client: GitHubClient,
  allowed: string[],
): Promise<ProjectsResult> {
  const unique = [...new Set(allowed)].filter(
    (s) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(s) && !EXCLUDED_REPOS.has(s),
  );
  if (!unique.length) return { projects: [], diagnostics: [] };
  const repositories: RawRepository[] = [];
  // Short batches stay inside GitHub search-query limits and do not silently truncate at 50.
  for (let i = 0; i < unique.length; i += 5) {
    const batch = unique.slice(i, i + 5);
    const data = await client.graphql<{ search: { nodes: RawRepository[] } }>(PROJECTS_QUERY, {
      query: `${batch.map((s) => `repo:${ORG}/${s}`).join(" ")} fork:false archived:false`,
      limit: batch.length,
    });
    repositories.push(
      ...(data.search?.nodes ?? []).filter(
        (r) => r && batch.includes(r.name) && r.url === `https://github.com/${ORG}/${r.name}`,
      ),
    );
  }
  const metadata = await fetchProjectMetadata(
    client,
    repositories.map((r) => r.name),
  );
  return buildProjects(repositories, metadata);
}
