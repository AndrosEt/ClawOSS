# Issue #162: Enable daf note command inside Claude Code sessions

## Repository
itdove/devaiflow (devaiflow)

## Issue Details
- Number: 162
- Title: Enable daf note command inside Claude Code sessions
- State: OPEN
- Labels: enhancement, task, good-first-issue

## Problem
The `daf note` command is blocked from running inside Claude Code sessions via the `@require_outside_claude` decorator. This creates UX friction.

## Investigation
- `daf note` only appends to `sessions/<name>/notes.md`
- Does NOT modify session index or metadata
- `daf jira add-comment` (external API writes) is allowed inside sessions
- Inconsistency suggests overly conservative blocking

## Implementation Plan
1. Remove `@require_outside_claude` decorator from `devflow/cli/commands/note_command.py:17`
2. Add file locking to `FileBackend.add_note()` using `fcntl.flock` (like sessions.json)
3. Update 7 documentation files to remove warning blocks
4. Add tests for inside-session usage

## Acceptance Criteria
- [ ] Remove @require_outside_claude decorator from add_note()
- [ ] Add file locking to FileBackend.add_note()
- [ ] Update documentation files
- [ ] Add tests
- [ ] Verify daf note works inside Claude Code sessions
- [ ] All existing tests pass