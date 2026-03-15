# 004: Context Window Overflow — Sessions Can Exceed Context Limit

**Status:** Open
**Severity:** High
**Component:** Minimax M2.5 / OpenClaw Compaction

## Description

Minimax M2.5 has a 196K token context window (compared to Claude's 200K-1M). During complex multi-step operations (repo analysis + implementation + review + PR creation), the session context can grow past the model's context limit, reaching up to 113% of capacity in observed cases.

When this happens, the model receives truncated context, leading to incoherent responses, lost work state, and potential submission of incomplete PRs.

## Root Cause

Multiple factors compound to fill the context window:
- System prompt + workspace files: ~5-10K tokens
- Repository file reads and grep results: 50-200K tokens per exploration
- Tool call history grows ~10-20K tokens per round-trip
- Git diff, test output, and lint output each add 5-50K tokens
- M2.5's 196K context is smaller than Claude's 200K+ default

OpenClaw's compaction mode is set to `safeguard` which triggers compaction at capacity, but by that point context may already be degraded.

## Impact

- Model produces incoherent or contradictory responses
- Work-in-progress state (branch names, file changes, approach decisions) can be lost
- PRs may be submitted with incomplete implementations
- Repeated approaches to the same problem after context loss wastes tokens

## Workaround

- The `context-manager` skill instructs the agent to proactively flush state to memory before hitting capacity
- The v5 architecture delegates implementation to sub-agents which get fresh 196K contexts per task
- Keep tasks small (max 200 LOC, max 5 files) to reduce per-task context consumption
- Use `lightContext: true` for heartbeat and cron jobs to minimize baseline context usage

## Fix Applied

Partial — the orchestrator + sub-agent architecture (v5) mitigates this by isolating implementation work in fresh contexts. The main orchestrator session still accumulates context over time but handles less data-intensive work (task dispatch, not code reading).

## Related Files

- `workspace/HEARTBEAT.md` (orchestrator loop)
- `workspace/AGENTS.md` (context window management section)
- `workspace/skills/context-manager/SKILL.md`
- `config/openclaw.json` (`compaction.mode: "safeguard"`)
