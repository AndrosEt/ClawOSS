# 022: Cloned Repos in Workspace Should Be Gitignored

**Status:** Fixed (.gitignore updated)
**Severity:** Low
**Component:** .gitignore, workspace/

## Description

Sub-agents clone target repositories into `workspace/` as part of the implementation workflow. The first example is `workspace/4x-game-agent/` — a fork of `sonpiaz/4x-game-agent` (forked to `BillionClaw/4x-game-agent`) that the sub-agent cloned while working on issue #9 (template matching tests).

This is **expected behavior** — sub-agents need to clone repos to implement fixes. However, these cloned repos should not be committed to the ClawOSS parent repository.

## Fix Applied

Added to `.gitignore`:
```
# Sub-agent cloned repos (sub-agents clone target repos into workspace/)
workspace/4x-game-agent/
```

Note: A broad `workspace/*/` pattern is not safe because `workspace/` contains our own files like `skills/`, `hooks/`, `memory/`. Only specific cloned repo directories should be ignored.

## Related Files

- `.gitignore`
- `workspace/4x-game-agent/` (first cloned repo)
