/**
 * Executive project contract — the boundary between GitHub and the dashboard.
 *
 * Raw GitHub payloads never cross this line. The Worker derives every value here
 * server-side; the frontend renders it and infers nothing about engineering state.
 *
 * Nothing in this file may carry a credential. Anything added here is, by definition,
 * visible to any authenticated dashboard viewer.
 */

/**
 * Delivery state, derived server-side. Never inferred by the client.
 *
 * `ready_for_review` and `awaiting_decision` are deliberately distinct: the
 * first is work that passed testing and is with the technical reviewer, the
 * second is work that cleared all three READY FOR JACK gates and is now on the
 * approver's desk. Collapsing them is what made a project still in technical
 * review read as "waiting for a decision" while the Ready-for-Jack panel sat
 * empty.
 */
export type ProjectStatus = "in_progress" | "ready_for_review" | "awaiting_decision" | "blocked";

export interface ActivePullRequest {
  number: number;
  title: string;
  url: string;
  /**
   * Full 40-character head SHA. Sent back with any decision so the server can
   * refuse if the work moved between rendering and deciding.
   */
  commitSha: string;
}

export interface Project {
  /** GitHub repository slug. Shown only in Technical Details. */
  repository: string;
  /** Friendly name Jack sees. From .helix/project.json, else derived from the slug. */
  displayName: string;
  repositoryUrl: string;
  status: ProjectStatus;
  /** GitHub login of the person carrying the work, or null when genuinely unknown. */
  developer: string | null;
  /** One plain-language sentence. No GitHub vocabulary. */
  latestUpdate: string;
  /** ISO 8601. The client formats freshness from this. */
  updatedAt: string;
  activePullRequest: ActivePullRequest | null;
  /** Validated https URL, or null. Never guessed. */
  previewUrl: string | null;

  /**
   * Where an approved release would actually deploy, declared in
   * `.helix/project.json`. Null means this project has no deploy target, which
   * is the honest state for every project whose `production-deploy.yml` still
   * carries the `CUSTOMIZE` placeholder. Go Live still records the approval when
   * this is null; it just cannot claim anything shipped.
   */
  deployTarget: string | null;

  /**
   * The three READY FOR JACK conditions. Each is true only when positively
   * established from GitHub state. Absent or ambiguous evidence yields false.
   */
  testsPassed: boolean;
  reviewed: boolean;
  previewReady: boolean;
  /** True only when all three above are true. Computed server-side. */
  readyForJack: boolean;
}

/** Where the check/review evidence came from. Technical Details only. */
export interface ProjectDiagnostics {
  repository: string;
  headSha: string | null;
  checkSummary: string;
  reviewSummary: string;
  previewSource: "deployment" | "pr-body" | "none";
}

export interface ProjectsResponse {
  source: "github";
  generatedAt: string;
  projects: Project[];
  diagnostics: ProjectDiagnostics[];
  /** Server-authoritative. The allowlists themselves are never sent to the client. */
  capabilities: {
    canCreateProjects: boolean;
    /**
     * May this identity record a business decision on a release? A distinct
     * power from creating a project, held by a distinct allowlist.
     */
    canApproveReleases: boolean;
  };
}

/* ---------------------------------------------------------------------------
 * Errors
 * ------------------------------------------------------------------------- */

export type ApiErrorCode =
  | "not_configured"
  | "unauthenticated"
  | "forbidden"
  | "invalid_request"
  | "name_invalid"
  | "name_reserved"
  | "already_exists"
  /** The project has no open pull request, so there is nothing to decide on. */
  | "no_pull_request"
  /** The work moved after the dashboard rendered it. The decision was not recorded. */
  | "stale_state"
  /** Live GitHub state does not support a release approval. Fails closed. */
  | "not_ready"
  | "upstream_unauthorized"
  | "upstream_forbidden"
  | "upstream_unavailable"
  | "timeout"
  | "internal";

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Present only on partial provisioning: steps that did not complete. */
    incompleteSteps?: string[];
  };
}

export function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "error" in value;
}

/* ---------------------------------------------------------------------------
 * Project creation
 * ------------------------------------------------------------------------- */

/** The entire client request. Everything else is server-controlled. */
export interface CreateProjectRequest {
  name: string;
}

export interface CreateProjectResponse {
  project: Project;
  /**
   * Provisioning steps that did not complete. Empty on a clean provision.
   * Non-empty means the repository exists but is not fully set up — the UI
   * must say so rather than reporting unqualified success.
   */
  incompleteSteps: string[];
}

/* ---------------------------------------------------------------------------
 * Business decisions
 * ------------------------------------------------------------------------- */

/**
 * The two decisions a business approver can record. Deliberately not a general
 * "post a comment" API: each value maps to one reviewed server-side behaviour.
 */
export type DecisionKind = "request_changes" | "go_live";

/** Longest note accepted. Generous for a paragraph, far below the body cap. */
export const MAX_DECISION_NOTE_LENGTH = 2000;

/**
 * A decision request.
 *
 * `pullRequest` and `commitSha` are what the dashboard *displayed*. The server
 * re-reads live state and refuses if either has moved, so an approval can never
 * silently land on a commit the approver did not see.
 */
export interface DecisionRequest {
  decision: DecisionKind;
  pullRequest: number;
  /** Full 40-character SHA the dashboard showed. Never a branch or a short SHA. */
  commitSha: string;
  /** Required for `request_changes`: a developer needs to know what to change. */
  note?: string;
}

/** What happened to the release itself. Separate from whether the decision recorded. */
export type ReleaseOutcome =
  /** `request_changes`: no deployment was ever in question. */
  | { dispatched: false; reason: "not_applicable" }
  /** Approval recorded, but this project declares no deploy target. */
  | { dispatched: false; reason: "no_deploy_target" }
  /**
   * Approval recorded, but the approved commit is not yet on the default branch.
   * Helix never deploys a commit that has not been merged: the canonical
   * workflow is merge, then staging, then production.
   */
  | { dispatched: false; reason: "not_merged" }
  /**
   * Approval recorded and durable, but the release workflow could not be
   * started. A separate state from a failed decision: the approval stands and
   * must not be re-sought, while the deployment did not begin.
   */
  | { dispatched: false; reason: "dispatch_failed" }
  /** Approval recorded and the release workflow was dispatched. */
  | { dispatched: true; target: string };

export interface DecisionResponse {
  decision: DecisionKind;
  pullRequest: { number: number; url: string };
  /** The commit the decision is bound to. Full 40 characters. */
  commitSha: string;
  release: ReleaseOutcome;
}
