# 012: safety-checker Skill References "Isolated Sonnet Subagent"

**Status:** Fixed
**Severity:** Low
**Component:** workspace/skills/safety-checker/SKILL.md

## Description

The `safety-checker` skill's independent review check (line 47) instructs: "Spawn an isolated Sonnet subagent via `sessions_spawn`". The project no longer uses Claude Sonnet — it uses Minimax M2.5 exclusively.

## Root Cause

Same as issue #011 — stale model reference from pre-M2.5 architecture.

## Impact

- May cause confusion about which model to use for review subagent
- If interpreted literally, could attempt to use an unconfigured model

## Recommended Fix

Change line 47 from:
```
Spawn an isolated Sonnet subagent via `sessions_spawn` with ONLY the diff...
```
To:
```
Spawn an isolated subagent via `sessions_spawn` with ONLY the diff...
```

## Related Files

- `workspace/skills/safety-checker/SKILL.md` (line 47)
- `config/openclaw.json` (model configuration)
- Issue #011 (same class of stale model reference)
