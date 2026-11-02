# Runbook: Review and stage Mobius

- **Owner:** assigned Helix maintainer; technical admin for identity, secrets and hosting
- **Last verified:** local implementation checks on 2026-09-06; staging not executed
- **Access:** assigned application repository and approved staging environment

## Prerequisites

The GitHub issue records scope, acceptance criteria, prior local preparation and the proposed host. The technical admin approves the storage, identity/permission mapping, AI service and runtime secret manager. The PR must pass its pipeline and required independent reviews.

## Procedure

1. Assign the application repository; create the issue and then a linked feature branch. Preserve the existing dashboard and its framework/pipeline constraints.
2. Run all README checks and record results on the PR. Local results do not replace CI.
3. Review both schema-only migrations. Create isolated staging DB/R2 bindings and configure the approved runtime settings from the integration contract.
4. Configure the Access application for the staging hostname and its exact audience, reusing approved group policies as appropriate. Keep alternate Workers hostnames and preview URLs disabled as in the supplied Helix setup. Never expose a route while its authentication is unconfigured.
5. Exercise separate signed-in creator, builder, approver and denied accounts. Confirm company-scoped records, HTML downloads, stale/foreign approval refusal, and revocation on the next request. Do not enable external reviewers through the broad staff policy.
6. Create synthetic new work and existing-project changes with assigned open GitHub issues. Upload/sample, comment, approve a real uploaded version, export, and record the export on GitHub before developer work. Verify a new version clears approval.
7. If approved, run one modest AI prototype and one revision using staging credentials. Record fidelity, latency, provider usage and spend. Confirm concurrent queue requests still yield one active build.
8. Confirm unknown submission recovery, logging destination/retention, and external-invitation/scheduler gaps. Record business acceptance and follow the canonical release process.

No staging/production deployment is authorized by this document. AI cannot merge or deploy production on its own under the supplied governance.

## Rollback and failures

Rollback the new application route/artifact through its pipeline; retain DB records and prototype objects. Do not drop tables or delete prototypes to roll back application code. Back up live state before later migrations.

| Symptom                       | Action                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Sign-in denied                | Check the configured mode, exact Access audience, key refresh and membership assignments; no authentication bypass |
| GitHub issue cannot be linked | Check assigned company/repository, open issue, approved read credential and canonical organization                 |
| Provider outcome unknown      | Technical admin verifies the provider request has stopped before clearing the held build slot                      |
| AI/GitHub credential rejected | Technical admin rotates the per-environment secret through the approved store                                      |
| Storage unavailable           | Restore approved binding and retry the preserved form                                                              |

Escalate security concerns under the supplied Helix incident process. Confirm append-only collection of security events; no secret values or raw provider payloads belong in logs.
