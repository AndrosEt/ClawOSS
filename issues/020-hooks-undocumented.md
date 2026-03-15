# 020: OpenClaw Hooks Not Documented in README or Architecture

**Status:** Open
**Severity:** Medium
**Component:** Documentation / Hooks

## Description

The project includes two OpenClaw hooks in `workspace/hooks/` that are not documented anywhere in the README, architecture diagram, file tree, or CHANGELOG:

1. **`dashboard-reporter` hook** — Automatically posts telemetry (heartbeats, metrics, conversation messages) to the dashboard after each agent turn and tool call
2. **`audit-logger` hook** — Logs all significant agent actions (sessions, tool calls, completions, errors) to the dashboard audit log

These hooks are distinct from the `dashboard-reporter` skill — the hooks run automatically on OpenClaw events, while the skill is invoked explicitly by the agent.

## Impact

- Users don't know hooks exist or what they do
- The README's architecture section and file tree don't mention `workspace/hooks/`
- The validation script doesn't check hooks
- The hooks are critical infrastructure — they provide the data that populates the dashboard

## Recommended Fix

1. Add `workspace/hooks/` to the README file tree
2. Add a "Hooks" section to the README explaining the two hooks
3. Add hooks validation to `scripts/validate-config.mjs`
4. Document the hook/skill distinction (hooks are automatic, skills are explicit)

## Related Files

- `workspace/hooks/dashboard-reporter/HOOK.md`
- `workspace/hooks/dashboard-reporter/handler.ts`
- `workspace/hooks/audit-logger/HOOK.md`
- `workspace/hooks/audit-logger/handler.ts`
- `README.md` (Architecture section)
