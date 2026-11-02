# Contributing

How work moves through this repository. The full gate-by-gate description is in
[`docs/LIFECYCLE.md`](docs/LIFECYCLE.md); this is the practical version.

---

## 1. Start from an issue

Open an issue using one of the forms under `.github/ISSUE_TEMPLATE/`. Every
branch traces back to an issue number.

## 2. Branch

Branch from the default branch:

```
<type>/<issue-number>-<short-slug>
```

`type` is one of `feat`, `fix`, `chore`, `docs`, `refactor`. Example:
`fix/207-stale-session-cookie`.

Direct commits to the default branch are not permitted.

## 3. Commit

- Present tense, imperative subject: `Add token refresh on 401`.
- Subject under ~72 characters, no trailing period.
- Body explains *why*, not *what* — the diff already says what.
- Reference the issue: `Refs #207`, or `Closes #207` if it fully resolves it.
- Keep commits reviewable. Unrelated cleanups go in their own commit.

## 4. Open a pull request

Fill in `.github/PULL_REQUEST_TEMPLATE.md` honestly. In particular:

- **Database migration** — say whether this changes schema.
- **Rollback safety** — say whether the previous version can be redeployed over
  this one without data loss.
- **New secrets or permissions** — call them out; do not add them silently.

Mark the PR as a draft until you want review.

## 5. Automated checks

`lint`, `test`, `build`, and `security-check` run on every PR. All four must
pass. Do not merge with a failing check and a note saying it is unrelated —
either fix it or fix the check.

## 6. AI and security review

An AI review pass runs against the diff using
`.claude/agents/security-reviewer.md`. It is an additional signal, not a
substitute for a human reviewer, and it does not have approval authority.

## 7. Peer approval

At least one human owner must approve. Authors cannot approve their own PR.

Code-owner enforcement is not yet switched on — `CODEOWNERS.example` becomes
`.github/CODEOWNERS` once teams and repository access are assigned. Until then,
getting the right reviewer is a human responsibility, not something GitHub will
enforce for you.

## 8. Merge

Squash merge into the default branch unless the PR is a curated commit series
worth preserving. Delete the branch after merge.

---

## Deployment

Contributors do not deploy. Deploys are triggered by a maintainer through the
`Deploy` workflow (`workflow_dispatch`) and follow:

```
staging-deploy → staging-health-check → [business approval] → production-deploy → production-health-check
```

The business-approval gate is a required reviewer on the `production` GitHub
Environment. It refers to a specific `commit_sha` recorded in the release
metadata, and that SHA never changes — see
[`docs/RELEASE_METADATA.md`](docs/RELEASE_METADATA.md).

If a production deploy goes wrong and the release is marked `rollback_safe`,
a maintainer runs the `rollback` workflow with the previous good SHA.

---

## Working on the workflows themselves

Changes to `.github/workflows/` ship in their own pull request, never bundled
with a feature change. If a change widens a `permissions:` block, say so in the
PR title.

## Local setup

The stack is chosen — React with Next.js conventions on Vinext, one Cloudflare
Worker, D1 and R2 — and the host is Cloudflare, but no application code exists
in this repository yet. The commands below are the scripts from the prepared
source's `package.json`; they work once #2 lands it. `CLAUDE.md` holds the
authoritative command table; keep the two in sync.

**Prerequisites:** Node `24.19.0` — `.nvmrc` carries it, so `nvm use` (or fnm,
or Volta) selects it; any later 24.x also satisfies `engines` — npm, and Linux
or WSL — the build wrapper needs GNU `timeout`. Wrangler is a project
dependency, not a global install.

    # These commands work once package.json and the lockfile land in the repository.
    npm ci                 # install, exactly what the lockfile says
    npm run format:check   # Prettier
    npm run lint           # ESLint (eslint-config-next)
    npm run typecheck      # tsc --noEmit
    npm run build          # vinext build — Worker and client
    npm run test:built     # node --test against the built output (npm test = build + this)
    npm run dev            # Vite dev server; the Cloudflare plugin emulates D1 and R2 in .wrangler/
    npm run db:generate    # drizzle-kit: regenerate migrations after editing db/schema.ts

Authorization, company scoping, version approval, and the queue's
uncertain-submission path are the controls. Run their tests directly when you
touch them, and do not merge a change to them without a test that fails first.

Never point a local environment at a real AI provider key, a production D1
database, or a production R2 bucket. Local `.wrangler/` state, `.env` files,
and build output are ignored by git; keep them that way.

Do not run `npm audit fix` and commit the result. Advisory resolution is
reviewed per package against upstream release notes — see #4 and `CLAUDE.md`.
