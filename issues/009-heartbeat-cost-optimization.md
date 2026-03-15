# 009: Heartbeat Cost Optimization — Use lightContext + Efficient Model

**Status:** Fixed
**Severity:** Medium
**Component:** OpenClaw Heartbeat / Cost Management

## Description

The original heartbeat configuration used the full agent context (all workspace files loaded) with a 60-minute interval and the default Opus/Sonnet model. Each heartbeat consumed $0.50-$1.00 in tokens, resulting in $12-24/day just for heartbeat overhead — a significant portion of the $5-15/day target budget.

## Root Cause

Default OpenClaw heartbeat behavior loads the full bootstrap context (AGENTS.md, SOUL.md, USER.md, etc.) on every heartbeat invocation. For a simple "check status and decide next action" operation, this is wasteful. Additionally, using an expensive model for routine status checks multiplied the cost.

## Impact

- Heartbeat cost dominated the daily budget (up to 50% of total spend)
- Reduced budget available for actual implementation work
- At 60-minute intervals with full context, the agent was paying premium prices for routine checks

## Fix Applied

Multiple optimizations applied:

1. **lightContext: true** — Heartbeat runs with minimal context, not the full workspace bootstrap. Only HEARTBEAT.md is loaded (which now contains embedded safety rules since AGENTS.md is not available in light mode).

2. **Model: M2.5** — Heartbeat uses the same M2.5 model (already very cheap at $0.27/MTok input, $1.10/MTok output via OpenRouter). Originally the plan called for Haiku but M2.5 is cheaper and more capable.

3. **Interval: 10 minutes** — Reduced from 60 minutes to enable faster autonomous loop cycling. The cheap model + light context makes frequent heartbeats affordable.

4. **Efficient prompt** — Heartbeat prompt instructs: "If nothing needs attention, reply HEARTBEAT_OK" to minimize output tokens on idle cycles.

```json
"heartbeat": {
  "every": "10m",
  "model": "openrouter/minimax/minimax-m2.5",
  "session": "main",
  "target": "none",
  "prompt": "Read HEARTBEAT.md. Follow it strictly...",
  "lightContext": true
}
```

Estimated heartbeat cost after optimization: ~$0.02-0.05 per cycle, $2-7/day at 10-minute intervals.

## Related Files

- `config/openclaw.json` (heartbeat configuration, lines 31-37)
- `workspace/HEARTBEAT.md` (embedded safety rules for lightContext mode)
- `research/06-throughput-architecture.md` (heartbeat optimization analysis)
