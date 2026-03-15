# 033: OpenRouter Blocks Model's Own Code Output Containing @ Symbols

**Status:** Open (BLOCKING — no workaround within OpenRouter)
**Severity:** Critical
**Component:** OpenRouter Content Filter / Session History
**Reported by:** team-lead (2026-03-16)

## Description

The PII sanitizer (#030) successfully strips `@` symbols from tool results (file reads, exec output) and explicitly written messages. However, there is an **unsolvable gap**: when the model generates code containing `@` symbols (e.g., `@pytest.fixture`, `@Override`, `@Component`), that output is the model's own assistant message. No OpenClaw hook can intercept or sanitize the model's streaming response before it enters the conversation history.

On the next API call, the full conversation history — including the assistant message with `@` patterns — is sent to OpenRouter, which blocks the request with a 403.

## Why This Is Unsolvable via Hooks

| Hook | Can Sanitize? | Why Not? |
|------|--------------|----------|
| `tool_result_persist` | Tool results only | Doesn't touch assistant messages |
| `before_message_write` | Explicit writes only | Model's streaming response bypasses this |
| `before_prompt_build` | Read-only | Cannot modify messages, only read them |
| Agent prompt rules | Behavioral only | Can't prevent the model from generating `@` in code |

The model MUST generate `@` in code — it's syntactically required for Python decorators, Java annotations, email addresses in test fixtures, etc. There is no way to tell the model to avoid `@` without breaking code quality.

## What Works

Everything else in the pipeline works correctly:
- PII sanitizer strips `@` from tool results (file reads)
- `ANNOUNCE_SKIP` bypasses the announce step (sub-agent results)
- Code quality from K2.5 is excellent
- Architecture, workflow, and quality gates all function properly

## Solution: Direct Moonshot API Key

The only fix is to bypass OpenRouter entirely for Kimi K2.5 and use the Moonshot API directly. Moonshot's own API does not have OpenRouter's content filter on `@` patterns.

**Requires:** User to provide a Moonshot API key and update `config/openclaw.json` to use the direct Moonshot endpoint instead of `openrouter/moonshotai/kimi-k2.5`.

## Impact

- **BLOCKING:** No autonomous PRs can be submitted until this is resolved
- Every code generation task that includes Python decorators, Java annotations, or email patterns will trigger 403
- The agent can discover and triage issues but cannot implement fixes

## Related Issues

- #001 — OpenRouter content filter poisoning (parent issue — now understood as partially fixed)
- #030 — PII sanitizer plugin (fixes tool results, not model output)
- #031 — Work queue trap on 403 (downstream effect)
- #032 — Telemetry gap on 403 (monitoring blind spot)

## Related Files

- `config/openclaw.json` (model endpoint configuration)
- `workspace/hooks/pii-sanitizer/handler.ts` (partial fix)
- `plugins/pii-sanitizer/` (compiled plugin)
