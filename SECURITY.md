# Security Policy

## Reporting a vulnerability

Do **not** open a public issue for a security vulnerability.

Use GitHub's advisory form on this repository: **Security → Advisories → New
draft security advisory**, also linked from the issue chooser.

While this repository is **private**, that form is available to repository
admins only. GitHub offers private vulnerability reporting — the route that lets
anyone file a report — for public repositories only, so it cannot be enabled
here yet. If you are a collaborator without admin access, contact a member of
`@House-of-Helix-CMD/technical-admins` directly and do not put details in an
issue, pull request, or commit message. Before this repository is made public,
enable private vulnerability reporting in repository settings (see the
configuration checklist in
[`docs/LIFECYCLE.md`](docs/LIFECYCLE.md#configuration-checklist)) so the same
link serves outside reporters.

Include, as far as you can:

- what the issue is and the impact you believe it has,
- the affected version or commit SHA,
- steps to reproduce,
- any logs or proof of concept.

### What to expect

> **UNCOMMITTED:** the response targets below are deliberately left unfilled.
> They are a promise to outside reporters, and this project has no on-call
> rotation or named security owner yet. Fill them in with numbers that can
> actually be met before this repository is made public.

| Stage | Target |
| --- | --- |
| Acknowledgement | _to be committed_ |
| Initial assessment | _to be committed_ |
| Fix or mitigation plan | _communicated after assessment_ |

We will keep you informed while the issue is open and credit you in the advisory
unless you ask us not to.

## Supported versions

This application is intended to be continuously deployed once production is
live. When production exists, only the currently deployed production commit is
supported; there are no maintained branches or back-ported fixes — a fix ships
forward through the normal lifecycle.

| Version | Supported |
| --- | --- |
| Current production commit | Yes |
| Any earlier commit | No |

## Scope

**In scope:** the Mobius Workers-compatible API, the React/Vinext front end,
the D1 and R2 adapters, the external-reviewer invitation flow, and this
repository's CI/CD configuration.

**Out of scope:**

- The AI provider. It is an upstream third party. Report a problem in how
  *this* application constrains, submits to, or handles output from it; do not
  test against the provider.
- The Helix control plane and its authentication service. Mobius reuses them
  through bounded, read-only adapters. Report a problem in the adapter here;
  report a problem in the control plane to that repository.
- Hosting and storage platforms themselves, once chosen.
- Production implementation of an approved prototype. That happens in the
  target project's own repository under its own policy.

Do not test against production. Do not run denial-of-service tests — note in
particular that the build queue is deliberately a single active job, so
flooding it demonstrates nothing about this service and blocks real staff.

Do not access data belonging to anyone other than yourself, and do not accept
or use an invitation that was not issued to you.

### Project-specific classes worth reporting

This system's primary asset is the integrity of the approval record and the
containment of the AI adapter. Alongside conventional vulnerabilities, we treat
as security issues: any path that carries an approval forward to changed
prototype bytes; any path that lets two builds run concurrently; any external
invitation that grants more than the intended project/version, outlives its
expiry, or survives revocation; any capability reaching the AI adapter beyond
sample-data prototype generation; and any path that renders generated HTML
outside its isolated sandbox. See [`CLAUDE.md`](CLAUDE.md) for why.

---

## Practices this repository enforces

Summarized here for reporters. The rules and the reasoning behind them live in
one place each, so they cannot drift out of sync:

- **Pipeline hardening** — least-privilege workflow permissions, no third-party
  GitHub Actions, `persist-credentials: false` on checkout, no `secrets: inherit`,
  and environment-scoped deploy credentials.
  → [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)
- **Repository settings** — branch protection, required status checks, required
  code-owner review, and the `staging` / `production` Environments that carry the
  approval gate.
  → [`docs/LIFECYCLE.md`](docs/LIFECYCLE.md#configuration-checklist)
- **Review gates** every change passes before production.
  → [`docs/LIFECYCLE.md`](docs/LIFECYCLE.md)
- **Third-party action recommendations**, documented rather than installed.
  → [`docs/RECOMMENDED_ACTIONS.md`](docs/RECOMMENDED_ACTIONS.md)

Two rules worth stating outright, because a reporter may be checking for them:
no secret is ever committed to this repository, and widening a workflow's token
scope is treated as a security change requiring its own reviewed pull request.

Note that the automated checks are real and run on every pull request, but
required status checks are not yet configured in a freshly provisioned copy —
until they are, a red pull request can still be merged. See
`docs/LIFECYCLE.md` for the configuration sequence and the README for the
current state.
