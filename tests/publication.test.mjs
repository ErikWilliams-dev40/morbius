import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "./fixtures.mjs";
import { publishIssueComment } from "../lib/helix/worker/github/publish.ts";
import { GitHubClient, GitHubError } from "../lib/helix/worker/github/client.ts";

const ISSUE = "https://github.com/House-of-Helix-CMD/test-project/issues/1";

/** Routes the GitHub reads the flow needs and captures the one comment write. */
function githubNetwork(context, captures) {
  context.mock.method(globalThis, "fetch", async (url, options = {}) => {
    const target = String(url);
    const method = options.method || "GET";
    if (/\/issues\/1\/comments$/.test(target) && method === "POST") {
      captures.push({ url: target, method, options });
      return Response.json({
        html_url: "https://github.com/House-of-Helix-CMD/test-project/issues/1#issuecomment-9",
      });
    }
    if (/\/repos\/.+\/issues\/1$/.test(target) && method === "GET") {
      return Response.json({ html_url: ISSUE, state: "open" });
    }
    throw new Error(`Unexpected network request: ${method} ${target}`);
  });
}

test("publishing posts the decision record to the linked issue and records it", async (context) => {
  const f = fixture(context);
  const captures = [];
  githubNetwork(context, captures);
  f.env.HELIX_GITHUB_WRITE_TOKEN = "SYNTHETIC_WRITE_TEST_VALUE";
  f.env.MOBIUS_GITHUB_WRITE_APPROVED = "true";
  const p = await f.create();
  const v = await f.ok(`/projects/${p.id}/upload`, {
    html: "<!doctype html><html><head><title>Demo</title></head><body>Draft</body></html>",
    label: "First prototype",
  });
  await f.ok(`/projects/${p.id}/approve`, { versionId: v.id });

  const result = await f.ok(`/projects/${p.id}/publish`, {});
  assert.equal(
    result.url,
    "https://github.com/House-of-Helix-CMD/test-project/issues/1#issuecomment-9",
  );

  assert.equal(captures.length, 1);
  assert.equal(captures[0].method, "POST");
  assert.equal(
    captures[0].url,
    "https://api.github.com/repos/House-of-Helix-CMD/test-project/issues/1/comments",
  );
  const posted = JSON.parse(captures[0].options.body).body;
  assert.match(posted, /Approved for implementation\./);
  assert.match(posted, /SHA-256: [0-9a-f]{64}/);
  assert.match(posted, /## Decision history/);
  // The narrow write credential is used, never the read token.
  assert.equal(captures[0].options.headers.Authorization, "Bearer SYNTHETIC_WRITE_TEST_VALUE");

  const detail = await f.ok(`/projects/${p.id}`);
  assert.ok(
    detail.activity.some((a) =>
      a.text.includes("Decision record published to the GitHub work item"),
    ),
  );
});

test("publication fails closed until the connection is approved and configured", async (context) => {
  const f = fixture(context);
  const captures = [];
  githubNetwork(context, captures);
  const p = await f.create();
  const v = await f.ok(`/projects/${p.id}/upload`, {
    html: "<!doctype html><html><head><title>Demo</title></head><body>Draft</body></html>",
    label: "First prototype",
  });
  await f.ok(`/projects/${p.id}/approve`, { versionId: v.id });

  // No credential and no approval flag.
  assert.equal((await f.request(`/projects/${p.id}/publish`, {})).status, 409);
  // Credential without the recorded approval.
  f.env.HELIX_GITHUB_WRITE_TOKEN = "SYNTHETIC_WRITE_TEST_VALUE";
  assert.equal((await f.request(`/projects/${p.id}/publish`, {})).status, 409);
  f.env.MOBIUS_GITHUB_WRITE_APPROVED = "true";
  // Publication needs an approved decision to record.
  const p2 = await f.create("Second product finder");
  assert.equal((await f.request(`/projects/${p2.id}/publish`, {})).status, 409);
  assert.equal(captures.length, 0);
});

test("the publication client is single-purpose and the read client still refuses writes", async (context) => {
  const calls = [];
  context.mock.method(globalThis, "fetch", async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return Response.json({
      html_url: "https://github.com/House-of-Helix-CMD/test-project/issues/1#issuecomment-9",
    });
  });

  await publishIssueComment("SYNTHETIC_WRITE_TEST_VALUE", "test-project", 1, "record");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "POST");
  assert.match(calls[0].url, /\/repos\/House-of-Helix-CMD\/test-project\/issues\/1\/comments$/);

  // Malformed components are refused before any network call is made.
  for (const [repo, number, body] of [
    ["evil/../other", 1, "record"],
    ["test-project", 0, "record"],
    ["test-project", -1, "record"],
    ["test-project", 1.5, "record"],
    ["test-project", 1, "   "],
  ]) {
    await assert.rejects(
      publishIssueComment("SYNTHETIC_WRITE_TEST_VALUE", repo, number, body),
      (error) => error instanceof GitHubError && error.kind === "forbidden",
    );
  }
  assert.equal(calls.length, 1);

  // The read client's refusal to perform writes is unchanged.
  const read = new GitHubClient("SYNTHETIC_GITHUB_TEST_VALUE");
  await assert.rejects(
    read.rest("/repos/House-of-Helix-CMD/test-project/issues/1/comments", {
      method: "POST",
      body: { body: "record" },
    }),
    (error) => error instanceof GitHubError && error.kind === "forbidden",
  );
  assert.equal(calls.length, 1);
});
