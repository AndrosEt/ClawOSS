# 005: Model Fallback to Anthropic — Unintended Expensive API Calls

**Status:** Fixed
**Severity:** High
**Component:** OpenClaw Gateway / Model Configuration

## Description

When Minimax M2.5 was unavailable or returned errors via OpenRouter, OpenClaw's default fallback behavior routed requests to Anthropic's Claude models instead. This caused unexpected cost spikes since Claude Sonnet/Opus tokens are 11-16x more expensive than M2.5.

The agent would silently switch to Claude without any indication in the session, consuming budget at a drastically higher rate.

## Observed During v5 Launch

- **Time:** 2026-03-16 17:49-17:50 UTC (cascaded from session lock, issue #002)
- **Error:** `No API key found for provider "anthropic". Auth store: ...auth-profiles.json`
- Auto-fallback chain: `openrouter/minimax/minimax-m2.5` -> `anthropic/claude-opus-4-6`
- Result: `All models failed (2)` — complete agent failure

## Root Cause

OpenClaw's default model configuration includes implicit fallback chains. If the primary model fails, the gateway falls back to its built-in default models (Anthropic Claude). Without explicitly disabling fallbacks, every primary model outage triggered expensive Claude API calls (or auth failures if no Anthropic key).

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
