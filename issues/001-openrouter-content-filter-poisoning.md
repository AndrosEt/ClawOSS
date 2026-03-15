# 001: OpenRouter Content Filter — GitHub Issue Content Poisoning

**Status:** Mitigated
**Severity:** High (upgraded from Medium — causes 403 infinite loops)
**Component:** OpenRouter Gateway / Minimax M2.5

## Description

When the agent reads GitHub issue content that contains email addresses or phone numbers, OpenRouter's content filter either:
1. Replaces them with `[EMAIL]` and `[PHONE]` placeholders (garbling text), OR
2. **Blocks the entire request with a 403 error** when the PII content is in the session history

The 403 behavior is the more severe problem: once PII-containing text enters the session context, every subsequent API call fails with 403, creating an infinite loop that blocks all agent operations until the session is reset.

## Root Cause

OpenRouter applies content filtering on all text passing through its API, including tool outputs and system messages. When `[EMAIL]` or `[PHONE]` patterns appear in the conversation history sent to the API, it triggers a 403 rejection. This is a platform-level behavior that cannot be disabled through ClawOSS configuration.

## Impact

- **Critical:** 403 infinite loops block all agent turns until session reset
- Memory files may contain `[EMAIL]` and `[PHONE]` placeholders
- PR descriptions that reference issue content may include garbled filter artifacts
- Agent's understanding of issue context is degraded
- Particularly affects issues in projects that discuss email/phone functionality

## Mitigation Applied (commit 6a84563)

Safety rules added to `AGENTS.md`, `HEARTBEAT.md`, and `oss-discover` skill:
- Never copy raw issue text verbatim — always summarize instead
- Use `--json` flag with `gh` commands for structured data only
- Skip items with PII patterns (`[EMAIL]`, `[PHONE]`)
- Never retry 403 errors — treat as permanent failure and skip
- If 403 occurs, the current item is poisoned — abandon and move to next

## Remaining Risk

The mitigation is behavioral (prompt-based), not enforced. If the agent encounters PII before these rules take effect (e.g., in a new context without AGENTS.md loaded in lightContext mode), it can still get stuck. The HEARTBEAT.md now includes these rules inline for lightContext safety.

## Related Files

- `workspace/AGENTS.md` (content filter safety rules)
- `workspace/HEARTBEAT.md` (inline safety rules for lightContext)
- `workspace/skills/oss-discover/SKILL.md` (PII skip rules)
- `config/openclaw.json` (model routing configuration)
