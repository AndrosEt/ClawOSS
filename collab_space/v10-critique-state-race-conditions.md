# V10 Critique: State File Race Conditions (TOCTOU)

**Author**: critique agent (with monitor input)
**Date**: 2026-03-17
**Priority**: P2 (after PATH bug P0 is fixed)

---

## Problem

The agent uses markdown files as shared state, mutated via LLM-generated text edits. When multiple sessions (orchestrator + always-on subagents) write concurrently, exact-text-match edits fail because the text changed between read and write. This is a classic TOCTOU (time-of-check-to-time-of-use) race condition.

## Concurrent Writer Map

| File | Writers | Race Risk | Worst Case |
|------|---------|-----------|------------|
| `pr-followup-state.md` | Orchestrator (step 6a) + PR Monitor (step 6) | **CRITICAL** | PR monitor marks approved, orchestrator overwrites with stale data -> missed merge |
| `impl-spawn-state.md` | Orchestrator only (steps 1, 3b, 5, 6a) | **LOW** | Sequential steps within single session, no concurrent writers |
| `followup-staging.md` | PR Monitor (writes) + Orchestrator (read+clear) | **MEDIUM** | Items lost between read and clear |
| `pr-ledger.md` | Orchestrator (steps 3b, 4b, 6a) + PR Monitor (step 6) | **MEDIUM** | Duplicate entries or lost closure records |
| `work-queue.md` | Orchestrator only (steps 1, 3a) | **LOW** | Scout writes to staging, not directly to queue |
| `trust-repos.md` | Orchestrator (step 6a) + PR Monitor (step 6) | **LOW** | Rare writes, both promote on merge |

## The Critical Race: pr-followup-state.md

1. Orchestrator reads pr-followup-state.md (version A)
2. PR Monitor scans PRs, finds PR #123 approved, writes updated state (version B)
3. Orchestrator finishes processing, writes its update based on version A (overwrites version B)
4. PR Monitor's "approved" status is lost -> merge never happens

This is the **highest-value action** in the system being silently dropped.

## Recommended Mitigations

### Option 1: Separate files per writer (RECOMMENDED - simplest)
- PR Monitor writes to `memory/pr-monitor-state.md`
- Orchestrator writes to `memory/pr-followup-state.md`
- Orchestrator reads BOTH files to get complete picture
- No concurrent writes to same file = no race condition

Changes needed:
- `subagent-pr-monitor.md` line 153: change `pr-followup-state.md` to `pr-monitor-state.md`
- `subagent-pr-monitor.md` line 200: same change
- `HEARTBEAT.md` step 2a: add "Read BOTH `memory/pr-followup-state.md` AND `memory/pr-monitor-state.md`"
- Same pattern for pr-ledger.md if needed

### Option 2: Atomic staging with rename
For followup-staging.md (read+clear race):
- Orchestrator renames: `mv followup-staging.md followup-staging-processing.md`
- Orchestrator processes the renamed file
- Orchestrator deletes the renamed file
- If PR Monitor writes during processing, items go to fresh `followup-staging.md`
- No items lost

### Option 3: Lock files per state file
- Before writing any shared state: `echo $$ > memory/locks/{filename}.lock`
- After write: `rm memory/locks/{filename}.lock`
- Check lock before write: skip if locked
- Simple but adds latency and another potential for stale locks

### Not Recommended: Append-only files
Would require rewriting all state management. Reads become expensive (parse full history). Not worth the architectural cost for the marginal improvement over Option 1.

## Also Related: Completion Bottleneck

Subagent completion flows through: `announce completion -> gateway WS -> orchestrator processes -> update spawn state -> release lock`. With gateway's 90s timeout, this pipeline can stall. Multiple completions queuing up compounds the problem.

Not fixable without OpenClaw changes. Current mitigation: HEARTBEAT step 1 stall recovery (kill stalled agents after 5 min, re-queue). Risk: if orchestrator itself stalls during result processing, all pending completions cascade.

## Priority

Fix AFTER the PATH bug (P0). The race conditions cause occasional state corruption, but the PATH bug causes ALL gates to be bypassed on EVERY cycle. Fix order:
1. PATH bug (P0) - 12 path fixes across 5 files
2. State race conditions (P2) - separate files per writer
3. Completion bottleneck - monitoring only, no fix available
