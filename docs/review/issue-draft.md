# Mobius: prototype requests, review, and developer handoff

## Why

Jack needs a fast way to request new projects and changes, review clickable demos, give specific feedback, and approve a design for developer implementation. The existing Helix dashboard already owns engineering status and release decisions. Mobius should feed that workflow.

## Agreed scope

- New projects and existing-project changes from the first release.
- Clickable demos with sample data, simulated interactions and versioned feedback.
- Human developers complete production implementation.
- 1–5 internal users; plan for 26–100 build/revision requests weekly.
- One shared build queue with one active job and visible progress.
- Authorized staff and invited external reviewers who verify email.
- Estimate operating cost before any purchase; Hermes/Hostinger remains a candidate.

## Prepared implementation

The attached local review package contains the workflow, a Workers-compatible API, D1/R2 adapters, a constrained asynchronous AI adapter, server-side company/action permissions, and read-only Helix status reuse. GitHub issue verification precedes AI work and handoff. Release decisions stay in the existing Helix dashboard. No runtime services, remote commits, PRs, merges, or deployments were created.

Local preparation began before the supplied governance snapshot arrived. This issue must record that sequence honestly, and it must exist before the integration branch is created.

## Acceptance criteria

- A permitted creator can request both types of work and an assigned builder can revise prototypes.
- Two build requests queue without overlapping active jobs; ambiguous provider submission never releases the build slot automatically.
- Prototype bytes, records and feedback are unavailable outside assigned access.
- Approval is a distinct permission bound to the current version; revisions invalidate it.
- Brief, version digest, comments and decision history are durably linked to the GitHub work item.
- Developer implementation and technical/business release gates follow the existing Helix pipeline.
- External invitations verify email and grant only the intended project/version, with expiry and revocation.
- Continuous queue scheduling and modest live provider usage are measured in staging.

## Integration and remaining work

Assign an application repository and staging target. The existing `helix-control-plane` uses plain React/Vite and forbids introducing a UI framework; this separate scaffold must not silently replace that app. Review the extracted shared modules and the proposed company/action mappings against current Access and GitHub team policy.

Complete GitHub record publication, external reviewer invitations, and always-on scheduling. Provision approved per-environment credentials and storage only after technical-admin review. Run CI, independent code/security/API/dependency/test reviews, staging acceptance and business approval under the canonical release process.

See `docs/helix-integration.md`, `docs/review.md`, and `docs/runbook.md` for evidence and limits. The four user-supplied Cloudflare screenshots and AUD establish the current dashboard admission policy; they do not authorize widening it.
