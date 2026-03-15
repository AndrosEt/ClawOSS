# 038: Dual PII Sanitizer Implementations — Unclear Which Is Active

**Status:** Open
**Severity:** Low (confusion risk, maintenance burden, no active breakage)
**Component:** plugins/pii-sanitizer/, workspace/hooks/

## Description

ClawOSS has two separate PII sanitizer implementations:

1. **Plugin** (`plugins/pii-sanitizer/index.js`, 101 lines): An OpenClaw plugin that registers three hooks via `api.registerHook()`:
   - `beforeModelCall` — sanitizes outbound content (@ -> fullwidth @)
   - `afterModelCall` — desanitizes inbound content (fullwidth @ -> @)
   - `beforeToolCall` — sanitizes tool arguments

2. **Hook** (`workspace/hooks/` directory): Individual hook handlers that run as part of the workspace hook system, with their own PII handling logic embedded in the dashboard-reporter and audit-logger.

The plugin approach (bidirectional @ <-> U+FF20 swapping) was designed to work around OpenRouter's content filter blocking `@` symbols in file contents. However, the current model (Kimi K2.5 via direct API, or GLM-5 via OpenRouter) may or may not have this plugin active depending on the `openclaw.json` configuration.

## Impact

1. **Confusion**: Contributors and the team-lead cannot tell which sanitizer is actually running without reading `openclaw.json` plugin configuration
2. **Double sanitization risk**: If both systems are active, content could be sanitized twice (@ -> fullwidth @ -> double-encoded)
3. **Maintenance burden**: Bug fixes or improvements must be applied to both implementations
4. **Documentation gap**: README and issue files reference "PII sanitizer" without specifying which one

## Root Cause

The plugin was built as a clean, reusable solution (#030). The hook-level sanitization was added earlier as a quick fix. Neither was removed when the other was introduced, and the config doesn't make it obvious which is active.

## Fix

1. **Audit**: Check `config/openclaw.json` to determine if the plugin is listed in the `plugins` array. If yes, the plugin is active and hook-level sanitization should be removed (or vice versa).
2. **Pick one**: The plugin approach is cleaner (single file, proper register/deregister lifecycle). If the plugin works correctly, remove any ad-hoc PII handling from workspace hooks.
3. **Document**: Add a note to README or AGENTS.md specifying which sanitizer is active and when it's needed (only for OpenRouter, not for direct API access).
4. **Conditional activation**: The plugin could self-disable when the model provider is a direct API (no content filter), reducing unnecessary string manipulation.

## Related Issues

- #001 — OpenRouter content filter poisoning (root cause for needing PII sanitizer)
- #030 — PII sanitizer plugin creation
- #033 — OpenRouter blocks model's own code output with @ symbols

## Related Files

- `plugins/pii-sanitizer/index.js` (plugin implementation)
- `config/openclaw.json` (plugin activation config)
- `workspace/hooks/dashboard-reporter/handler.ts` (may contain inline sanitization)
- `workspace/hooks/audit-logger/handler.ts` (may contain inline sanitization)
