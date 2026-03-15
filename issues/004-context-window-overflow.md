# 004: Context Window Overflow — Sessions Can Exceed Context Limit

**Status:** Open (reduced severity after model switch)
**Severity:** Medium (was High with M2.5's 196K; now Medium with K2.5's 262K)
**Component:** Kimi K2.5 / OpenClaw Compaction

## Description

The model's context window can be exceeded during complex multi-step operations (repo analysis + implementation + review + PR creation). Originally observed with Minimax M2.5 (196K context, sessions reaching 113% capacity). After switching to Kimi K2.5 (262K context), the risk is reduced but not eliminated.

When this happens, the model receives truncated context, leading to incoherent responses, lost work state, and potential submission of incomplete PRs.

## Root Cause

Multiple factors compound to fill the context window:
- System prompt + workspace files: ~5-10K tokens
- Repository file reads and grep results: 50-200K tokens per exploration
- Tool call history grows ~10-20K tokens per round-trip
- Git diff, test output, and lint output each add 5-50K tokens
- K2.5's 262K context is larger than M2.5's 196K but still finite

OpenClaw's compaction mode is set to `safeguard` which triggers compaction at capacity, but by that point context may already be degraded.

## Impact

- Model produces incoherent or contradictory responses
- Work-in-progress state (branch names, file changes, approach decisions) can be lost
- PRs may be submitted with incomplete implementations
- Repeated approaches to the same problem after context loss wastes tokens

## Workaround

- The `context-manager` skill instructs the agent to proactively flush state to memory before hitting capacity
- The v5 architecture delegates implementation to sub-agents which get fresh 262K contexts per task
- Keep tasks small (max 200 LOC, max 5 files) to reduce per-task context consumption
- Use `lightContext: true` for heartbeat and cron jobs to minimize baseline context usage

## Fix Applied

Partial — the orchestrator + sub-agent architecture (v5) mitigates this by isolating implementation work in fresh contexts. The main orchestrator session still accumulates context over time but handles less data-intensive work (task dispatch, not code reading).

## Related Files

- `workspace/HEARTBEAT.md` (orchestrator loop)
- `workspace/AGENTS.md` (context window management section)
- `workspace/skills/context-manager/SKILL.md`
- `config/openclaw.json` (`compaction.mode: "safeguard"`)
