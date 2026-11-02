# Mobius implementation review

Prepared 2026-09-06. Substantial AI assistance: implementation, tests, integration adaptation, and documentation. This is an advisory self-review, not independent company-agent or human approval.

## Release gates

| Gate                                                          | Evidence / status                                                                                        |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GitHub issue and assigned application repository              | Pending authorized connection; no issue or branch identifier invented                                    |
| Company code, security, API, dependency and test-agent review | Definitions inspected; formal reviews pending                                                            |
| Peer and technical-admin review                               | Pending; identity, secrets, infrastructure and public API are involved                                   |
| Hosting, AI service, secret manager                           | Proposed only; no service credential provisioned                                                         |
| GitHub CI on reviewed source                                  | Check-only workflow prepared, not run remotely                                                           |
| Staging and business acceptance                               | Pending; Mobius not browser-tested or hosted                                                             |
| Staff access                                                  | Server checks tested with synthetic JWTs; current Access policy supplied; company/action mapping pending |
| External reviewers                                            | Invitations, expiry/revocation and project/version grants pending                                        |
| GitHub as engineering record                                  | Open-issue verification implemented; record publication still manual/pending                             |
| Continuous queue                                              | Not yet connected to a scheduler                                                                         |

Issue-before-branch is required. Initial local preparation began before the supplied governance snapshot arrived. Record that sequence transparently on the initial issue; do not backdate a work item or claim completed gates.

## Review order

This initial application exceeds the normal 400-line PR guideline. Review `lib/access.ts` and the adapted Access verifier; then `lib/helix.ts` and the read-only company-scoped GitHub adapter; then `lib/server.ts`, schema/migrations and workflow tests; then the working surface and CI proposal. Assign the application repository before splitting integration PRs. Do not put this application in the governance repository or silently replace the existing dashboard stack.

Addressed behavior: stale/foreign-version approval refusal, serialized queue ticks, unknown provider submission holding the build slot, incomplete HTML failure, retained R2 bytes when the database acknowledgment is lost, runtime-only secrets, mandatory JWT expiry, stale-key refresh refusal, company-scoped API and HTML access, distinct action roles, and verified GitHub work-item requirements.

## Source findings for technical review

- The supplied control-plane verifier checks expiry only when numeric and permits expired-cache keys after a failed refresh. Mobius's adaptation requires expiry and limits cache age; the original dashboard source was not changed. No exploit or live JWT test was attempted.
- The original Worker relies on edge Access for project-list read access. Mobius performs its own verified member and company checks before reading or returning data.
- Supplied Wrangler settings disable Workers observability. Confirm how required security event logs are collected and retained in the approved deployment; a console event alone is not evidence of durable audit storage.
- The supplied Access screenshots show three admitted email addresses, a 24-hour session, and policy MFA/HTTP Only cookie toggles off. Identity-provider MFA was not inspected. Technical review should confirm the required authentication/cookie posture without changing it during this prototype work. Additional Mobius company/action mappings require review against assigned work and GitHub teams; no membership inference is claimed.
- Prototype feedback/decisions currently live locally until a human publishes the export to the issue. This gap must be addressed for the intended low-friction first release.

## Dependency proposal

The Sites starter supplied the runtime and UI packages; resolved versions were retained and pinned. Prettier 3.9.6 is the sole additional package, a development formatter required by company coding standards (MIT, no declared runtime dependencies). Formal dependency review remains pending. No dependencies were added to either supplied repository.

Sources: [Prettier installation](https://prettier.io/docs/install), [Prettier 3.9.6](https://github.com/prettier/prettier/releases/tag/3.9.6), [background Responses API](https://developers.openai.com/api/docs/guides/background).

## Evidence boundary

The original control-plane suite passed 143 tests. Mobius's new tests use generated signing keys, synthetic identities, SQLite, an in-memory object store and mocked GitHub/AI responses. They do not establish live D1/R2 behavior, provider compatibility or model quality, measured cost, or Mobius browser layout. Separately, the existing live Helix dashboard was inspected after the user signed in; see the integration contract. No live project mutation, PR, release approval, or deployment was performed.
