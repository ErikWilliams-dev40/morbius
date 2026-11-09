import assert from "node:assert/strict";
import test from "node:test";
import { authenticate, verifyAccessJwt, readAccessConfig } from "../lib/helix/worker/auth.ts";
import { identifyUser } from "../lib/access.ts";
import { fixture } from "./fixtures.mjs";

const instant = 1800000000000;
async function signer(context, domain) {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "synthetic-key" };
  const original = globalThis.fetch;
  context.mock.method(globalThis, "fetch", (url, options) =>
    String(url) === `https://${domain}/cdn-cgi/access/certs`
      ? Promise.resolve(Response.json({ keys: [jwk] }))
      : original(url, options),
  );
  const config = { teamDomain: domain, aud: "synthetic-app-audience" };
  async function sign(overrides = {}, header = { alg: "RS256", kid: "synthetic-key" }) {
    const payload = {
      iss: `https://${domain}`,
      aud: [config.aud],
      exp: instant / 1000 + 3600,
      nbf: instant / 1000 - 10,
      email: "reviewer@example.test",
      ...overrides,
    };
    const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const body = `${encode(header)}.${encode(payload)}`;
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      keys.privateKey,
      new TextEncoder().encode(body),
    );
    return `${body}.${Buffer.from(signature).toString("base64url")}`;
  }
  return { sign, config };
}

test("Access requires a valid signature, expected issuer/audience, finite expiry and valid time window", async (context) => {
  const { sign, config } = await signer(context, "jwt-tests.cloudflareaccess.com");
  assert.deepEqual(await verifyAccessJwt(await sign(), config, instant), {
    email: "reviewer@example.test",
  });
  for (const claims of [
    { exp: undefined },
    { exp: "9999999999" },
    { exp: instant / 1000 },
    { iss: "https://other.cloudflareaccess.com" },
    { aud: ["another-app"] },
    { nbf: instant / 1000 + 1 },
    { nbf: "invalid" },
    { email: "" },
  ]) {
    assert.equal(await verifyAccessJwt(await sign(claims), config, instant), null);
  }
  const token = await sign();
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ email: "admin@example.test" })).toString("base64url");
  assert.equal(await verifyAccessJwt(parts.join("."), config, instant), null);
  assert.equal(
    await verifyAccessJwt(await sign({}, { alg: "HS256", kid: "synthetic-key" }), config, instant),
    null,
  );
  assert.equal(readAccessConfig({ ACCESS_TEAM_DOMAIN: "evil.test/path", ACCESS_AUD: "aud" }), null);
  assert.deepEqual(
    await authenticate(
      new Request("https://mobius.test", {
        headers: { "Cf-Access-Authenticated-User-Email": "admin@example.test" },
      }),
      config,
      instant,
    ),
    { ok: false, reason: "missing" },
  );
  assert.equal(
    (
      await authenticate(
        new Request("https://mobius.test", { headers: { Cookie: `CF_Authorization=${token}` } }),
        config,
        instant,
      )
    ).ok,
    true,
  );
});

test("expired cached signing keys are not reused when refresh fails", async (context) => {
  const { sign, config } = await signer(context, "key-expiry-tests.cloudflareaccess.com");
  const token = await sign();
  assert.ok(await verifyAccessJwt(token, config, instant));
  context.mock.method(
    globalThis,
    "fetch",
    async () => new Response("unavailable", { status: 503 }),
  );
  assert.equal(await verifyAccessJwt(token, config, instant + 600001), null);
});

test("Helix authentication never falls back to Sites headers or automatically creates an owner", async () => {
  const request = new Request("https://mobius.test", {
    headers: {
      "oai-authenticated-user-id": "owner",
      "oai-authenticated-user-email": "owner@example.test",
    },
  });
  await assert.rejects(() => identifyUser(request, {}), { status: 503 });
  await assert.rejects(() => identifyUser(request, { MOBIUS_AUTH_MODE: "helix" }), { status: 503 });
  await assert.rejects(() => identifyUser(request, { MOBIUS_AUTH_MODE: "sites_owner" }), {
    status: 503,
  });
  await assert.rejects(
    () =>
      identifyUser(request, {
        MOBIUS_AUTH_MODE: "sites_owner",
        MOBIUS_REVIEW_OWNER_ID: "someone-else",
      }),
    { status: 403 },
  );
});

test("open mode is explicit, grants the full local workspace, and refuses alongside Access configuration", async () => {
  const request = new Request("https://mobius.test");
  const user = await identifyUser(request, { MOBIUS_AUTH_MODE: "open" });
  assert.equal(user.mode, "open");
  assert.ok(user.companies.length > 0);
  assert.equal(user.capabilities.canRequest, true);
  assert.equal(user.capabilities.canBuild, true);
  assert.equal(user.capabilities.canApprovePrototype, true);
  assert.equal(user.capabilities.canManage, true);
  for (const conflicting of [
    { ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com" },
    { ACCESS_AUD: "aud-tag" },
    { MOBIUS_REVIEW_OWNER_ID: "owner-id" },
  ]) {
    await assert.rejects(
      () => identifyUser(request, { MOBIUS_AUTH_MODE: "open", ...conflicting }),
      { status: 503 },
    );
  }
  // Unknown modes still deny; open is never reached by omission.
  await assert.rejects(() => identifyUser(request, { MOBIUS_AUTH_MODE: "sneaky" }), { status: 503 });
});

test("company scopes and separate action permissions protect records, HTML, comments and queue mutations", async (context) => {
  const f = fixture(context);
  const helix = await f.create();
  const v = await f.ok(`/projects/${helix.id}/upload`, {
    html: "<!doctype html><html><head><title>Test</title></head><body>Demo</body></html>",
    label: "Test version",
  });
  const halo = await f.ok("/projects", {
    title: "Halo test",
    company: "halo",
    kind: "new",
    brief: "A sample-only new company request.",
  });
  const job = await f.ok(`/projects/${halo.id}/enqueue`, { mode: "sample" });
  const { sign, config } = await signer(context, "scope-tests.cloudflareaccess.com");
  Object.assign(f.env, {
    MOBIUS_AUTH_MODE: "helix",
    ACCESS_TEAM_DOMAIN: config.teamDomain,
    ACCESS_AUD: config.aud,
    MOBIUS_MEMBER_SCOPES: JSON.stringify({
      "reviewer@example.test": ["helix"],
      "builder@example.test": ["helix"],
      "approver@example.test": ["helix"],
    }),
    PROJECT_CREATOR_EMAILS: "builder@example.test",
    APPROVER_EMAILS: "approver@example.test",
  });
  async function call(email, path, body) {
    return f.request(path, body, { headers: { "Cf-Access-Jwt-Assertion": await sign({ email }) } });
  }
  const state = await (await call("reviewer@example.test", "/state")).json();
  assert.deepEqual(
    state.projects.map((p) => p.id),
    [helix.id],
  );
  assert.equal(state.jobs.length, 0);
  assert.ok(state.activity.every((a) => a.project_id === helix.id));
  assert.equal(state.user.capabilities.canApprovePrototype, false);
  assert.equal((await call("unassigned@example.test", "/state")).status, 403);
  assert.equal((await call("builder@example.test", `/projects/${halo.id}`)).status, 404);
  assert.equal((await call("builder@example.test", `/jobs/${job.id}/cancel`, {})).status, 404);
  assert.equal((await call("reviewer@example.test", `/preview/${v.id}`)).status, 200);
  // Revocation is checked again on every read, including a previously copied preview URL.
  f.env.MOBIUS_MEMBER_SCOPES = JSON.stringify({
    "reviewer@example.test": ["halo"],
    "builder@example.test": ["helix"],
    "approver@example.test": ["helix"],
  });
  assert.equal((await call("reviewer@example.test", `/preview/${v.id}`)).status, 404);
  assert.equal((await call("reviewer@example.test", `/projects/${helix.id}/handoff`)).status, 404);
  assert.equal(
    (await call("builder@example.test", `/projects/${helix.id}/approve`, { versionId: v.id }))
      .status,
    403,
  );
  assert.equal(
    (await call("approver@example.test", `/projects/${helix.id}/approve`, { versionId: v.id }))
      .status,
    200,
  );
  assert.equal(
    (await call("approver@example.test", "/projects", { title: "Unauthorized" })).status,
    403,
  );
  assert.equal(
    (await call("builder@example.test", "/settings/ai", { model: "gpt-5.6-sol" })).status,
    403,
  );
  assert.equal(
    (
      await call("builder@example.test", `/projects/${helix.id}/feedback`, {
        versionId: v.id,
        body: "Useful feedback",
        changes: false,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("builder@example.test", `/projects/${helix.id}/feedback`, {
        versionId: v.id,
        body: "Change requested",
        changes: true,
      })
    ).status,
    403,
  );
});
