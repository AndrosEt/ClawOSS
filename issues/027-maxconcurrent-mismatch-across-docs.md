# 027: maxConcurrent Mismatch Across Config and Docs

**Status:** Fixed (all docs aligned to maxConcurrent: 5, no timeout — user's explicit preference)
**Severity:** Medium
**Component:** config/openclaw.json, workspace/HEARTBEAT.md, workspace/AGENTS.md

## Description

The `maxConcurrent` value for sub-agents is inconsistent across configuration and documentation files:

| Source | Value | Notes |
|--------|-------|-------|
| `config/openclaw.json` (line 26) | `5` | Actual runtime config |
| `workspace/AGENTS.md` (line 23) | `5` | "up to 5 sub-agents working in parallel" |
| `workspace/HEARTBEAT.md` (line 148) | `1` | "config enforces ONE sub-agent at a time" |
| Commit `6763be3` message | `1` | "restore sub-agent discipline — maxConcurrent:1" |
| `research/06-throughput-architecture.md` | `1` | Original architecture design used serialized execution |

## Impact

The agent reads HEARTBEAT.md during every cycle (lightContext mode). If it trusts the HEARTBEAT.md claim of `maxConcurrent: 1`, it will serialize sub-agents unnecessarily. If it trusts the config (which is the actual runtime value), it could run 5 in parallel.

The commit `6763be3` claims to "restore sub-agent discipline to match config — maxConcurrent:1" but the config actually says `5`. Either:
1. The config was changed to 5 **after** that commit, or
2. The commit message is misleading

## Recommended Fix

Decide on the intended value (1 or 5) and update all references to match:
- If serialized (1): Update `config/openclaw.json` and `workspace/AGENTS.md` to `maxConcurrent: 1`
- If parallel (5): Update `workspace/HEARTBEAT.md` line 148 to `maxConcurrent: 5`

## Related Files

- `config/openclaw.json` (line 26)
- `workspace/HEARTBEAT.md` (line 148)
- `workspace/AGENTS.md` (line 23)
- Commit: `6763be3`
