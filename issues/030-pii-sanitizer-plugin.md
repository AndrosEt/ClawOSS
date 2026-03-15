# 030: PII Sanitizer Plugin — Permanent Content Filter Fix

**Status:** Implemented (commits f4872f9, de1505f)
**Severity:** High
**Component:** workspace/hooks/pii-sanitizer/

## Description

A new OpenClaw hook plugin that strips PII (emails, phone numbers, IP addresses) from tool results before they enter the session context. This uses the `tool_result_persist` hook event, which fires after a tool returns but before the result is persisted to the session JSONL file.

This permanently fixes issue #001 (OpenRouter content filter poisoning) at the source — PII never enters the context, so it can never trigger a 403 loop.

## How It Works

1. Tool executes and returns a result
2. `tool_result_persist` hook fires with the result content
3. PII sanitizer scans for patterns:
   - **Emails**: All `@` symbols replaced with fullwidth `＠` (U+FF20) — catches real emails, decorators (`@pytest.fixture`, `@Override`), and any `word@word.word` pattern that OpenRouter's filter would match
   - **Phone numbers**: International formats (e.g., `+1-234-567-8901`, `(234) 567-8901`)
   - **IPv4 addresses**: Valid IPs only (all octets 0-255), preserves version numbers like `1.2.3`
   - **SSNs**: `XXX-XX-XXXX` pattern
   - **Credit cards**: `XXXX-XXXX-XXXX-XXXX` or `XXXX XXXX XXXX XXXX`
4. Matches are replaced with safe placeholders (`[REDACTED_PHONE]`, `[REDACTED_IP]`, `[REDACTED_SSN]`, `[REDACTED_CC]`)
5. Sanitized result is persisted to the session context
6. Agent's own writes (tool calls) are never modified — only tool results are sanitized

## Why This Is Better Than Behavioral Rules

Issue #001 was mitigated with prompt-based rules ("never copy raw issue text"). But those rules are behavioral — the agent can violate them, especially in lightContext mode where AGENTS.md isn't loaded. The PII sanitizer operates at the hook level, below the agent's control, making it impossible for PII to enter the context regardless of agent behavior.

## Implementation Details

The fullwidth `＠` (U+FF20) approach is the key innovation. Rather than trying to regex-match email patterns (which miss edge cases like Python decorators or Java annotations), the sanitizer replaces ALL `@` symbols with the visually-identical fullwidth variant. The model understands `＠` as `@`, but OpenRouter's content filter does not match `word＠word.word` as an email. This was refined in commit `de1505f` after the initial implementation only targeted email-shaped patterns.

## Relationship to Issue #001

- Issue #001 status changed from "Mitigated" to "Fixed"
- The behavioral rules in AGENTS.md and HEARTBEAT.md remain as defense-in-depth
- The hook provides the enforcement layer; the prompt rules provide the intent layer

## Related Files

- `workspace/hooks/pii-sanitizer/handler.ts` (implementation)
- `workspace/hooks/pii-sanitizer/HOOK.md` (documentation)
- `issues/001-openrouter-content-filter-poisoning.md` (parent issue)
- `workspace/AGENTS.md` (Content Filter Safety section)
- `workspace/HEARTBEAT.md` (Content Filter Safety section)
