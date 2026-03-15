# 035: Orchestrator Counts PRs Without Validating PR URL in Result File

**Status:** Open
**Severity:** High (inflates PR metrics, creates ghost entries in ledger)
**Component:** workspace/HEARTBEAT.md (step 6), scripts/pr-ledger-sync.sh

## Description

The orchestrator's step 6 (Handle Sub-Agent Results) documents a validation gate: if a sub-agent result file has `Status: success` but no PR URL, it should NOT be counted as a submitted PR. In practice, the model skips this validation and counts any `Status: success` as a shipped PR.

**Evidence:** The ruby-lsp#3760 result was counted as a successful PR despite no actual PR being created on GitHub. The sub-agent reported success, the orchestrator accepted it at face value, and it entered the PR ledger as a real contribution.

## Impact

1. **Inflated metrics**: PR counts in dashboard and CHANGELOG include ghost PRs that don't exist on GitHub
2. **Ledger pollution**: pr-ledger.md contains entries with no valid PR URL, making it unreliable as a source of truth
3. **False confidence**: The team sees "32 PRs submitted" but the real number may be lower
4. **No retry**: Tasks that silently failed (sub-agent claimed success but didn't actually push/create PR) are marked done and never retried

## Root Cause

HEARTBEAT.md step 6 correctly specifies the validation logic:

```
- If PR URL is MISSING or EMPTY:
  - Do NOT count as a submitted PR
  - Log as "incomplete — no PR URL" in memory/work-queue.md
  - Re-queue the issue for retry (once). If already retried, mark as failed.
```

The model does not follow this branch. It reads `Status: success` and immediately updates pipeline-state.md without checking for a PR URL.

## Fix

This is a runtime behavior bug — the documentation is correct but the model doesn't comply. Possible mitigations:

1. **Programmatic validation**: Add a shell script or hook that parses result files and rejects any with `Status: success` but no `https://github.com/.*/pull/` URL match
2. **pr-ledger-sync.sh hardening**: The sync script already pulls from GitHub API — add a reconciliation step that flags ledger entries with no matching GitHub PR
3. **Prompt reinforcement**: Add CRITICAL/MUST-DO markers around the URL validation logic in HEARTBEAT.md step 6
4. **Post-cycle audit**: Add a step 6.5 that cross-references all "success" results against `gh pr list --author @me`

## Related Issues

- #036 — PR limits not enforced (related model compliance issue)

## Related Files

- `workspace/HEARTBEAT.md` (step 6 — result handling)
- `scripts/pr-ledger-sync.sh` (ledger sync, could add validation)
- `workspace/memory/pipeline-state.md` (where ghost PRs get recorded)
