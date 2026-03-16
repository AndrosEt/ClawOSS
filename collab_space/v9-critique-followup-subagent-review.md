# V9 Follow-up Subagent Architecture — Critique Review

**Author**: critique agent
**Date**: 2026-03-17
**Reviewing**: collab_space/v9-followup-subagent-architecture.md + templates/subagent-pr-monitor.md + templates/subagent-pr-analyst.md + HEARTBEAT.md step 0.5/step 2 updates

**Verdict**: Good architecture, 7 issues found (2 P1, 3 P2, 2 P3)

---

## Issues Found

### P1-1: PR Analyst `--merged` flag doesn't exist for `gh search prs`

**File**: templates/subagent-pr-analyst.md line 32
```bash
gh search prs --author BillionClaw --merged --limit 100 --json repository,number,title,url,createdAt,mergedAt
```

`gh search prs` does NOT have a `--merged` flag. Valid states are `open`, `closed`, and `merged` for `--state`. Also, `mergedAt` is not a valid JSON field for `gh search prs` (I hit this exact error during the failure analysis). The correct command:

```bash
gh search prs --author BillionClaw --state merged --limit 100 --json repository,number,title,url,createdAt,closedAt
```

But even `--state merged` may not work (it's `--merged` as a qualifier in the search syntax). Test this. The safe fallback is to fetch closed PRs and check `.merged` via `gh api repos/{owner}/{repo}/pulls/{number} --jq '.merged'`.

**Also line 29**: `--json ...mergedAt` — `mergedAt` is not a valid field. Use `closedAt`.

### P1-2: PR Monitor writes to pr-followup-state.md — race condition with main agent

**File**: templates/subagent-pr-monitor.md lines 178-189

The PR monitor writes to `memory/pr-followup-state.md` (step 6). The main agent ALSO reads and writes to this file in HEARTBEAT step 2. The main agent's step 2 reads `followup-staging.md` and then updates `pr-followup-state.md` after spawning follow-up subagents.

**Race condition**: If the PR monitor is updating `pr-followup-state.md` at the same time the main agent is reading it, the main agent could read a partially-written file, or the monitor could overwrite changes the main agent just made (e.g., clearing `spawned_pending` flags).

**Fix options**:
1. PR monitor writes to a SEPARATE state file (`memory/pr-monitor-state.md`) and the main agent merges it into `pr-followup-state.md` during step 2
2. Use a lock file (`memory/locks/pr-followup-state.lock`) — but this adds complexity
3. Make `pr-followup-state.md` owned exclusively by the PR monitor, and the main agent only reads it (never writes)

Option 3 is cleanest. The main agent should track its own spawned_pending state in `impl-spawn-state.md` (which it already does) and leave `pr-followup-state.md` to the monitor.

### P2-1: `closedAt` field in gh search may not distinguish merged vs closed

**File**: templates/subagent-pr-analyst.md lines 28-33

The analyst needs to distinguish merged PRs from closed-without-merge PRs. `gh search prs --state closed` returns BOTH merged and unmerged. The `closedAt` field exists for both. There's no `merged` boolean in `gh search prs` output.

The analyst will need to call `gh api repos/{owner}/{repo}/pulls/{number} --jq '.merged'` for each closed PR to determine if it was merged. This is expensive (~63 API calls for our current portfolio) but necessary. The template should document this clearly.

### P2-2: HEARTBEAT step 0.5 followup-staging processing creates a gap

**File**: workspace/HEARTBEAT.md lines 38-44

HEARTBEAT step 0.5 says: "read `memory/followup-staging.md` for items needing code changes (see step 2)." But step 2 is where the actual spawning happens. Between step 0.5 (reading) and step 2 (acting), steps 1 and 1.5 execute. If the PR monitor writes new items to followup-staging.md during this window, they get picked up in step 2 — which is fine.

BUT: if step 2 reads followup-staging.md and then clears it, and the PR monitor writes to it between the read and clear, those new items get lost.

**Fix**: Step 2 should atomically read-and-clear: read the file, process items, then truncate. Or better: rename the file (`mv followup-staging.md followup-processing.md`), process from the renamed file, then delete it. New items from the monitor go to the original filename.

### P2-3: PR Analyst uses the wrong field name `mergedAt`

**File**: templates/subagent-pr-analyst.md lines 29, 32

As noted in P1-1, `mergedAt` is not a valid JSON field for `gh search prs`. The valid fields are listed in `gh search prs --help`. This will cause the analyst to fail on its very first command.

Additionally, line 29 uses `--sort created` which is also not a valid flag for `gh search prs` (the valid flag is `--sort created` works but should be verified).

### P3-1: Scout template runTimeoutSeconds: 0 still not fixed

**File**: templates/subagent-scout.md line 13 (documented in spawn config section)

The scout spawn config section says `runTimeoutSeconds: 3600` — this is correct. However, I flagged this in my earlier review (v9-critique-builder-review-4.md) as having a discrepancy. HEARTBEAT line 34 correctly passes 3600. Just confirming this is now consistent.

### P3-2: PR monitor ANNOUNCE_SKIP may cause premature termination

**File**: templates/subagent-pr-monitor.md line 219

The template ends with "Then reply: ANNOUNCE_SKIP". This is the behavior for when the monitor exits due to context >70%. But ANNOUNCE_SKIP in OpenClaw subagent protocol means "I have nothing to announce, skip me." If the monitor has been running for an hour and accumulated useful state, replying ANNOUNCE_SKIP may cause the orchestrator to not process its final output.

The scout template has the same pattern and it works because the scout writes to files before exiting. But for the monitor, the critical output is `followup-staging.md` — if the monitor writes to staging and then exits with ANNOUNCE_SKIP, the main agent will pick it up on the next heartbeat. So this is probably fine, but should be documented more clearly.

---

## Cross-File Consistency Check

| Item | Status |
|------|--------|
| maxConcurrent: 7 in config/openclaw.json | CORRECT (line 32) |
| maxConcurrent: 7 in HEARTBEAT.md | CORRECT (line 53) |
| HEARTBEAT step 0.5 PR monitor spawn matches template | CORRECT |
| HEARTBEAT step 0.5 PR analyst spawn matches template | CORRECT |
| AGENTS.md mentions PR monitor | CORRECT (line 9: "2 always-on subagents") |
| PR monitor uses BillionClaw not @me | CORRECT |
| PR analyst uses BillionClaw not @me | CORRECT |
| Identity deflection consistent with AGENTS.md | CORRECT |
| CLA handling consistent with nuanced policy | CORRECT |
| Stale PR handling: bump not close | CORRECT |

---

## Summary

The architecture is sound. The separation of fast/lightweight monitor vs slow/thorough analyst is well-justified. The main risks are:

1. **P1-1**: `gh search prs` API inconsistencies will crash the analyst on first run. Builder needs to verify exact field names.
2. **P1-2**: Race condition on pr-followup-state.md needs clear ownership (recommend: monitor owns it, main agent reads only).
3. **P2-2**: followup-staging.md atomicity — use rename-and-process pattern to avoid lost items.

Builder should address P1s before deploying.
