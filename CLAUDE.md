# CLAUDE.md — Mobius Godmode

Mobius is the shared path from a request for a new project or a change to a
clickable demo, versioned feedback, prototype approval, and developer handoff.
It feeds the existing Helix engineering workflow; release authority stays in
Helix Development Control.

The delivery lifecycle this project follows is specified in
[`docs/LIFECYCLE.md`](docs/LIFECYCLE.md). This file is the domain contract and
the project-specific half of that policy. The architecture decision it
implements is
[ADR-0001 in helix-engineering](https://github.com/House-of-Helix-CMD/helix-engineering/pull/20),
tracked by
[helix-engineering#19](https://github.com/House-of-Helix-CMD/helix-engineering/issues/19).

---

## Project

- **What this is:** a prototype-workflow application. Permitted staff request
  new projects or changes; a constrained AI adapter generates clickable demos
  with sample data; reviewers leave versioned feedback; an approver binds
  approval to one immutable version; human developers implement the approved
  design for production through the normal Helix lifecycle.
- **Stack:** React 19 with Next.js App Router conventions, built and served
  by Vinext on Vite 8 (so `next` is a real runtime dependency, not a stray);
  one Cloudflare Worker entry that serves the app and the `/api/mobius/` and
  `/preview/` routes; D1 for workflow records with drizzle-orm and drizzle-kit
  migrations; R2 for stored HTML prototype versions; Wrangler 4 for the
  Worker toolchain; Cloudflare Access JWTs for staff identity; the OpenAI
  Responses API, in background mode, as the constrained AI provider. Node
  `24.19.0`, npm. The manifest and lockfile landed with #8.
- **Hosting:** decided 2026-09-06 — Cloudflare Workers with Wrangler, D1, R2,
  and Vite. Hermes and Hostinger are no longer candidates. What is still
  *not* decided is the per-environment provisioning: account, D1 database
  and R2 bucket identities, the Access application and audience for each
  hostname, and the secret manager. `deployTarget` and `previewUrl` in
  [`.helix/project.json`](.helix/project.json) stay `null` until a technical
  admin records them (that file is CODEOWNERS-governed), and the three deploy
  workflows stay placeholders until the Wrangler deploy step is written.
- **Owner:** the Helix technical admins (`@House-of-Helix-CMD/technical-admins`)
  own the pipeline; the application developer is assigned on #1. The named
  business approver is `helixadmin@houseofhelixpeptides.com`, per
  `.helix/project.json`.

## Commands

**These are the scripts in `package.json`, imported by #8, and the commands
the four check workflows run since #6.** Lifecycle rule 5 means a workflow
change ships in its own pull request, so a script and the workflow that calls
it cannot literally move together. The discipline: **the pull request that
changes what a workflow runs is the one that updates this table**, and no
workflow may run a command that `package.json` does not also define as a
script. If the two drift, CI and local runs stop agreeing and the AI review
gate loses its reference point.

| Task | Command |
| --- | --- |
| Install | `npm ci` (Node `24.19.0`, from the lockfile — never `npm install` in CI) |
| Lint | `npm run format:check && npm run lint && npm run typecheck` — Prettier, ESLint (`eslint-config-next`), `tsc --noEmit` |
| Test | `npm run test:built` — `node --test tests/*.test.mjs` against the built output; `npm test` runs the build first |
| Build | `npm run build` — bounded `vinext build`, Worker and client |
| Run locally | `npm run dev` — Vite dev server with the Cloudflare plugin emulating D1 and R2 under `.wrangler/` |

`lint`, `typecheck`, and `format:check` are separate scripts; the `lint`
workflow runs all three. `test:built` depends on `build` having run, so the
`test` job must build first or call `npm test`.

The security gate runs `npm audit` plus the authorization and integration tests
(`tests/helix-auth.test.mjs`, `tests/helix-integration.test.mjs`,
`tests/workflow.test.mjs`). Audit failures propagate; there is no
`--audit-level` relaxation, no `|| true`, and no suppression file. The tests
run before the audit so a failing test is visible even when the audit also
fails. `npm audit` reports zero findings since #8; a new finding is resolved or
documented with a reachable-path analysis, never suppressed.

Two scripts in the package are wrappers from a sandboxed preview environment:
`install:ci` and `build` route through `scripts/sites-env.sh`, which relocates
`HOME`, the npm cache, and Wrangler state under `.sites-runtime/`. #6 kept
`npm run build` (the wrapper also bounds the build with `SITES_BUILD_TIMEOUT`,
which the `build` and `test` jobs set) and used plain `npm ci` rather than
`install:ci`. The wrappers need `bash`, `flock`, and `timeout`, so the build
runs on Linux or WSL, not native Windows.

### Operational commands

Not CI gates. Do not wire these into `pr-checks.yml`.

- `npm run db:generate` — drizzle-kit generates a migration from
  `db/schema.ts` into `drizzle/`. Generating is fine; applying is a human
  step via Wrangler — see [Database migrations](#database-migrations).
- `npm run start` — `vinext start`, a local production-mode server; not the
  deploy mechanism.

### Open toolchain decisions

Decided:

- **Host.** Cloudflare Workers, Wrangler, D1, R2, Vite (2026-09-06).
- **Toolchain setup in CI.** The check workflows need Node `24.19.0` on the
  runner. The template allows only `actions/checkout`; #6 added the
  GitHub-owned `actions/setup-node`, pinned to a full commit SHA, the same
  supply-chain decision compound-reference made for `setup-go`, and said so
  explicitly in its PR body. It remains the one addition beyond
  `actions/checkout`.
- **Validating workflow changes against the source.** #6's workflow changes
  did not merge through #8's branch. A throwaway harness PR (#7) combined
  #6's workflows with #8's source so the four gates ran once with real code
  present, and a second (#9) re-ran them for #8 itself; both were closed once
  the results were read, as compound-reference did. The same pattern applies
  to any future workflow change that cannot be exercised on its own branch.
- **Dependency audit baseline.** The first audit of the prepared source
  reported 17 high, 5 moderate, and 1 low advisory. #8 resolved all of them
  (closing #4) with a non-forced `npm audit fix` for transitive packages, then
  reviewed same-major upgrades of the framework stack — `next`, `react`,
  `react-dom`, `react-server-dom-webpack`, `vite`, `vinext`,
  `@vitejs/plugin-rsc`, `@cloudflare/vite-plugin`, `wrangler`,
  `eslint-config-next` — verified by build and tests, plus one `overrides`
  entry pinning `esbuild` under `@esbuild-kit/core-utils`. The reachable-path
  facts still hold for the next finding: `next` is a genuine runtime
  dependency (App Router conventions on Vinext); `react-server-dom-webpack` is
  a devDependency required by `vinext` and `@vitejs/plugin-rsc`; `vite`,
  `wrangler`, `@cloudflare/vite-plugin`, `drizzle-kit`, and `vinext` are
  build-time only. Never `npm audit fix --force`: it rewrites the manifest and
  lockfile across majors and, on this stack, broke `vinext` against
  `@vitejs/plugin-rsc`.
- **Node engine pin.** `.nvmrc` carries `24.19.0`, the version the check
  workflows install, so version managers pick it up; `engines.node` is
  `^24.19.0`, so an older Node 24 warns on install while later 24.x patches
  do not. `engine-strict` is off. Moving CI to a newer Node is a workflow
  change (rule 5) and `.nvmrc` moves with it.

Open: nothing at present.

## Layout

From the source as imported by #8 on 2026-09-06.

```
app/                   Next.js App Router shell (layout, page, Access sign-in)
components/
  workspace.tsx        the working surface — request, queue, review, approve, handoff
  development.tsx      developer handoff view
  ui/                  shadcn primitives, vendored verbatim (lint rules relaxed there only)
lib/
  access.ts            Cloudflare Access JWT verification — identity
  domain.ts            roles, company scope, action permissions — authorization
  server.ts            the API: queue, versions, feedback, approval, provider adapter, preview CSP
  helix.ts             read-only Helix status adapter
  helix/               control-plane modules adapted for Mobius; source-manifest.json hashes the originals
db/schema.ts           drizzle schema for D1
drizzle/               generated migrations (two so far, schema-only)
worker/index.ts        the Worker entry: routes /api/mobius/ and /preview/ to lib/server, the rest to Vinext
hooks/                 use-mobile.ts
public/                static assets
vendor/                shadcn-tailwind-4.13.0.css — shadcn's base stylesheet, pinned by content hash
tests/*.test.mjs       node --test: auth, integration, workflow, rendered HTML, UI primitives
scripts/               install/build wrappers for the sandboxed preview environment
build/                 Vite plugin for that environment
docs/                  lifecycle documentation (template); docs/review/ holds the package's review notes
REVIEW-PACKAGE-MANIFEST.json   sha256 of every imported file, for verifying the import against the package
```

Two things in the review package must **not** be imported as-is:
`.github/workflows/checks.yml` and `pull-request-checks.yml` (rule 5 and
CODEOWNERS — the template's reusable workflows are the pipeline, and #6 made
them real), and `.openai/hosting.json`, whose binding names belong in the
Wrangler configuration, not a vendor-named directory. #8 imported neither.

Runtime data — the D1 database, R2 objects, `.wrangler/` and `.sites-runtime/`
state, caches, and build output — is never committed. See `.gitignore`.

---

## Lifecycle rules

These apply regardless of stack. Do not remove them.

1. **Work starts from an issue.** No branch without a tracking issue.
2. **Branch from the default branch.** Naming: `<type>/<issue-number>-<slug>`,
   e.g. `feat/142-token-refresh`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`.
3. **Never commit directly to the default branch.** Every change lands via pull
   request.
4. **One PR, one concern.** If a PR needs two paragraphs to explain why it
   touches unrelated areas, split it.
5. **Do not edit `.github/workflows/` as a side effect** of a feature change.
   Workflow changes ship in their own PR so they are reviewed on their own terms.
6. **Do not weaken a `permissions:` block** to make a job pass. Escalating a
   workflow's token scope is a security change and needs its own PR and review.
7. **Never hardcode a secret.** Read from GitHub Actions secrets or the
   platform's secret store. If you need a new secret, say so in the PR body
   rather than inventing a value.
8. **Release metadata is append-only.** Records in `releases/` are written once
   and never edited. `commit_sha` identifies the record. See
   [`docs/RELEASE_METADATA.md`](docs/RELEASE_METADATA.md).

## Database migrations

**Don't write migrations unattended. Propose the DDL and wait.** This project
rule is stricter than the org policy below and is not displaced by it.

Any change that adds, alters, or drops D1 schema must additionally:

- set `database_migration: true` in the release metadata record,
- state in the PR body whether the migration is backward compatible,
- state whether rollback is safe; if it is not, set `rollback_safe: false`.

A destructive migration makes a release non-rollback-safe. Say so explicitly
rather than leaving it implied.

D1 has no built-in point-in-time rollback of a migration, and the R2 objects a
version row points at are not transactional with the row. `rollback_safe`
defaults to `false` in the schema, and for this project that default is
usually the honest value. The question is specific: if the previous Worker were
redeployed unchanged right now, would it run correctly against the schema, the
rows, and the R2 objects this release leaves behind?

## Review gates

A change reaches production only after all of these:

| Gate | Who or what |
| --- | --- |
| Automated checks | `lint`, `test`, `build`, `security-check` |
| AI review | `.claude/agents/security-reviewer.md` |
| Peer approval | a human owner (see `CODEOWNERS.example`; not yet operational) |
| Staging verification | `staging-deploy` + `staging-health-check` |
| Business approval | required reviewer on the `production` Environment |
| Production health | `production-health-check` |

Full description: [`docs/LIFECYCLE.md`](docs/LIFECYCLE.md).

One qualification for this repository: `.github/CODEOWNERS` **is** present and
was provisioned by the Helix control plane, but it covers only `/.github/`,
`/.helix/`, and `/CODEOWNERS` — the paths that decide how the project is built
and released, reserved to `@House-of-Helix-CMD/technical-admins`. Feature code
has no code owner, so peer approval on ordinary changes remains a convention
between developers, not a rule GitHub enforces.

## When asked to deploy

Do not run deploy workflows on your own initiative. Deploys are triggered by a
human via `workflow_dispatch`, and production additionally requires the
Environment reviewer to approve. If asked to "ship it," prepare the release
metadata record and report what is still missing.

---

## What this actually is

A gated queue in front of an AI prototype generator, with a durable decision
record. The distinction drives every decision below: Mobius produces
*approved prototypes*, never releases. A prototype approval is a design
decision that a human developer then implements through the Helix lifecycle.
If a task pushes Mobius toward deploying, publishing, or writing to a
repository on its own, that's the wrong direction.

## The authority boundary

Prototype approval and production release authority are separate, by decision
(ADR-0001). Mobius may record that a version is approved for implementation. It
may not merge, deploy, purchase, or provision anything. Release authority stays
with Helix Development Control and the `production` Environment reviewer.

**Where that gate lives.** Any change that lets Mobius act on a repository, a
host, or a provider account — beyond reading status and submitting a
generation request — sets `business_approval_required: true` in the release
metadata record and needs the ADR revisited first.

## Hard rules

**Identity is validated server-side, then permissions are checked
independently.** Staff identity comes from the bounded Helix authentication
adapter. Company scope and action permission are checked separately on every
request. Repository teams do not implicitly grant application roles. A
client-side check is not a check.

**Approval binds to one immutable version and its content digest.** A revision
clears approval. There is no path that carries an approval forward to new
bytes, and approval is a distinct permission from review or build.

**One active build.** Requests queue; nothing overlaps the active job. When the
provider's submission status is uncertain, the build slot is *retained*, not
released — an ambiguous state must never let two jobs run.

**The AI adapter generates sample-data prototypes and nothing else.** No
repository write, no shell, no purchase, no deployment capability, in any
environment. Do not add a "just this once" capability behind a flag.

**Generated HTML renders in an isolated sandbox.** Prototype output is
untrusted content. It never executes in the origin of the application or with
a reviewer's credentials.

**Prototype bytes, records, and feedback stay within assigned access.** An
external reviewer sees exactly the project/version they were invited to, with
verified email, an expiry, and a revocation path. Invitations never widen the
staff admission policy.

**The Helix adapters are read-only.** Mobius reads engineering status; it does
not write it.

## Data model

D1 for workflow records; R2 for rendered HTML versions. The tables, from
`db/schema.ts` and the two migrations in `drizzle/`:

- **`projects`** — the work item: type (new project or change), company scope,
  creator, `issue_url` (the linked GitHub issue, required before AI work or
  handoff), and `approved_version` — approval is a pointer on the project to
  exactly one version, cleared when a new version lands.
- **`jobs`** — the queue: `status`, `phase`, `lease`, and `provider_id`. One
  active lease at a time. An unknown provider outcome keeps the lease until an
  admin confirms the provider request has stopped.
- **`versions`** — immutable, with a content `digest` and the R2 object key of
  the rendered HTML.
- **`comments`** — feedback bound to a `version_id`.
- **`activity`** — append-only per-project history of every transition.
- **`workspace`**, **`settings`** — configuration rows.

Not yet modelled, carried as first-release gaps: **invitations** (external
reviewer grants with verified email, expiry, revocation) and **GitHub
publication** of briefs, digests, comments, and decisions back to the issue.

## Conventions

**Commits and branches** follow [`CONTRIBUTING.md`](CONTRIBUTING.md): imperative
subject under ~72 characters with no trailing period, body explaining *why*, and
`Refs #N` or `Closes #N`. The branch prefix (`feat`, `fix`, `chore`, `docs`,
`refactor`) already carries the change type, so commit subjects do not repeat it.

**Project practice:**

- Tests first on authorization, company scoping, version approval, and the
  queue's uncertain-submission path. These are the controls.
- Exact versions in `package.json` and the lockfile. Treat npm's suggested
  downgrades or major upgrades as proposals to review against upstream release
  notes, not as automated fixes.
- Every state transition writes an audit row.

**Pipeline**, from [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md):

- No third-party GitHub Actions. `actions/checkout` and the GitHub-owned
  `actions/setup-node` only, both pinned to a full commit SHA rather than a
  movable tag. `setup-node` was the one addition, made in #6.
- Workflow inputs are `kebab-case` under every trigger. Release metadata fields
  are `snake_case` and deliberately do not track the input names.
- Every job sets `timeout-minutes`.
- Deploy targets are always full 40-character SHAs, never branches or tags.
- Pass untrusted values through `env:` rather than interpolating `${{ }}`
  straight into a `run:` script.

**Secrets and runtime configuration.** `.env.example` in the source lists
names only; values live in the platform's secret store per environment. The
two real credentials are `OPENAI_API_KEY` and `HELIX_GITHUB_READ_TOKEN` — a
dedicated read-only token scoped to assigned repositories, never the existing
dashboard's write credential. The rest is configuration: `MOBIUS_AUTH_MODE`,
`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, the `*_EMAILS` role allowlists,
`MOBIUS_MEMBER_SCOPES`, `MOBIUS_COMPANY_REPOS`, and the two
`MOBIUS_*_APPROVED` flags that a technical admin sets to record approval of
the GitHub and AI integrations. The D1 binding is `DB`, the R2 binding is
`BUCKET`. Same names on `staging` and `production`, different values. Read
them inside the deploy workflow, by the job that binds the environment. Never
forward them from `deploy.yml` (a caller job cannot declare `environment:`, so
the value silently resolves to an empty string), and never `secrets: inherit`.

## First release

**Scope.** New projects and existing-project changes; clickable demos with
sample data, simulated interactions, and versioned feedback; 1–5 internal
staff; 26–100 build/revision requests per week; one active build; human
developers implement production.

**Still unfinished, and carried as issues rather than hidden:** GitHub
publication of briefs, versions, feedback, and decisions; scoped external
reviewer invitations with verified email, expiry, and revocation; continuous
queue scheduling; approved per-environment hosting, storage, runtime
identities, and secret manager; live provider compatibility and cost
measurement; browser and staging acceptance.

**Sequence, as it happened on 2026-09-06.** #6 turned the check workflows
real in a separate PR against `main` (closing #3), validated by harness PR #7
and merged with the one recorded administrator bypass the placeholders made
unavoidable. #8 imported the source for technical review without the
package's own workflow files, resolved the dependency audit on the same
branch (closing #2 and #4), and merged with all four checks green. #5 landed
this contract. No purchase, runtime provisioning, release approval, or
deployment was part of any of them, and none has happened since.

## Traps

- Prior local test results are evidence about mocked behaviour, not release
  approval. Remote CI, independent technical-admin review, live provider
  verification, and staging acceptance are separate and all still pending.
- An audit count is not an exploit count. The original 23 advisory entries
  are gone, but the next one still needs a reachable-path analysis per
  package — what runs in the Worker versus on a developer's machine — before
  anyone reaches for a version bump, and never `npm audit fix --force`.
- "Simplifying" the uncertain-submission path is exactly where a second active
  build slips in. Keep the retained-slot behaviour and its test.
- An invitation that grants a project rather than a version quietly extends to
  future versions the inviter never saw.
- The review package's `MOBIUS_AUTH_MODE=sites_owner` is a single-owner mode
  for the sandboxed preview environment. It refuses to run alongside Helix
  Access configuration, and that refusal is the control. Never switch modes to
  get past a failed sign-in.
- The existing Helix Access policy admits three email addresses for 24 hours
  with policy-level MFA off. Mobius must not widen that policy for external
  reviewers, and the Mobius Access application needs its own audience.

## Definition of done, first release

Two requests queue without overlapping active jobs. An approval on version N
is cleared by version N+1, in test. An external invitee with a verified email
can open exactly the invited version and nothing else, and loses access at
expiry or revocation. The brief, version digest, comments, and decision history
are durably linked to the GitHub work item. All of it observed in staging, not
only in local tests.
