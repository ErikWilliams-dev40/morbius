<!--
Fill this in honestly. The answers below feed the release metadata record and the
production approval decision — see docs/RELEASE_METADATA.md.
-->

## What and why

<!-- What changes, and why it needs to. The diff shows what; explain the why. -->

Closes #<!-- issue number. Use "Refs #N" if this is partial. -->

## How to verify

<!-- Steps a reviewer can follow to confirm this works. Not "run the tests" —
     what should they see? -->

---

## Risk

- [ ] **Database migration** — this PR adds, alters, or drops schema.
  - If checked: is it backward compatible with the currently deployed version?
    <!-- yes / no + explanation -->
- [ ] **Not rollback-safe** — the previous version cannot simply be redeployed
      over this one.
  - If checked: explain what recovery would require.
    <!-- Destructive migrations, one-way data backfills, changed external
         contracts. Be specific — the rollback workflow refuses to run on a
         release marked rollback_safe: false. -->
- [ ] **New secret or credential** required.
  - If checked: name it and say which environment needs it. Do not commit a value.
- [ ] **Widens a workflow `permissions:` block** or adds a third-party GitHub
      Action.
  - If checked: this belongs in its own PR. See CONTRIBUTING.md.
- [ ] **Breaking change** for API consumers or downstream systems.

If none of the above apply, say so explicitly rather than leaving the section
blank — a reviewer cannot tell "no risk" from "not considered."

## Business approval

- [ ] This change needs executive/business sign-off before production.
  <!-- Corresponds to business_approval_required in the release metadata. Check it for
       anything customer-visible, contractual, pricing-related, or otherwise
       beyond a routine technical change. -->

---

## Author checklist

- [ ] Branch follows `<type>/<issue-number>-<slug>`
- [ ] Commits explain *why*
- [ ] Lint, test, build, and security-check pass
- [ ] Tests cover the change (or the PR explains why they cannot)
- [ ] Documentation updated if behaviour or setup changed
- [ ] No secret, token, or credential is committed
- [ ] Scoped to one concern

## Reviewer checklist

- [ ] Change does what the description claims
- [ ] Risk section above is accurate, not just filled in
- [ ] Migration and rollback claims are believable
- [ ] No new attack surface, unsafe input handling, or leaked secret
- [ ] Automated checks genuinely ran — no check disabled or bypassed to go green
