---
name: release-metadata
description: >-
  Create a Project Helix release metadata record for a merged pull request.
  Use when preparing a release for staging or production promotion, or when asked
  to record, generate, or validate release metadata for a commit.
---

# Release metadata

Produce one release metadata record for a commit, conforming to
`docs/schemas/release-metadata.schema.json`.

Read `docs/RELEASE_METADATA.md` before writing a record. It defines the
immutability rules, and they are the point of the exercise.

## Rules

1. **One record per commit SHA.** The file is `releases/<commit_sha>.json`, using
   the full 40-character lowercase SHA.
2. **Never edit an existing record.** If a record exists for this SHA, stop and
   report it. If the code changed, the SHA changed, so it needs a new record.
   Editing a record retroactively alters what an executive approved.
3. **Never guess a field.** Every value comes from an observed source — the git
   history, the PR, a CI conclusion, a deploy output. If a value cannot be
   determined, report the gap. A plausible fabricated value defeats the audit
   trail entirely, and `test_status: "passed"` invented for a suite that never
   ran is the worst possible version of this.
4. **`commit_sha` must be a full SHA**, never a branch name, tag, or short SHA.
   Branches and tags move; the record must not.
5. **Additional fields are not allowed.** The schema sets
   `additionalProperties: false`.

## Gathering values

| Field | Source |
| --- | --- |
| `project` | `CLAUDE.md`, or the repository name |
| `repository` | `owner/repo` |
| `pull_request` | PR number that introduced the commit |
| `commit_sha` | `git rev-parse HEAD` on the merged commit — full SHA |
| `developer` | PR author's GitHub login |
| `human_reviewer` | login of the code owner who approved; must differ from `developer` |
| `test_status` | conclusion of the `test` check run for this SHA |
| `security_review_status` | `security-check` conclusion combined with the AI review outcome |
| `staging_url` | `url` output of `staging-deploy`, or `null` if not yet deployed |
| `business_approval_required` | the business-approval checkbox in the PR body |
| `rollback_safe` | PR risk section; `false` if a destructive migration is involved |
| `database_migration` | whether the diff changes schema |
| `created_at` | RFC 3339 UTC timestamp of when the record is written |

If — and only if — `security_review_status` is `waived`, three more fields are
required. The schema forbids them in every other case, so do not add them
speculatively:

| Field | Source |
| --- | --- |
| `waiver_authorized_by` | GitHub login of the **Technical Admin** who authorized it |
| `waiver_reason` | Their stated reason plus compensating control; minimum 20 characters |
| `waiver_timestamp` | RFC 3339 timestamp of when the waiver was granted |

Never author a waiver yourself. If a security gate did not pass and no Technical
Admin has authorized an exception, the correct record says `failed` or `pending` —
report that and stop. Only a Technical Admin may authorize a waiver, and inventing
a `waiver_reason` or naming a plausible authorizer fabricates an approval that
never happened.

## Determining `rollback_safe`

Do not default this to `true` because nothing looked alarming. Ask whether the
previously deployed version, redeployed unchanged, would run correctly against
the state this release leaves behind.

`false` if the release drops or renames a column or table, performs a one-way
data backfill, changes an external contract in a non-backward-compatible way, or
alters stored data in a form old code cannot read. When it is genuinely unclear,
report the uncertainty rather than picking a value — `rollback.yml` refuses to run
on `rollback_safe: false`, so a wrong `true` sends someone into an automated
rollback that can lose data.

## After writing

Validate the record against the schema, and report:

- the path written,
- the SHA it pins,
- any field you could not determine from evidence.

Do not report a record as complete if you left a field uncertain. Say which one.
