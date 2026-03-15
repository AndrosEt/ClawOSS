# 005: Model Fallback to Anthropic — Unintended Expensive API Calls

**Status:** Fixed
**Severity:** High
**Component:** OpenClaw Gateway / Model Configuration

## Description

When Minimax M2.5 was unavailable or returned errors via OpenRouter, OpenClaw's default fallback behavior routed requests to Anthropic's Claude models instead. This caused unexpected cost spikes since Claude Sonnet/Opus tokens are 11-16x more expensive than M2.5.

The agent would silently switch to Claude without any indication in the session, consuming budget at a drastically higher rate.

## Root Cause

OpenClaw's default model configuration includes implicit fallback chains. If the primary model (`openrouter/minimax/minimax-m2.5`) fails, the gateway falls back to its built-in default models (Anthropic Claude). Without explicitly disabling fallbacks, every M2.5 outage triggered expensive Claude API calls.

## Impact

- Cost spikes of 10-16x during M2.5 outages
- Daily budget could be consumed in a single session
- No visible indication that the model switched
- Responses might differ in style/capability between models

## Fix Applied

Set `fallbacks: []` (empty array) in `config/openclaw.json` to explicitly disable all model fallback:

```json
"model": {
  "primary": "openrouter/minimax/minimax-m2.5",
  "fallbacks": []
}
```

With this configuration, if M2.5 is unavailable, the agent will fail with an error rather than silently switching to an expensive alternative. The heartbeat circuit breaker will detect the errors and pause until the model is available again.

## Related Files

- `config/openclaw.json` (lines 8-10, model configuration)
- Commit: `38373c5` — "fix: disable model fallback, add skill symlinks to setup"
