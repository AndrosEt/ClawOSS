---
name: pii-sanitizer
description: "Strips PII (emails, phones, IPs, SSNs, credit cards) from tool results to prevent OpenRouter content filter 403 errors"
homepage: https://github.com/billion-token-one-task/ClawOSS
metadata:
  { "openclaw": { "emoji": "🛡️", "events": ["tool_result_persist"], "requires": { "bins": [], "env": [] } } }
---

# PII Sanitizer Hook

Sanitizes tool results before they enter the session transcript.
Replaces email addresses, phone numbers, IP addresses, SSNs, and credit card numbers with safe placeholders.

## How It Works

Uses the `tool_result_persist` hook which runs synchronously BEFORE tool results are written to the session.
The model never sees raw PII, so OpenRouter's content filter never triggers 403.

## What Gets Sanitized

| Pattern | Replacement | Example |
|---------|-------------|---------|
| Email addresses | `[REDACTED_EMAIL]` | `user@example.com` |
| Phone numbers | `[REDACTED_PHONE]` | `+1-234-567-8901` |
| IPv4 addresses | `[REDACTED_IP]` | `192.168.1.1` |
| SSN patterns | `[REDACTED_SSN]` | `123-45-6789` |
| Credit card numbers | `[REDACTED_CC]` | `4111-1111-1111-1111` |

## What Is Preserved

- Code the agent writes (sanitizer only runs on tool RESULTS, not tool CALLS)
- Version numbers (e.g., `1.2.3` — only 4-octet valid IPs are redacted)
- URLs (only bare email addresses are matched, not `https://` URLs)
- GitHub usernames (`@username` is not an email)
- Regex patterns in code (the pattern structure is preserved without real addresses)

## Impact on PR Quality

None. The agent doesn't need author emails to fix code. Source code logic, test structures,
and config values are all preserved. Only PII in metadata fields gets redacted.
