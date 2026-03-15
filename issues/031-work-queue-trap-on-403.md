# 031: Work Queue Trap — 403 Content Filter Kills Before Error Handling

**Status:** Mitigated (blocklist + PII sanitizer, but structural risk remains)
**Severity:** High
**Component:** HEARTBEAT.md work queue / OpenRouter content filter
**Predicted by:** throughput-critic V6 bug audit (2026-03-16)

## Description

When the agent picks a work queue item from a repo whose files trigger OpenRouter's content filter (403), the 403 kills the API call before the agent's error-handling code can execute. This means:

1. The circuit breaker in `wake-state.md` never increments `errors_this_hour`
2. The item is never removed from the work queue
3. The next heartbeat picks the same item again
4. Result: infinite loop of pick -> 403 -> die -> pick

## Observed

- **Time:** 2026-03-16 ~18:42 UTC
- **Repo:** `Nexal-AI/voicecrew` — `package.json` contains author email
- voicecrew was 5 of the top 15 work queue items
- Each pick triggered content filter death before stall recovery could fire

## Mitigations Applied

1. **Blocklisted voicecrew** in `workspace/memory/repos/blocklist.md` (commit `d18fd84`)
2. **Reordered work queue** to put non-email-containing repos first (commit `d18fd84`)
3. **PII sanitizer hook** (#030) now strips emails from tool results before they enter context
4. **HEARTBEAT.md rules** instruct agent to use `jq` to skip author fields in package.json

## Remaining Risk

The PII sanitizer (#030) should prevent most 403s going forward, but the structural issue remains: if a 403 occurs for any reason (not just email content), the agent dies before it can handle the error. There is no gateway-level error handler that removes work queue items on repeated 403s.

A defense-in-depth fix would be a gateway hook or cron job that detects repeated 403s on the same repo and auto-blocklists it.

## Related Issues

- #001 — OpenRouter content filter poisoning (root cause)
- #030 — PII sanitizer plugin (primary fix)
- #032 — Telemetry gap on 403 (dashboard doesn't see the failure)

## Related Files

- `workspace/memory/work-queue.md`
- `workspace/memory/repos/blocklist.md`
- `workspace/HEARTBEAT.md` (step 3: queue management)
- `workspace/hooks/pii-sanitizer/handler.ts`
