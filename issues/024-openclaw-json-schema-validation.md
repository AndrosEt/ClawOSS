# 024: Invalid openclaw.json Schema — Many Guessed Config Keys

**Status:** Fixed (validated via DeepWiki against actual Zod schema)
**Severity:** Medium
**Component:** config/openclaw.json

## Description

The `config/openclaw.json` file went through 8+ iterations during initial development because many config keys were guessed incorrectly. Invalid keys included `compaction.targetTokens`, `session.scope`, and others that don't exist in OpenClaw's actual Zod schema.

## Root Cause

OpenClaw's configuration schema is not fully documented in public docs. The correct schema was eventually validated using DeepWiki to inspect the actual Zod validation schema in the OpenClaw codebase.

## Fix Applied

All config keys in the final `openclaw.json` have been validated against the actual OpenClaw schema:
- `compaction.mode: "safeguard"` (valid)
- `compaction.reserveTokens`, `keepRecentTokens`, `maxHistoryShare`, `recentTurnsPreserve` (valid)
- `compaction.memoryFlush.enabled`, `softThresholdTokens` (valid)
- `compaction.postCompactionSections` (valid)
- `model.primary`, `model.fallbacks` (valid)
- `subagents.model`, `maxConcurrent`, `runTimeoutSeconds` (valid)
- `tools.sessions_spawn.attachments.enabled` (valid)
- `skills.load.watch` (valid)

## Related Files

- `config/openclaw.json`
- `research/08-openclaw-complete-reference.md`
