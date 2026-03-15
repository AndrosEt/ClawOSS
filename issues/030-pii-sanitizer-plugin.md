# 030: PII Sanitizer Plugin — Permanent Content Filter Fix

**Status:** Pending (architect implementing)
**Severity:** High
**Component:** workspace/hooks/pii-sanitizer/

## Description

A new OpenClaw hook plugin that strips PII (emails, phone numbers, IP addresses) from tool results before they enter the session context. This uses the `tool_result_persist` hook event, which fires after a tool returns but before the result is persisted to the session JSONL file.

This permanently fixes issue #001 (OpenRouter content filter poisoning) at the source — PII never enters the context, so it can never trigger a 403 loop.

## How It Works

1. Tool executes and returns a result
2. `tool_result_persist` hook fires with the result content
3. PII sanitizer scans for patterns: emails, phone numbers, IPs, SSNs, credit card numbers
4. Matches are replaced with safe placeholders (`[EMAIL]`, `[PHONE]`, `[IP]`, etc.)
5. Sanitized result is persisted to the session context

## Why This Is Better Than Behavioral Rules

Issue #001 was mitigated with prompt-based rules ("never copy raw issue text"). But those rules are behavioral — the agent can violate them, especially in lightContext mode where AGENTS.md isn't loaded. The PII sanitizer operates at the hook level, below the agent's control, making it impossible for PII to enter the context regardless of agent behavior.

## Relationship to Issue #001

- Issue #001 status will change from "Mitigated" to "Fixed" once this lands
- The behavioral rules in AGENTS.md and HEARTBEAT.md remain as defense-in-depth
- The hook provides the enforcement layer; the prompt rules provide the intent layer

## Related Files

- `workspace/hooks/pii-sanitizer/handler.ts` (implementation)
- `workspace/hooks/pii-sanitizer/HOOK.md` (documentation)
- `issues/001-openrouter-content-filter-poisoning.md` (parent issue)
- `workspace/AGENTS.md` (Content Filter Safety section)
- `workspace/HEARTBEAT.md` (Content Filter Safety section)
