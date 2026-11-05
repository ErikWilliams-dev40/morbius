# Completion plan — Mobius Godmode first release

Analysis date: 2026-11-01. Status verified locally: Prettier ✅, ESLint ✅,
`tsc --noEmit` ✅, `vinext build` ✅, 22/22 tests pass against built output.
`npm audit` ❌ — 30 advisories (see P0.1).

This plan is a working document. Per `CONTRIBUTING.md`, each task lands through
its own issue and pull request; lifecycle rule 5 keeps workflow changes in
their own PRs. Tasks are ordered by dependency and lead time, not just effort.

## Progress — updated 2026-11-01

- ✅ **P0.1** — Done: `npm audit` at zero findings; analysis in
  `docs/DEPENDENCY_REVIEW.md`.
- ✅ **P1.1** — Done: the invitations DDL was proposed and explicitly approved
  (migration `drizzle/0002_mute_ezekiel.sql`, additive-only, rollback-safe).
  Version-scoped, expiring, revocable external-reviewer invitations with
  `GET /invite/:token` (the invitee sees exactly the invited version and
  nothing else), create/revoke endpoints behind `canManage`, a handoff-tab
  UI, and `tests/invitations.test.mjs` covering every done-criterion.
- ✅ **P1.2** — Done: `POST /projects/:id/publish` publishes the decision
  record to the linked issue through a comment-only write client
  (`lib/helix/worker/github/publish.ts`), with refusal tests. UI button in the
  Developer handoff tab.
- ✅ **P1.3** — Done: the Worker's `scheduled` handler and `triggers.crons`
  advance the queue with no browser open; covered by
  `tests/scheduled.test.mjs` against built output.
- ✅ **P3.1/P3.2** — Done (code side): `wrangler.jsonc` with per-environment
  bindings, real Wrangler deploy steps in `staging-deploy` /
  `production-deploy`, and a real rollback by redeploying the target SHA (no
  migration reversal). Every deploy fails at an explicit provisioning gate
  while `wrangler.jsonc` still carries `REPLACE_AFTER_PROVISIONING`. Deploy
  and migrate commands are package scripts, per the workflow-command rule.
- ✅ **P5.1** — Done: SECURITY.md response targets committed (owner + 5/10
  business-day targets).
- ✅ **P5.3** — Done: doc drift fixed (README, SECURITY.md, LIFECYCLE.md,
  CLAUDE.md), Windows/Node notes added, `vite.config.ts` import warnings
  resolved.
- ⬜ Phases 2–4, P5.2, P5.4 — external provisioning (replace the
  `wrangler.jsonc` placeholders, Environments + secrets + `DEPLOY_BASE_URL`),
  live provider verification, staging acceptance, the first `releases/`
  record, and repository security settings.

---

## A. Already done (verified)

- **Core workflow product** — request → queue → build → versioned prototype →
  versioned feedback / request-changes → approval bound to one immutable
  version (cleared by any revision) → developer handoff export. Backend in
  `lib/server.ts` (~1,000 lines), UI in `components/workspace.tsx` (5 views:
  Development, Projects, Build queue, Companies, Connections) and
  `components/development.tsx`.
- **Queue invariants** — DB-enforced single active build and single pending
  job per project (partial unique indexes), lease-based locking, retained-slot
  behaviour for unknown provider submission outcomes, provider-side cancel.
- **AI adapter** — OpenAI Responses API in background mode, resumable by
  provider ID, revision with prior HTML + feedback, fail-closed when the
  connection is not approved, sample demo path that needs no AI account.
- **Auth and authority** — Cloudflare Access JWT verification (signature,
  issuer, audience, expiry, JWKS refresh), `sites_owner` mode that refuses to
  combine with Helix config, company scoping, four capability gates,
  same-origin mutation checks, strict preview CSP.
- **GitHub integration (read-only)** — verified open-issue requirement before
  AI work and handoff, development-status discovery over assigned repos only,
  client refuses writes and GraphQL mutations.
- **Schema and migrations** — `db/schema.ts` + two drizzle migrations.
- **Tests (22)** — full lifecycle, queue serialization, storage-failure
  recovery, AI resume / uncertain-submission / incomplete-document paths,
  JWT auth, company scoping, origin checks, GitHub integration, secret-leak
  prevention, rendered HTML, UI primitives.
- **CI** — `lint`, `test`, `build`, `security-check` run real commands;
  `deploy.yml` orchestration, SHA-immutability guards, health checks, and the
  production approval gate are functional. Deploy steps are the placeholders.

## B. Partly built

| Item | State |
| --- | --- |
| Deploy pipeline | Orchestration real; `staging-deploy`, `production-deploy`, `rollback` deploy steps are deliberate placeholders that exit 1. |
| Queue scheduling | Works only while a browser holds the workspace open (client polls `POST /api/mobius/tick`). No server-driven scheduling. |
| GitHub record publication | Handoff exports markdown and says "Mobius does not publish that record yet." No write path. |
| External reviewer invitations | Not started. Access model has `helix` and `sites_owner` only. |
| Dependency health | Was zero at #8 (2026-09-06); now 30 advisories, incl. 1 critical (`next`, runtime) and 1 high (`zod`, runtime). Gate is red. |
| SECURITY.md | Response targets deliberately unfilled; must be filled before the repo goes public. |
| Release metadata | Schema, skill, auditor exist; `releases/` directory not yet created (the first release creates it). |
| Required status checks | README says configured after #6; `docs/LIFECYCLE.md` still says deferred. Verify on the real repository and fix the drift. |

## C. Missing

1. Per-environment provisioning (Cloudflare account, D1/R2 identities, Access
   applications with their own audiences, secret manager, budget) — recorded
   by a technical admin in `.helix/project.json` (`deployTarget`/`previewUrl`
   still `null`). **The hard blocker.**
2. Real deploy commands in the three deploy workflows.
3. External reviewer invitations (version-scoped, verified email, expiry,
   revocation) — required by the definition of done.
4. Durable GitHub publication of brief, version digests, comments, and
   decision history to the linked work item — required by the definition of
   done.
5. Continuous (server-side) queue scheduling.
6. Live provider compatibility and cost measurement.
7. Browser and staging acceptance (definition of done says: observed in
   staging, not only in local tests).

---

## Plan (priority order)

### Phase 0 — Restore the merge gate (do first; blocks every other PR)

**P0.1 Dependency remediation with reachable-path analysis.**
Update same-major ranges in the lockfile: `next` → 16.4.3 (critical advisory,
runtime dependency), `vite` → 8.3.5, `wrangler` → 4.156.1 (pulls fixed
miniflare/sharp/undici), `@cloudflare/vite-plugin` → 1.67.0, plus transitive
`brace-expansion` / `source-map-js` fixes. Treat `zod` 3 → 4 as its own
reviewed change or record a written justification for accepting it. Never
`npm audit fix --force`. Per-package analysis: what runs in the Worker
(`next`, `zod`) versus build/dev only (`wrangler`, `miniflare`, `sharp` via
miniflare, `vite`, the eslint chain).
- **Done when:** `npm audit` reports zero findings, or each remaining finding
  has a written reachable-path justification and technical-admin sign-off;
  `npm run format:check && npm run lint && npm run typecheck` and
  `npm test` all pass on the updated lockfile.

### Phase 1 — Definition-of-done features (start now; parallel with Phase 2)

**P1.1 External reviewer invitations.**
Invite scoped to exactly one version of one project; verified email; expiry;
revocation; invitee may open only the invited version's preview — nothing
else. Follow the trap in `CLAUDE.md`: never grant a project where a version
was intended.
- **Done when:** tests cover: invitee sees exactly the invited version and
  403/404 on everything else; access ends at expiry; revocation is immediate;
  invitation cannot be widened to later versions.

**P1.2 GitHub publication of the decision record.**
Post brief, approved-version digest, feedback, and decision history to the
linked issue (as a comment or issue body update). Authority boundary: this is
record publication for handoff only — no merges, no code writes, no deploys.
A change that lets Mobius act on a repository passes the governance gate
described in `CLAUDE.md` ("Where that gate lives") and gets technical-admin
review. Use a dedicated narrowly-scoped credential (issues write on assigned
repos only).
- **Done when:** `GET /projects/:id/handoff` (or a new publish action)
  publishes the record to the verified linked issue and the export confirms
  it; tests prove the token cannot write repository contents, merge, or act
  on unassigned repos.

**P1.3 Continuous queue scheduling.**
Add server-driven scheduling (Cloudflare Cron Trigger or queue consumer
calling the existing `tick()`), keeping client polling as a fallback. Keep the
retained-slot behaviour and its test untouched.
- **Done when:** an enqueued build completes with no browser open (unit test
  for the scheduler entry plus staging observation); existing queue tests
  unchanged and green.

### Phase 2 — Provisioning (long external lead time; start immediately)

**P2.1 Cloudflare per-environment provisioning.**
Account; D1 database and R2 bucket per environment (bindings stay `DB` /
`BUCKET`); Access application per hostname with its own audience (do not widen
the existing Helix Access policy); secret manager entries (`OPENAI_API_KEY`,
`HELIX_GITHUB_READ_TOKEN`, config vars from `.env.example`); operating budget.
Technical admin records `deployTarget` and `previewUrl` in
`.helix/project.json`.
- **Done when:** `.helix/project.json` has non-null, verified values
  (CODEOWNERS-governed edit); `wrangler deploy` succeeds manually against
  staging with secrets resolving (watch for the empty-string secret trap
  noted in `staging-deploy.yml`).

**P2.2 GitHub environment and protection verification.**
`staging` and `production` Environments with deploy secrets; required
reviewers on `production`; confirm branch protection and the four required
status check names off a real `pr-checks.yml` run (LIFECYCLE.md sequence);
confirm a failing check blocks merge with a second PR.
- **Done when:** names are observed strings, second PR proves the gate bites,
  and `docs/LIFECYCLE.md` / `README.md` agree on the status.

### Phase 3 — Deploy pipeline (depends on Phase 2)

**P3.1 Real deploy steps.** Replace the CUSTOMIZE step in `staging-deploy.yml`
and `production-deploy.yml` with the Wrangler CLI deploy (prefer OIDC over
long-lived tokens), applying D1 migrations per the migration policy in
`CLAUDE.md`; set the `url` output. Workflow changes ship in their own PR
(lifecycle rule 5).
- **Done when:** `deploy.yml` dispatch deploys the exact reviewed SHA to
  staging, `staging-health-check` passes against the output URL, and a SHA
  mismatch is refused.

**P3.2 Rollback decision.** Implement the Wrangler-based rollback (redeploy
last known-good SHA) or delete `rollback.yml` and say so in the README —
never leave a rollback that pretends to work.
- **Done when:** either a rollback is rehearsed in staging, or the README
  states rollback is unsupported and why.

### Phase 4 — Live verification and acceptance (depends on Phases 1–3)

**P4.1 Live provider compatibility and cost.** Verify the model list
(`gpt-5.6-sol`, `gpt-5.6-terra`) against the real Responses API: background
mode, 16k output cap, cancel, delete, resume. Measure cost per build at the
26–100 builds/week scope.
- **Done when:** one real AI build completes end-to-end in staging; recorded
  cost and latency per build; model list adjusted to models the account can
  actually call.

**P4.2 Browser and staging acceptance (the definition of done).**
In staging, with real sign-in: two requests queue without overlapping active
jobs; approval on N is cleared by N+1; an external invitee opens exactly the
invited version and loses access at expiry/revocation; the record is durably
linked to the GitHub work item. Cross-browser smoke: Chromium, Firefox,
Safari, one mobile viewport.
- **Done when:** every clause of "Definition of done, first release" in
  `CLAUDE.md` is observed in staging and recorded (screenshots/notes in the
  release record).

**P4.3 First production release.** `deploy.yml` with `deploy-production`,
business approver (`helixadmin@houseofhelixpeptides.com`) approving the
`production` Environment, `production-health-check` green.
- **Done when:** production serves the approved SHA; health check passes;
  release metadata record written.

### Phase 5 — Release hygiene (parallel with Phase 4)

**P5.1** Fill `SECURITY.md` response targets and commit to them before the
repository is made public (security owner named, response timeline).

**P5.2** Create `releases/` with the first append-only release-metadata
record for the released commit (use the `release-metadata` skill and
`release-auditor`).

**P5.3** Fix documentation drift: `docs/LIFECYCLE.md` required-checks section
vs README; `SECURITY.md` line claiming the checks are placeholders (stale
since #6); README's "npm audit reports zero findings" (stale today); add a
Windows note that `dev`/`build`/`lint` scripts need a POSIX shell.

**P5.4** Enable repository security settings: secret scanning + push
protection, dependency alerts, private vulnerability reporting, CodeQL (via
settings, not workflows). Launch checklist sign-off against the definition of
done.

---

## Known bugs and defects found during this review

1. **Security gate red:** `npm audit` = 30 advisories (1 critical `next`, 1
   high `zod`, both runtime; rest dev toolchain). `security-check` runs
   `npm audit` with no severity floor, so CI would fail today. → P0.1.
2. **Doc drift** on required status checks (LIFECYCLE.md vs README) and on
   gate status in SECURITY.md. → P5.3.
3. **Windows portability:** `npm run dev`, `build`, `lint` are POSIX-wrapped
   and fail under cmd/PowerShell (env-prefix syntax, bash scripts, GNU
   `timeout`). CI is ubuntu so this is local-only. → P5.3 (document).
4. **Vite config future-breakage warnings:** JSON import without
   `with { type: "json" }`, extension-less import in `vite.config.ts`.
5. **Node engine:** project requires `^24.19.0`; document for CI and local.
