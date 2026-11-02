# Mobius Godmode

The shared path from a request for a new project or a change to a clickable
demo, versioned feedback, prototype approval, and developer handoff — a gated
queue in front of an AI prototype generator, with a durable decision record.

Mobius produces *approved prototypes*, never releases. Approval binds to one
immutable version; a revision clears it; human developers implement the
approved design through the existing Helix engineering workflow, where release
authority stays.

**Start here:** [`CLAUDE.md`](CLAUDE.md) is the domain contract — hard rules,
authority boundary, data model, and the first-release sequence. Read it before
writing anything.

| Document | What it covers |
| --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | Domain rules, stack, commands, layout, first-release scope |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How a change moves from issue to merge |
| [`docs/LIFECYCLE.md`](docs/LIFECYCLE.md) | The gates, and what enforces each |
| [`docs/RELEASE_METADATA.md`](docs/RELEASE_METADATA.md) | Why the commit SHA is immutable |
| [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md) | The eleven workflow files and their permissions |
| [`docs/CUSTOMIZATION.md`](docs/CUSTOMIZATION.md) | Per-stack setup, inherited from the template |
| [`SECURITY.md`](SECURITY.md) | Vulnerability reporting and scope |

The architecture decision behind this repository is
[ADR-0001](https://github.com/House-of-Helix-CMD/helix-engineering/pull/20),
tracked by
[helix-engineering#19](https://github.com/House-of-Helix-CMD/helix-engineering/issues/19).

## Stack

React 19 with Next.js App Router conventions, built and served by Vinext on
Vite 8; one Cloudflare Worker serving the app and the API; D1 for workflow
records with drizzle-kit migrations; R2 for stored HTML prototype versions;
Wrangler for the Worker toolchain; Cloudflare Access for staff identity; the
OpenAI Responses API as the constrained AI provider; Node `24.19.0`.

The host is **decided**: Cloudflare Workers with Wrangler, D1, R2, and Vite
(2026-09-06). Hermes and Hostinger are no longer candidates. Per-environment
provisioning — account, database and bucket identities, Access applications,
secret manager — is not yet done, and nothing has been purchased.

## Local development

Node `24.19.0` (`.nvmrc`), npm. The `dev`, `build`, `lint`, and `db:generate`
scripts are POSIX shell wrappers — run them under Git Bash, WSL, or macOS/Linux.
Under Windows cmd/PowerShell the direct equivalents are `npx vite`,
`npx vinext build`, and `npx eslint .`. Runtime state (`.wrangler/`,
`.sites-runtime/`) is created on first run and never committed.

## Current state

The application source is in this repository. #8 imported the 2026-09-06
review package for technical review — `package.json`, the lockfile, the
Wrangler configuration, the linter config, the source, the tests, and the
package's review notes under `docs/review/` — and closed #2 and #4. The
commands and layout in `CLAUDE.md` describe what is here. Nothing has been
deployed; see [The blocking dependencies](#the-blocking-dependencies).

It was provisioned from the Project Helix repository template by the Helix
control plane. History begins at `ad7adb86ac87259d28c32380afbb99abbeb6040d`;
commit `f3c6f1cc37ec0604590ce07f3623546046706cb3` added the CODEOWNERS rules
that reserve the governance paths to technical admins. The template's history
was deliberately not inherited.

### CI

`lint`, `test`, `build`, and `security-check` run real commands. #6 replaced
the template's placeholders in its own workflow-only pull request (lifecycle
rule 5), validated first against the source on a throwaway harness PR (#7)
that was closed once read. The four gates are, in order: Prettier, ESLint and
`tsc --noEmit`; `npm test`, which builds then runs the suite against the built
output; `npm run build`; and the authorization, integration, and workflow
tests followed by `npm audit` with no severity floor. `npm audit` was brought
back to zero findings on 2026-11-01; `docs/DEPENDENCY_REVIEW.md` records the
reachable-path analysis behind the upgrades and the two `overrides` entries.
The exact commands are in `CLAUDE.md`.

The template shipped those four as placeholders that exit non-zero on purpose,
and they stayed red until #6 and #8 landed. That was the template's design: a
placeholder exiting `0` would report a green check for a test run that never
happened, and the release record would say `test_status: passed`. False green
is worse than red.

The three deploy workflows are still placeholders, for a different reason: the
host is chosen but not provisioned, so the Wrangler deploy step cannot be
written yet, which is why `deployTarget` and `previewUrl` in
`.helix/project.json` are still `null`.

The two health checks are functional as shipped — an HTTP probe does not depend
on the language or host.

### Deliberate omissions

Distinguishing an intentional gap from an oversight, per
[`docs/CUSTOMIZATION.md`](docs/CUSTOMIZATION.md) Part 3:

- **No workflow has been deleted.** The project has a build step (the Worker
  and client compile), a test suite, a staging tier, and a rollback story, so
  all eleven files are kept.
- **No `releases/` directory.** The first release creates it.
- **Required status checks are configured.** The "Protect main" ruleset
  requires `lint / Lint`, `test / Test`, `build / Build`, and
  `security-check / Security check`, the names read off a real run as
  [`docs/LIFECYCLE.md`](docs/LIFECYCLE.md#required-status-checks--deferred)
  asks. Because the template's placeholders could never satisfy them, #6 — the
  pull request that made the checks real — was merged with a single,
  recorded administrator bypass. Nothing since has bypassed them.
- **`CODEOWNERS.example` is left as an example.** The active
  `.github/CODEOWNERS` was provisioned by the Helix control plane and covers only
  `/.github/`, `/.helix/`, and `/CODEOWNERS`, reserved to
  `@House-of-Helix-CMD/technical-admins`. Feature code has no code owner, so peer
  approval on ordinary changes is a convention between developers, not a rule
  GitHub enforces.
- **`SECURITY.md` response targets are unfilled.** They are a promise to outside
  reporters and there is no security owner yet. They must be committed to before
  this repository is made public.

### The blocking dependencies

One thing blocks a first release that no amount of code fixes. The chosen
host must be **provisioned per environment** — Cloudflare account, D1 and R2
identities, an Access application and audience per hostname, a secret
manager, and an operating budget — and recorded by a technical admin in
`.helix/project.json`. The dependency audit that also blocked at first (17
high, 5 moderate, 1 low on the prepared source) was resolved in #8 without
`--force`, a severity floor, or a suppression; see `CLAUDE.md`.
