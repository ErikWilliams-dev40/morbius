import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "./fixtures.mjs";

test("the cron scheduled handler completes a queued build with no client request", async (context) => {
  const f = fixture(context);
  const p = await f.create();
  await f.ok(`/projects/${p.id}/enqueue`, { mode: "sample", prompt: "" });

  // From here on there is no HTTP request into the API: only the Worker's
  // scheduled entry may advance the queue.
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  assert.equal(typeof worker.scheduled, "function", "the Worker exposes a scheduled handler");

  await worker.scheduled({ scheduledTime: Date.now(), cron: "* * * * *" }, f.env, {
    waitUntil() {},
    passThroughOnException() {},
  });

  const job = f.db.prepare("SELECT * FROM jobs").get();
  assert.equal(job.status, "complete");
  assert.equal(job.phase, "Ready for review");
  const version = f.db.prepare("SELECT * FROM versions").get();
  assert.ok(version, "the prototype version was saved");
  assert.equal(version.source, "sample");
  const project = f.db.prepare("SELECT * FROM projects").get();
  assert.equal(project.status, "review");

  // A second tick with an empty queue is a no-op.
  await worker.scheduled({ scheduledTime: Date.now(), cron: "* * * * *" }, f.env, {
    waitUntil() {},
    passThroughOnException() {},
  });
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM versions").get().n, 1);
});
