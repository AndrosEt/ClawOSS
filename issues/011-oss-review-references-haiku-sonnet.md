# 011: oss-review Skill References Haiku/Sonnet for Independent Review

**Status:** Fixed
**Severity:** Low
**Component:** workspace/skills/oss-review/SKILL.md

## Description

The `oss-review` skill's independent review section (line 38) instructs: "Use Haiku or Sonnet (different from implementation model)". However, the project uses Minimax M2.5 via OpenRouter as the only model. There is no Haiku or Sonnet configured, and `fallbacks: []` is explicitly set to prevent Anthropic model usage.

## Root Cause

This instruction was written before the model switch from Claude to Minimax M2.5. The original architecture assumed Claude Sonnet for implementation and Haiku for cheap review tasks.

## Impact

- Agent may attempt to use an unconfigured model for independent review
- If OpenClaw interprets "Haiku" literally, the review step could fail
- The instruction is misleading given the current single-model configuration

## Recommended Fix

Change line 38 from:
```
- Use Haiku or Sonnet (different from implementation model)
```
To:
```
- Use a fresh session with clean context (no implementation history)
```

The independent review value comes from the clean context, not from using a different model.

## Related Files

- `workspace/skills/oss-review/SKILL.md` (line 38)
- `config/openclaw.json` (model configuration)
- Issue #005 (model fallback disabled)
