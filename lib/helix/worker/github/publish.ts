/**
 * Narrow GitHub publication client for the developer-handoff decision record.
 *
 * Its entire capability is posting ONE comment on one issue in an assigned
 * repository. It is deliberately separate from GitHubClient, whose refusal to
 * perform writes is a tested contract that must stay true: this module cannot
 * express a repository-content write, a merge, or a GraphQL mutation because
 * it constructs its only request path internally from validated components.
 * The credential it drives must be scoped to issue comments only.
 */

import { ORG, GitHubError } from "./client.ts";

const API_ROOT = "https://api.github.com";
const TIMEOUT_MS = 10_000;
const USER_AGENT = "helix-mobius-status";

/** Same repository-name rule the read client enforces for assignments. */
const REPO_SLUG = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;

export type PublishedComment = { url: string };

function classify(status: number): GitHubError {
  if (status === 401) return new GitHubError("unauthorized", 401);
  if (status === 403) return new GitHubError("forbidden", 403);
  if (status === 404) return new GitHubError("not_found", 404);
  if (status === 409 || status === 422) return new GitHubError("conflict", status);
  return new GitHubError("unavailable", status);
}

/**
 * Post the handoff decision record as a comment on a verified GitHub issue.
 * Repo name and issue number are validated components, never a caller-built
 * path; the method is fixed to POST on the comments collection.
 */
export async function publishIssueComment(
  token: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<PublishedComment> {
  if (!REPO_SLUG.test(repo)) throw new GitHubError("forbidden");
  if (!Number.isInteger(issueNumber) || issueNumber < 1) throw new GitHubError("forbidden");
  if (!body.trim()) throw new GitHubError("forbidden");

  const path = `/repos/${ORG}/${repo}/issues/${issueNumber}/comments`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
      signal: controller.signal,
      redirect: "error",
    });
  } catch (cause) {
    // `cause` is never inspected beyond abort detection and never logged.
    if (cause instanceof Error && cause.name === "AbortError") throw new GitHubError("timeout");
    throw new GitHubError("unavailable");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) throw new GitHubError("unauthorized", 401);
  if (!response.ok) throw classify(response.status);

  let data: { html_url?: unknown };
  try {
    data = (await response.json()) as { html_url?: unknown };
  } catch {
    throw new GitHubError("unavailable", response.status);
  }
  if (typeof data.html_url !== "string" || !data.html_url)
    throw new GitHubError("unavailable", response.status);
  return { url: data.html_url };
}
