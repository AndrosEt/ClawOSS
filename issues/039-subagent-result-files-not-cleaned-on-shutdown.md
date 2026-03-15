# 039: Unprocessed Subagent-Result Files Not Cleaned Up on Shutdown

**Status:** Open
**Severity:** Medium (stale state on restart, potential duplicate work)
**Component:** scripts/stop.sh, scripts/restart.sh, workspace/HEARTBEAT.md (step 6)

## Description

When ClawOSS is stopped (via `scripts/stop.sh` or `scripts/restart.sh`), any in-flight sub-agent result files (`workspace/memory/subagent-result-*.md`) are left behind. On the next restart, the orchestrator may:

1. **Process stale results**: Pick up result files from a previous run and act on them (updating pipeline-state, removing items from work queue) even though the context has changed
2. **Create duplicate PRs**: If a result file reports success but the orchestrator didn't process it before shutdown, it might re-queue the same issue AND process the old result, leading to confusion
3. **Accumulate garbage**: Over multiple stop/start cycles, orphaned result files pile up in the memory directory

## Evidence

The restart script (`scripts/restart.sh`) cleans up session files (step 6):
```bash
rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.jsonl 2>/dev/null
rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.lock 2>/dev/null
```

But it does NOT clean up result files:
```bash
# Missing: rm -f "$PROJECT_DIR/workspace/memory/subagent-result-"*.md 2>/dev/null
```

The stop script (`scripts/stop.sh`) also has no result file cleanup.

## Impact

1. **State corruption on restart**: Stale result files processed as if they're fresh, leading to incorrect pipeline-state updates
2. **Duplicate PR risk**: An issue gets re-queued (because the orchestrator thinks it wasn't handled) while the old result file also gets processed (double-counting)
3. **Disk clutter**: Minor but adds noise to the memory directory

## Fix

1. **Add cleanup to restart.sh**: After session cleanup (step 6), add:
   ```bash
   # Clean stale sub-agent result files
   rm -f "$PROJECT_DIR/workspace/memory/subagent-result-"*.md 2>/dev/null
   echo "[OK] Stale result files cleaned"
   ```

2. **Add cleanup to stop.sh**: Before removing cron jobs, clean result files:
   ```bash
   # Clean unprocessed sub-agent results
   rm -f "$PROJECT_DIR/workspace/memory/subagent-result-"*.md 2>/dev/null
   echo "  Cleaned stale result files"
   ```

3. **Graceful shutdown option**: Before deleting, log which result files existed and their status, so the operator knows if any successful PRs were unprocessed:
   ```bash
   for f in "$PROJECT_DIR/workspace/memory/subagent-result-"*.md; do
       [ -f "$f" ] && echo "  WARNING: Unprocessed result: $(basename $f)" && cat "$f"
   done
   ```

4. **HEARTBEAT.md step 0**: Add a startup check — on first heartbeat after restart, scan for and process any leftover result files before entering the normal loop

## Related Issues

- #035 — PR URL validation not enforced (compounds the stale-result problem)

## Related Files

- `scripts/restart.sh` (step 6 — session cleanup, missing result file cleanup)
- `scripts/stop.sh` (teardown, missing result file cleanup)
- `workspace/HEARTBEAT.md` (step 6 — result file processing)
- `workspace/memory/` (where result files accumulate)
