# 001: OpenRouter Content Filter — GitHub Issue Content Poisoning

**Status:** Open
**Severity:** Medium
**Component:** OpenRouter Gateway / Minimax M2.5

## Description

When the agent reads GitHub issue content that contains email addresses or phone numbers, OpenRouter's content filter replaces them with `[EMAIL]` and `[PHONE]` placeholders. This polluted content then persists in the agent's session context and memory files, poisoning downstream operations.

For example, if an issue body contains `contact@example.com`, the agent sees `[EMAIL]` instead. If this gets written to memory files or included in PR descriptions, it produces confusing output.

## Root Cause

OpenRouter applies content filtering on all text passing through its API, including tool outputs and system messages. This is a platform-level behavior that cannot be disabled through ClawOSS configuration. Minimax M2.5 via OpenRouter inherits this filter regardless of the prompt.

## Impact

- Memory files may contain `[EMAIL]` and `[PHONE]` placeholders instead of actual content
- PR descriptions that reference issue content may include garbled filter artifacts
- Agent's understanding of issue context is degraded when contact information is relevant
- Particularly affects issues in projects that discuss email/phone functionality

## Workaround

- Avoid writing raw GitHub issue content directly to memory files
- Summarize issue content rather than quoting it verbatim
- For issues involving email/phone functionality, the agent may need to re-read the original issue via `gh issue view` each time rather than relying on cached context

## Fix Applied

None — this is an inherent limitation of the OpenRouter platform. Direct MiniMax API access would avoid this filter but loses OpenRouter's provider fallback routing.

## Related Files

- `config/openclaw.json` (model routing configuration)
- `workspace/AGENTS.md` (memory management instructions)
- `workspace/skills/oss-discover/SKILL.md` (issue discovery)
