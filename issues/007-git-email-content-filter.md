# 007: Git Email Triggers Content Filter

**Status:** Fixed
**Severity:** Low
**Component:** Git Configuration / OpenRouter Content Filter

## Description

The original git email configuration used a real email address (`drsparrowhawk@proton.me`) for the BillionClaw GitHub identity. When this email appeared in git log output, commit messages, or configuration files processed through the OpenRouter API, the content filter replaced it with `[EMAIL]`, causing garbled output.

This is related to issue #001 (content filter poisoning) but has a specific fix.

## Root Cause

OpenRouter's content filter applies to all text, including git metadata. A real email address in git config means every `git log`, `git show`, or `git blame` output that passes through the API gets filtered.

## Impact

- Git log output showed `[EMAIL]` instead of the author email
- Agent could not reliably parse git history when email appeared in output
- Commit attribution was confusing in filtered context

## Fix Applied

Changed the git email to GitHub's noreply format which is not caught by content filters:

```
billionclaw+clawoss@users.noreply.github.com
```

This format is recognized by GitHub for commit attribution but does not trigger OpenRouter's email content filter. Updated in:
- `scripts/setup.sh` (git config)
- `.env.example` (GITHUB_EMAIL variable)

## Related Files

- `scripts/setup.sh` (line 34, git config)
- `.env.example` (GITHUB_EMAIL)
- Issue #001 (related content filter problem)
