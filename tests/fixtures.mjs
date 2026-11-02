import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { handleMobius } from "../lib/server.ts";

export function githubFixture(url) {
  return Response.json({
    html_url: String(url).replace("https://api.github.com/repos/", "https://github.com/"),
    state: "open",
  });
}
export function mockServices(
  context,
  provider = async () => {
    throw new Error("Unexpected provider request");
  },
) {
  const tracked = context.mock.fn(provider);
  context.mock.method(globalThis, "fetch", (url, options = {}) =>
    String(url).startsWith("https://api.github.com/repos/")
      ? githubFixture(url)
      : tracked(url, options),
  );
  return tracked;
}

export function fixture(context) {
  let clock = 1800000000000,
    ids = 0;
  context.mock.method(Date, "now", () => ++clock);
  context.mock.method(
    crypto,
    "randomUUID",
    () => `00000000-0000-4000-8000-${(++ids).toString(16).padStart(12, "0")}`,
  );
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../drizzle/", import.meta.url))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(
      readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
  function prepare(sql, values = []) {
    return {
      bind(...args) {
        return prepare(sql, args);
      },
      async first() {
        return db.prepare(sql).get(...values) || null;
      },
      async all() {
        return { results: db.prepare(sql).all(...values), meta: { changes: 0 } };
      },
      async run() {
        const r = db.prepare(sql).run(...values);
        return { results: [], meta: { changes: Number(r.changes) } };
      },
      execute() {
        const r = db.prepare(sql).run(...values);
        return { results: [], meta: { changes: Number(r.changes) } };
      },
    };
  }
  const objects = new Map();
  const env = {
    MOBIUS_AUTH_MODE: "sites_owner",
    MOBIUS_REVIEW_OWNER_ID: "owner-stable-id",
    HELIX_GITHUB_READ_TOKEN: "SYNTHETIC_GITHUB_TEST_VALUE",
    MOBIUS_GITHUB_APPROVED: "true",
    MOBIUS_COMPANY_REPOS: JSON.stringify({ helix: ["test-project"], halo: ["test-halo"] }),
    DB: {
      prepare,
      async batch(statements) {
        db.exec("BEGIN");
        try {
          const result = statements.map((s) => s.execute());
          db.exec("COMMIT");
          return result;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
    BUCKET: {
      async get(key) {
        return objects.has(key)
          ? {
              async text() {
                return objects.get(key);
              },
            }
          : null;
      },
      async put(key, value) {
        objects.set(key, value);
      },
      async delete(key) {
        objects.delete(key);
      },
    },
    OPENAI_API_KEY: "UNIT_TEST_VALUE_NOT_A_CREDENTIAL",
    MOBIUS_AI_APPROVED: "true",
  };
  async function request(path, body, options = {}) {
    return handleMobius(
      new Request(
        `https://mobius.test${path.startsWith("/preview/") ? path : "/api/mobius" + path}`,
        {
          method: body === undefined ? "GET" : "POST",
          headers: {
            "oai-authenticated-user-id": "owner-stable-id",
            "oai-authenticated-user-email": "owner@example.test",
            ...(body === undefined
              ? {}
              : { Origin: "https://mobius.test", "Content-Type": "application/json" }),
            ...options.headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      ),
      env,
    );
  }
  async function ok(path, body) {
    const r = await request(path, body);
    const data = await r.json();
    assert.ok(r.ok, `${r.status}: ${JSON.stringify(data)}`);
    return data;
  }
  const network = mockServices(context);
  async function create(title = "Product finder") {
    return ok("/projects", {
      title,
      company: "helix",
      kind: "change",
      brief: "Help visitors compare options and try a simulated sample cart.",
      criteria: "Filter and compare options.",
      reference: "https://example.test/products",
      issueUrl: "https://github.com/House-of-Helix-CMD/test-project/issues/1",
    });
  }
  return { env, db, objects, request, ok, create, network };
}
