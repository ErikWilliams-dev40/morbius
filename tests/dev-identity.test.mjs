import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { isLoopbackRequest, readDevVars } from "../build/dev-identity-vite-plugin.ts";

function project(files) {
  const root = mkdtempSync(path.join(tmpdir(), "mobius-dev-vars-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(path.join(root, name), body);
  return root;
}
function request(host) {
  return { headers: host === undefined ? {} : { host } };
}

test("reads Wrangler's .dev.vars format", () => {
  const root = project({
    ".dev.vars": [
      "# local only",
      "MOBIUS_AUTH_MODE=sites_owner",
      "",
      "  MOBIUS_REVIEW_OWNER_ID = local-dev  ",
      "MOBIUS_DEV_EMAIL='dev@localhost'",
      'QUOTED="value with spaces"',
      "not a valid line",
    ].join("\n"),
  });
  assert.deepEqual(readDevVars(root), {
    MOBIUS_AUTH_MODE: "sites_owner",
    MOBIUS_REVIEW_OWNER_ID: "local-dev",
    MOBIUS_DEV_EMAIL: "dev@localhost",
    QUOTED: "value with spaces",
  });
});

test("no .dev.vars means no local identity, never a fallback", () => {
  assert.deepEqual(readDevVars(project({})), {});
  assert.deepEqual(readDevVars(project({ ".dev.vars": "" })), {});
});

test("the local identity is only supplied to loopback requests", () => {
  for (const host of ["localhost:5173", "127.0.0.1:5173", "[::1]:5173", "LOCALHOST:5173"])
    assert.equal(isLoopbackRequest(request(host)), true, host);
  for (const host of ["mobius.example.com", "10.0.0.5:5173", "localhost.example.com:5173"])
    assert.equal(isLoopbackRequest(request(host)), false, host);
  assert.equal(isLoopbackRequest(request(undefined)), false);
});
