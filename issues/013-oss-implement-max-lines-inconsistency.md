# 013: Inconsistent Max Lines Changed Limit (200 vs 500)

**Status:** Fixed
**Severity:** Low
**Component:** Workspace files / Skills

## Description

There are inconsistent limits for maximum lines changed per PR across the codebase:

- `workspace/AGENTS.md` line 33: "NEVER submit PRs larger than 200 lines changed"
- `workspace/HEARTBEAT.md` line 16: "Max 200 lines changed"
- `workspace/skills/oss-implement/SKILL.md` line 28: "Max 200 lines changed"
- `workspace/skills/safety-checker/SKILL.md` line 19: "Total lines changed < 200"
- `workspace/TOOLS.md` line 17: "Always check diff size: reject if >500 lines changed"

TOOLS.md says 500 while everything else says 200.

## Root Cause

TOOLS.md was written from the original implementation plan which specified 500 lines. The v5 architecture and devil's advocate review tightened this to 200, but TOOLS.md was not updated.

## Impact

- Agent may see conflicting instructions and use the higher limit
- In lightContext mode (heartbeat), TOOLS.md may not be loaded, so the agent sees 200
- In full context, the agent sees both 200 and 500

## Recommended Fix

Update `workspace/TOOLS.md` line 17 from:
```
- Always check diff size: reject if >500 lines changed
```
To:
```
- Always check diff size: reject if >200 lines changed
```

## Related Files

- `workspace/TOOLS.md` (line 17)
- `workspace/AGENTS.md` (line 33)
- `workspace/HEARTBEAT.md` (line 16)
- `workspace/skills/safety-checker/SKILL.md` (line 19)
