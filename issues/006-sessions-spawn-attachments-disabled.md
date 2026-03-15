# 006: Sessions Spawn Attachments Disabled by Default

**Status:** Fixed
**Severity:** High
**Component:** OpenClaw Gateway / Sub-Agent Architecture

## Description

The v5 throughput architecture relies on spawning sub-agent sessions via `sessions_spawn` with file attachments (repo conventions, issue details). By default, OpenClaw disables attachments on `sessions_spawn`, causing sub-agents to launch without the context files they need for implementation.

Without attachments, sub-agents have no knowledge of repo conventions, issue details, or prior analysis — they operate blind and produce lower-quality contributions.

## Root Cause

OpenClaw's `tools.sessions_spawn.attachments.enabled` defaults to `false` as a security measure. The v5 architecture requires this to be explicitly enabled since the orchestrator passes context to sub-agents via attachments (the only way to share data, since sub-agents cannot access memory tools).

## Impact

- Sub-agents launched without necessary context files
- Implementation quality degraded due to missing repo conventions
- Sub-agents would re-analyze repos from scratch, wasting tokens and time
- The orchestrator + sub-agent pattern was effectively broken

## Fix Applied

Added top-level `tools` configuration to `config/openclaw.json`:

```json
"tools": {
  "sessions_spawn": {
    "attachments": {
      "enabled": true
    }
  }
}
```

This enables the orchestrator to pass files to sub-agents as attachments when spawning implementation sessions.

## Related Files

- `config/openclaw.json` (lines 52-58, tools configuration)
- `workspace/HEARTBEAT.md` (step 4, spawn implementation sub-agent)
- Commit: `9ca25d9` — "fix: enable sessions_spawn attachments at top-level tools config"
