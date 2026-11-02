import assert from "node:assert/strict";
import test from "node:test";
import { previewPolicy } from "../lib/server.ts";
import { fixture, githubFixture, mockServices } from "./fixtures.mjs";

const html =
  "<!doctype html><html><head><title>Demo</title></head><body><button onclick=\"this.textContent='Selected'\">Select</button></body></html>";

test("real request, upload, version feedback, approval, handoff, and revision invalidation", async (context) => {
  const f = fixture(context);
  const p = await f.create();
  let detail = await f.ok(`/projects/${p.id}`);
  assert.equal(detail.project.kind, "change");
  assert.equal(detail.versions.length, 0);
  const v1 = await f.ok(`/projects/${p.id}/upload`, { html, label: "First prototype" });
  await f.ok(`/projects/${p.id}/feedback`, {
    versionId: v1.id,
    body: "The comparison flow is clear.",
    changes: false,
  });
  await f.ok(`/projects/${p.id}/approve`, { versionId: v1.id });
  await f.ok(`/projects/${p.id}/handoff`, {});
  detail = await f.ok(`/projects/${p.id}`);
  assert.equal(detail.project.status, "handed_off");
  assert.equal(detail.project.approved_version, v1.id);
  assert.equal(detail.comments.length, 1);
  const handoff = await f.request(`/projects/${p.id}/handoff`);
  assert.match(await handoff.text(), /Approved for implementation/);
  const v2 = await f.ok(`/projects/${p.id}/upload`, {
    html: html.replace("Demo", "Revision"),
    label: "Second prototype",
  });
  detail = await f.ok(`/projects/${p.id}`);
  assert.equal(detail.project.approved_version, null);
  assert.equal(detail.project.status, "review");
  assert.equal(detail.versions[0].number, 2);
  assert.equal((await f.request(`/projects/${p.id}/approve`, { versionId: v1.id })).status, 409);
  await f.ok(`/projects/${p.id}/approve`, { versionId: v2.id });
  await f.ok(`/projects/${p.id}/feedback`, {
    versionId: v2.id,
    body: "Change the button label.",
    changes: true,
  });
  detail = await f.ok(`/projects/${p.id}`);
  assert.equal(detail.project.status, "changes");
  assert.equal(detail.project.approved_version, null);
});

test("identity and origin checks protect API, HTML bytes, and mutation routes", async (context) => {
  const f = fixture(context);
  const p = await f.create();
  const v = await f.ok(`/projects/${p.id}/upload`, { html, label: "Prototype" });
  for (const path of ["/state", `/projects/${p.id}`, `/preview/${v.id}`]) {
    assert.equal(
      (await f.request(path, undefined, { headers: { "oai-authenticated-user-id": "" } })).status,
      401,
    );
    assert.equal(
      (await f.request(path, undefined, { headers: { "oai-authenticated-user-id": "other-user" } }))
        .status,
      403,
    );
  }
  assert.equal(
    (
      await f.request(
        `/projects/${p.id}/approve`,
        { versionId: v.id },
        { headers: { Origin: "https://attacker.test" } },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request(
        `/projects/${p.id}/approve`,
        { versionId: v.id },
        { headers: { Origin: "null" } },
      )
    ).status,
    403,
  );
  const response = await f.request(`/preview/${v.id}`);
  assert.equal(response.headers.get("content-security-policy"), previewPolicy);
  assert.match(previewPolicy, /sandbox allow-scripts;/);
  assert.doesNotMatch(previewPolicy, /allow-same-origin/);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("cross-project feedback and approval reject a version from another project", async (context) => {
  const f = fixture(context);
  const p1 = await f.create();
  const p2 = await f.create("Other project");
  const v = await f.ok(`/projects/${p1.id}/upload`, { html, label: "First" });
  assert.equal((await f.request(`/projects/${p2.id}/approve`, { versionId: v.id })).status, 404);
  assert.equal(
    (await f.request(`/projects/${p2.id}/feedback`, { versionId: v.id, body: "Wrong project" }))
      .status,
    404,
  );
  assert.equal((await f.ok(`/projects/${p2.id}`)).comments.length, 0);
});

test("queue locks serialize concurrent ticks, reject duplicate requests, and label sample output", async (context) => {
  const f = fixture(context);
  const p1 = await f.create();
  const p2 = await f.create("Another request");
  await f.ok(`/projects/${p1.id}/enqueue`, { mode: "sample" });
  await f.ok(`/projects/${p2.id}/enqueue`, { mode: "sample" });
  assert.equal((await f.request(`/projects/${p1.id}/enqueue`, { mode: "sample" })).status, 409);
  assert.equal(
    (await f.request(`/projects/${p1.id}/upload`, { html, label: "Conflicting upload" })).status,
    409,
  );
  await Promise.all([f.ok("/tick", {}), f.ok("/tick", {})]);
  let state = await f.ok("/state");
  assert.equal(state.jobs.filter((j) => j.status === "complete").length, 1);
  assert.equal(state.jobs.filter((j) => j.status === "queued").length, 1);
  await f.ok("/tick", {});
  state = await f.ok("/state");
  assert.equal(state.jobs.filter((j) => j.status === "complete").length, 2);
  const detail = await f.ok(`/projects/${p1.id}`);
  assert.equal(detail.versions[0].source, "sample");
  assert.equal(
    (await f.request(`/projects/${p1.id}/approve`, { versionId: detail.versions[0].id })).status,
    409,
  );
  assert.match(await (await f.request(`/preview/${detail.versions[0].id}`)).text(), /SAMPLE DEMO/);
});

test("a storage failure leaves the project and previous approved version intact", async (context) => {
  const f = fixture(context);
  const p = await f.create();
  const v = await f.ok(`/projects/${p.id}/upload`, { html, label: "Good version" });
  await f.ok(`/projects/${p.id}/approve`, { versionId: v.id });
  f.env.BUCKET.put = async () => {
    throw new Error("Storage offline");
  };
  assert.equal(
    (await f.request(`/projects/${p.id}/upload`, { html, label: "Will fail" })).status,
    503,
  );
  const detail = await f.ok(`/projects/${p.id}`);
  assert.equal(detail.versions.length, 1);
  assert.equal(detail.project.approved_version, v.id);
});

test("AI adapter uses runtime credentials, resumes provider work, stores a version, and includes revision feedback", async (context) => {
  const f = fixture(context);
  const realFetch = globalThis.fetch;
  const submitted = [];
  let responseNumber = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith("https://api.github.com/repos/")) return githubFixture(url);
    if (String(url).includes("/models/")) return Response.json({ id: "gpt-5.6-sol" });
    if (options.method === "DELETE") return Response.json({ deleted: true });
    if (options.method === "POST") {
      submitted.push(JSON.parse(options.body));
      return Response.json({ id: `response-${++responseNumber}`, status: "queued" });
    }
    return Response.json({
      id: `response-${responseNumber}`,
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: html }] }],
    });
  };
  try {
    await f.ok("/settings/ai", { model: "gpt-5.6-sol" });
    assert.equal(f.db.prepare("SELECT value FROM settings WHERE id='ai_key'").get(), undefined);
    assert.doesNotMatch(JSON.stringify(await f.ok("/state")), /UNIT_TEST_VALUE/);
    const p = await f.create();
    await f.ok(`/projects/${p.id}/enqueue`, { mode: "ai" });
    await f.ok("/tick", {});
    assert.equal((await f.ok("/state")).jobs[0].status, "running");
    await f.ok("/tick", {});
    let detail = await f.ok(`/projects/${p.id}`);
    assert.equal(detail.versions[0].source, "ai");
    assert.equal((await f.ok("/state")).jobs[0].status, "complete");
    await f.ok(`/projects/${p.id}/feedback`, {
      versionId: detail.versions[0].id,
      body: "Make the action clearer",
      changes: true,
    });
    await f.ok(`/projects/${p.id}/enqueue`, { mode: "ai", prompt: "Use a larger blue button" });
    await f.ok("/tick", {});
    await f.ok("/tick", {});
    detail = await f.ok(`/projects/${p.id}`);
    assert.equal(detail.versions.length, 2);
    assert.match(submitted[1].input, /Make the action clearer/);
    assert.match(submitted[1].input, /previousHtml/);
    assert.equal(submitted[0].background, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("AI generation fails closed until the service is approved and a runtime credential exists", async (context) => {
  const f = fixture(context);
  f.env.MOBIUS_AI_APPROVED = "false";
  const p = await f.create();
  const network = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected network call");
  });
  assert.equal((await f.ok("/state")).ai.configured, false);
  assert.equal((await f.request(`/projects/${p.id}/enqueue`, { mode: "ai" })).status, 409);
  assert.equal((await f.request("/settings/ai", { model: "gpt-5.6-sol" })).status, 409);
  assert.equal(network.mock.calls.length, 0);
});

test("an unknown AI submission outcome keeps the single build slot occupied until resolved", async (context) => {
  const f = fixture(context);
  const p = await f.create();
  const next = await f.create("Next project");
  const network = mockServices(context, async () => {
    throw new Error("Lost response");
  });
  const job = await f.ok(`/projects/${p.id}/enqueue`, { mode: "ai" });
  await f.ok(`/projects/${next.id}/enqueue`, { mode: "sample" });
  await f.ok("/tick", {});
  await f.ok("/tick", {});
  const state = await f.ok("/state");
  assert.equal(state.jobs.find((j) => j.id === job.id).status, "running");
  assert.equal(state.jobs.find((j) => j.id === job.id).phase, "Confirm provider status");
  assert.equal(state.jobs.find((j) => j.project_id === next.id).status, "queued");
  assert.equal(network.mock.calls.length, 1);
  assert.equal((await f.request(`/jobs/${job.id}/cancel`, {})).status, 409);
  await f.ok(`/jobs/${job.id}/cancel`, { confirmedStopped: true });
  await f.ok("/tick", {});
  assert.equal((await f.ok(`/projects/${next.id}`)).versions.length, 1);
});

test("an incomplete provider document fails the build without blocking the following request", async (context) => {
  const f = fixture(context);
  const p = await f.create();
  const next = await f.create("Next project");
  mockServices(context, async () =>
    Response.json({
      id: "fixture-response",
      status: "completed",
      output: [
        { type: "message", content: [{ type: "output_text", text: "<html><body>Incomplete" }] },
      ],
    }),
  );
  const job = await f.ok(`/projects/${p.id}/enqueue`, { mode: "ai" });
  await f.ok(`/projects/${next.id}/enqueue`, { mode: "sample" });
  await f.ok("/tick", {});
  assert.equal((await f.ok("/state")).jobs.find((j) => j.id === job.id).status, "failed");
  assert.equal((await f.ok(`/projects/${p.id}`)).versions.length, 0);
  await f.ok("/tick", {});
  assert.equal((await f.ok(`/projects/${next.id}`)).versions.length, 1);
});
