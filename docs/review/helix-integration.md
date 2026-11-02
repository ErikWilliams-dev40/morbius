# Helix integration contract

Prepared 2026-09-06. Proposed configuration and implementation for technical-admin review; no live configuration changes.

## Source and deployment boundary

The user supplied a freshly pulled governance archive and `helix-control-plane.zip`. Selected company-owned authentication and status modules are adapted in `lib/helix`; original file hashes are in `lib/helix/source-manifest.json`. The original application source remains unchanged. The archive's local secrets and runtime state were excluded from the working extraction and are absent from this package.

Mobius currently has a separate React/Vinext working surface with D1/R2 adapters. The existing control-plane app uses plain React/Vite and has no application database. Its README prohibits adding UI/CSS frameworks to that app. This package is therefore not a drop-in replacement or a framework injection into that repository. The application repository and staging target must be assigned before integration. Shared modules can subsequently become a company-owned package to avoid drift.

## Identity and permissions

Cloudflare Access decides who can reach the protected application. The Worker separately verifies the Access JWT signature, issuer, audience, and expiry. It does not trust an email header. GitHub teams govern repository access, code ownership, and engineering review; the supplied dashboard does not dynamically derive its action capabilities from GitHub team membership.

| Setting                  | Purpose                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `MOBIUS_AUTH_MODE=helix` | Explicit Helix authentication mode; missing/unknown mode denies access                                                |
| `ACCESS_TEAM_DOMAIN`     | Validated `*.cloudflareaccess.com` team hostname                                                                      |
| `ACCESS_AUD`             | Audience of the Access application protecting the Mobius deployment                                                   |
| `MOBIUS_MEMBER_SCOPES`   | JSON mapping verified member emails to assigned company IDs; empty/malformed configuration denies membership          |
| `PROJECT_CREATOR_EMAILS` | Existing Helix allowlist convention, proposed to permit Mobius request creation and builds                            |
| `MOBIUS_BUILDER_EMAILS`  | Additional assigned developers who may build/revise/upload/handoff but cannot create repositories or approve releases |
| `APPROVER_EMAILS`        | Existing business-approver convention, proposed to permit prototype approvals and formal change requests              |
| `MOBIUS_ADMIN_EMAILS`    | AI model administration and confirmation that an unknown provider submission has stopped                              |

All configured members may read and comment within their assigned companies. Roles grant actions, not additional company visibility. Administrative capability does not implicitly grant build or approval powers. Email allowlists and assignments remain server-side. Company IDs are `helix`, `sequence`, `halo`, `inca`, `smoke`, and `tiger`.

The additional company and builder/admin assignments are proposed Mobius configuration, **not a claim that existing Cloudflare rule groups or GitHub teams have already been mapped**. Validate this mapping against the actual policies and assigned work before staging. Access application AUD tags are application-specific; do not assume the existing Helix AUD can be reused on an unrelated application.

A separate owner-private Sites review may explicitly use `MOBIUS_AUTH_MODE=sites_owner` and a preassigned `MOBIUS_REVIEW_OWNER_ID`. It rejects all other platform identities and refuses to run with Helix Access configuration present. There is no authentication fallback and no first-visitor owner assignment. Keep review and Helix deployments on separate storage; never switch modes to work around a failed sign-in.

## GitHub and storage

| Binding / setting             | Purpose                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DB`                          | D1 requests, queue, versions, comments, local decisions/activity, settings                                           |
| `BUCKET`                      | R2 prototype HTML bytes                                                                                              |
| `HELIX_GITHUB_READ_TOKEN`     | Dedicated approved read credential limited to assigned repositories; never the existing dashboard's write credential |
| `MOBIUS_GITHUB_APPROVED=true` | Technical admin has approved this integration and secret path                                                        |
| `MOBIUS_COMPANY_REPOS`        | JSON mapping company IDs to explicitly assigned repository slugs                                                     |
| `OPENAI_API_KEY`              | Approved per-environment AI service secret                                                                           |
| `MOBIUS_AI_APPROVED=true`     | Technical admin has approved AI processing and retention                                                             |

GitHub discovery queries only assigned repositories, rejects unexpected results, and preserves Helix's status derivation. Its REST adapter rejects writes; GraphQL accepts query documents only. No repository creation, approval, workflow dispatch, branch protection, team management, or deployment code is imported. Release actions remain in Helix Development Control.

GitHub access still needs a named approved machine identity, minimum read permissions for the fields Helix uses, and rotation/offboarding ownership. A browser sign-in is not a runtime service credential. Provider and GitHub secrets must use the approved target's secret manager; no new production secret store is silently assumed.

The supplied source and observed live dashboard both reference `House-of-Helix-CMD`. Keep that behavior until the authorized repository connection verifies the canonical organization; do not rename to `Helix-CMD` based only on shorthand.

## Changes to reused code

- Mandatory finite JWT expiry; invalid not-before types rejected. Malformed JSON and untrusted team hostnames rejected.
- Signing keys cached for at most ten minutes; a failed refresh does not continue trusting stale keys. New signing keys may require waiting for the cache interval; no stale fallback.
- Redirects rejected on key and GitHub requests.
- Project discovery scoped before fetch and filtered again before metadata reads. Short batches avoid the original list's 50-repository truncation.
- Only the read-only metadata helper and the relevant decision label are retained. No GitHub mutation paths imported.
- Original relative imports adapted for Node's TypeScript test execution; formatter applied.

These changes and their tests require independent security review. They are not patches already deployed to Helix.

## Live observation

After user-completed email-code sign-in on 2026-09-06, Helix displayed 12 active projects: 5 in review, 3 in progress, 4 blocked, and none ready for Jack. All 12 displayed no available preview. This is a point-in-time UI observation, not an audit of repository internals or proof that no preview exists elsewhere. No project was created or altered.

The Cloudflare admin portal blocked this browser's verification. The user subsequently supplied four configuration screenshots and the application audience. They show the following existing configuration; these are observations, not runtime values provisioned by this work.

| Item              | User-supplied evidence                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Application       | `helix`, self-hosted                                                                                     |
| Hostname/path     | `helix.helixcmd.com`, path left blank                                                                    |
| Session duration  | 24 hours; policy inherits application timeout                                                            |
| AUD               | `ee8202abf391404834fde3c87b5b97bd4bf29185e8d094e59fb790da1e22c299`                                       |
| Team hostname     | `ancient-violet-3c19.cloudflareaccess.com`, also observed during live sign-in                            |
| Policy            | `Helix users`, order 1, action Allow, one rule                                                           |
| Policy identifier | `268c6aad-da89-4b95-8edc-540316dcab30`                                                                   |
| Rule              | Include / Emails, three explicit addresses: the Helix admin address, Jack's address, and Nikki's address |
| Additional rules  | No Require or Exclude rule shown; no rule-group selector shown for this application                      |
| Policy-level MFA  | Off in the screenshot; this does not establish whether separate identity-provider/account MFA exists     |
| Cookie options    | HTTP Only, binding cookie, and cookie-path enforcement appear off; eager redirect cookie on              |

Sources: `Helix-users-policy-for-helix-application.png`, `Helix-users-policy-action-rules-and-id.png`, `helix-screen-capture-02.png`, `helix-screen-capture-01.png`, and the user's pasted AUD. The policy's email allowlist establishes admission only; it does not establish GitHub team membership, repository assignments, or action roles. Do not widen this staff policy to accommodate external prototype guests. No policy change is required or performed for local prototyping.

## Configuration handoff reference

The initial evidence below has been supplied. For subsequent changes, compare the current application using Zero Trust > Access controls > Applications > the application for `helix.helixcmd.com` > Configure:

1. Application name, domains/paths, and session duration.
2. Policies in order, including Action, Include, Require, and Exclude. Obtain referenced rule-group definitions next when necessary.
3. Additional settings > Application Audience (AUD) Tag. Capture the identifier, not a JWT/cookie.

No settings changes are needed to gather this evidence. Do not include API tokens, cookies, or runtime secret values.

Official references: [policy management](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/policy-management/), [JWT validation/AUD](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [Access token fields](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).
