import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "./fixtures.mjs";

const html =
  "<!doctype html><html><head><title>Demo</title></head><body><h1>Version one</h1></body></html>";

test("an invitation opens exactly the invited version and nothing else", async (context) => {
  const f = fixture(context);
  const p = await f.create();
  const v1 = await f.ok(`/projects/${p.id}/upload`, { html, label: "First prototype" });
  const inv = await f.ok(`/projects/${p.id}/invitations`, {
    versionId: v1.id,
    email: "Reviewer@Example.test",
    expiresInDays: 14,
  });
  assert.ok(inv.token.length >= 64, "the raw token is returned exactly once");
  assert.ok(inv.expiresAt > Date.now(), "the invitation carries an expiry");

  // The stored record keeps only a hash; the raw token never comes back.
  const detail = await f.ok(`/projects/${p.id}`);
  assert.equal(detail.invitations.length, 1);
  assert.equal(detail.invitations[0].email, "reviewer@example.test");
  assert.equal(detail.invitations[0].version_id, v1.id);
  assert.ok(!("token_hash" in detail.invitations[0]), "no token hash in the API response");

  // The invitee opens the invited version's HTML with no workspace identity.
  const page = await f.request(`/invite/${inv.token}`, undefined, {
    headers: { "oai-authenticated-user-id": "", "oai-authenticated-user-email": "" },
  });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Version one/);

  // A later version must not widen the invitation: it still serves v1 only.
  await f.ok(`/projects/${p.id}/upload`, {
    html: html.replace("Version one", "Version two"),
    label: "Second prototype",
  });
  const again = await f.request(`/invite/${inv.token}`);
  assert.equal(again.status, 200);
  const body = await again.text();
  assert.match(body, /Version one/);
  assert.doesNotMatch(body, /Version two/);

  // The token grants no API access and no workspace preview.
  const state = await f.request("/state", undefined, {
    headers: { "oai-authenticated-user-id": "" },
  });
  assert.equal(state.status, 401);
  const preview = await f.request(`/preview/${v1.id}`, undefined, {
    headers: { "oai-authenticated-user-id": "" },
  });
  assert.equal(preview.status, 401);
});

test("invitations expire, revoke immediately, and cannot span projects", async (context) => {
  const f = fixture(context);
  const p = await f.create();
  const v1 = await f.ok(`/projects/${p.id}/upload`, { html, label: "First prototype" });
  const inv = await f.ok(`/projects/${p.id}/invitations`, {
    versionId: v1.id,
    email: "reviewer@example.test",
    expiresInDays: 14,
  });

  // An unknown or truncated token is invalid.
  assert.equal((await f.request("/invite/not-a-real-token")).status, 404);
  assert.equal((await f.request("/invite/")).status, 404);

  // Expiry ends access.
  f.db.prepare("UPDATE invitations SET expires_at=1 WHERE id=?").run(inv.id);
  assert.equal((await f.request(`/invite/${inv.token}`)).status, 410);
  f.db.prepare("UPDATE invitations SET expires_at=? WHERE id=?").run(Date.now() + 86400000, inv.id);
  assert.equal((await f.request(`/invite/${inv.token}`)).status, 200);

  // Revocation is immediate and idempotent.
  await f.ok(`/invitations/${inv.id}/revoke`, {});
  assert.equal((await f.request(`/invite/${inv.token}`)).status, 410);
  await f.ok(`/invitations/${inv.id}/revoke`, {});
  const detail = await f.ok(`/projects/${p.id}`);
  assert.ok(detail.invitations[0].revoked_at, "the revocation is recorded");

  // A version from another project cannot be invited under this project.
  const other = await f.create("Another request");
  const otherVersion = await f.ok(`/projects/${other.id}/upload`, {
    html: html.replace("Version one", "Other project"),
    label: "Other prototype",
  });
  assert.equal(
    (
      await f.request(`/projects/${p.id}/invitations`, {
        versionId: otherVersion.id,
        email: "reviewer@example.test",
      })
    ).status,
    404,
  );

  // Revoking something that does not exist is a 404.
  assert.equal(
    (await f.request("/invitations/00000000-0000-4000-8000-000000000000/revoke", {})).status,
    404,
  );
});
