import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "./fixtures.mjs";
import { GitHubClient } from "../lib/helix/worker/github/client.ts";

test("development discovery queries assigned repositories only and preserves missing evidence", async (context) => {
  const f = fixture(context);
  f.env.MOBIUS_COMPANY_REPOS = JSON.stringify({ helix: ["test-project"] });
  const calls = [];
  context.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/graphql")) {
      const body = JSON.parse(options.body);
      assert.equal(
        body.variables.query,
        "repo:House-of-Helix-CMD/test-project fork:false archived:false",
      );
      const repo = (name) => ({
        name,
        url: `https://github.com/House-of-Helix-CMD/${name}`,
        isArchived: false,
        updatedAt: "2026-09-06T12:00:00Z",
        pushedAt: null,
        defaultBranchRef: { name: "main" },
        openIssues: { totalCount: 0 },
        pullRequests: { nodes: [] },
      });
      return Response.json({
        data: { search: { nodes: [repo("test-project"), repo("unassigned-project")] } },
      });
    }
    assert.ok(String(url).includes("/test-project/contents/"));
    return Response.json({ content: btoa(JSON.stringify({ displayName: "Assigned project" })) });
  });
  const result = await f.ok("/helix/projects");
  assert.equal(result.connection, "connected");
  assert.deepEqual(
    result.projects.map((p) => p.displayName),
    ["Assigned project"],
  );
  assert.equal(result.projects[0].readyForJack, false);
  assert.equal(result.projects[0].previewUrl, null);
  assert.equal(result.projects[0].testsPassed, false);
  assert.equal(result.projects[0].reviewed, false);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_GITHUB_TEST_VALUE/);
  assert.equal(calls.length, 2);
});

test("the status client refuses repository writes and GraphQL mutations", async (context) => {
  const network = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("Network must not be used");
  });
  const client = new GitHubClient("SYNTHETIC_TEST_CREDENTIAL");
  await assert.rejects(() =>
    client.rest("/repos/House-of-Helix-CMD/test-project/issues", {
      method: "POST",
      body: { title: "should not post" },
    }),
  );
  await assert.rejects(() => client.graphql("mutation { createRepository }", {}));
  assert.equal(network.mock.calls.length, 0);
});

test("AI work and handoff require a verified, assigned, open GitHub issue", async (context) => {
  const f = fixture(context);
  const p = await f.ok("/projects", {
    title: "Draft request",
    company: "helix",
    kind: "new",
    brief: "Explore a new sample workflow.",
  });
  assert.equal((await f.request(`/projects/${p.id}/enqueue`, { mode: "ai" })).status, 409);
  assert.equal(
    (
      await f.request(`/projects/${p.id}/issue`, {
        issueUrl: "https://github.com/House-of-Helix-CMD/unassigned/issues/1",
      })
    ).status,
    409,
  );
  const url = "https://github.com/House-of-Helix-CMD/test-project/issues/1";
  await f.ok(`/projects/${p.id}/issue`, { issueUrl: url });
  assert.equal((await f.ok(`/projects/${p.id}`)).project.issue_url, url);
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ html_url: url, state: "closed" }),
  );
  assert.equal((await f.request(`/projects/${p.id}/enqueue`, { mode: "ai" })).status, 409);
  assert.equal((await f.ok("/state")).jobs.length, 0);
  assert.equal((await f.request(`/projects/${p.id}/handoff`, {})).status, 409);
});

test("connection errors expose neither upstream bodies nor secrets", async (context) => {
  const f = fixture(context);
  context.mock.method(
    globalThis,
    "fetch",
    async () => new Response("Sensitive upstream body", { status: 403 }),
  );
  const response = await f.request("/helix/projects");
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /Sensitive|SYNTHETIC/);
  f.env.MOBIUS_GITHUB_APPROVED = "false";
  assert.equal((await f.ok("/helix/projects")).connection, "not_configured");
});
