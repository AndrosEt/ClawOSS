# Sub-Agent Result Schema

All sub-agent result files MUST use this format. The YAML frontmatter enables
reliable machine parsing by the orchestrator at HEARTBEAT step 6.

## File Naming

- Implementation: `memory/subagent-result-{owner}_{repo}-{issue}.md`
- Follow-up: `memory/subagent-result-followup-{owner}_{repo}-{pr}.md`

Use underscore `_` to join owner/repo (slash is not valid in filenames).

## Format

```markdown
---
type: implementation | followup
status: success | failure | already_fixed | abandoned
repo: owner/repo
issue: 12345
pr_url: https://github.com/owner/repo/pull/67890
pr_number: 67890
branch: clawoss/fix/description
files_changed: 3
additions: 25
deletions: 8
has_tests: true
root_cause: Brief one-line root cause explanation
failure_reason: Only present if status is failure or abandoned
followup_round: 2
followup_outcome: changes_pushed | question_answered | closed_scope_concern | closed_rejected | disengaged_max_rounds
---

# Result: {owner}/{repo}#{issue or pr}

## Summary
One paragraph describing what was done and the outcome.

## Root Cause Analysis
(Implementation only — skip for follow-ups that only answered questions)
What was broken, why it was broken, how the fix addresses it.

## Changes Made
- List of files modified and what changed in each

## Test Evidence
(If tests were run)
### Before (failing)
```
paste test failure output
```
### After (passing)
```
paste test success output
```

## Reviewer Interaction
(Follow-up only)
- What reviewers asked for
- What was changed or responded
- Any scope concerns raised

## Notes
Any additional context (e.g., "CI not available in environment", "issue was already fixed upstream")
```

## Required Fields by Type

### Implementation (type: implementation)

| Field | Required | Notes |
|-------|----------|-------|
| type | yes | `implementation` |
| status | yes | `success`, `failure`, `already_fixed`, or `abandoned` |
| repo | yes | `owner/repo` format |
| issue | yes | issue number |
| pr_url | if success | full GitHub PR URL |
| pr_number | if success | PR number |
| branch | if success | branch name |
| files_changed | if success | integer |
| additions | if success | integer |
| deletions | if success | integer |
| has_tests | if success | boolean — did the PR include test changes? |
| root_cause | if success | one-line root cause |
| failure_reason | if failure | why it failed or was abandoned |

### Follow-up (type: followup)

| Field | Required | Notes |
|-------|----------|-------|
| type | yes | `followup` |
| status | yes | `success` or `failure` |
| repo | yes | `owner/repo` format |
| pr_number | yes | PR number being followed up on |
| pr_url | yes | full GitHub PR URL |
| followup_round | yes | integer — which round this was (1, 2, or 3) |
| followup_outcome | yes | see enum values above |
| branch | yes | branch name |
| files_changed | if changes pushed | integer |
| additions | if changes pushed | integer |
| deletions | if changes pushed | integer |
| failure_reason | if failure | why the follow-up failed |

## Status Values

- `success` — task completed, PR submitted (implementation) or follow-up handled (follow-up)
- `failure` — task could not be completed (with failure_reason)
- `already_fixed` — the bug was already resolved upstream, no PR needed
- `abandoned` — task was abandoned due to complexity, scope, or quality gate failure

## Orchestrator Parsing

The orchestrator reads these files at HEARTBEAT step 6. It relies on the YAML
frontmatter for structured data extraction. The markdown body is for human
review and dashboard ingestion only.

Parsing pseudocode:
```
1. Read file content
2. Extract YAML between first --- and second ---
3. Parse YAML into key-value pairs
4. Route based on type field:
   - implementation → step 6a logic
   - followup → step 6b logic
5. Check status field:
   - success → validate pr_url is present and valid
   - failure/abandoned → log failure_reason
   - already_fixed → remove from queue, no PR to track
6. Delete result file after processing
```
