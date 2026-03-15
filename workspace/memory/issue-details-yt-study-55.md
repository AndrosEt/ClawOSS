# Issue #55: Track upstream Google consent 500s

## Repository
whoisjayd/yt-study

## Issue Details
- Number: 55
- Title: Track upstream Google consent 500s behind removed OAuth flow
- State: OPEN
- Labels: type:bug, help-wanted, priority:medium, severity:critical

## Problem
Google's device-flow consent screen fails with 500 Internal Server Error during OAuth approval. This happens upstream before token issuance completes.

## Impact
- `--use-oauth` and token-cache flags were removed from CLI
- `--cookies` was removed
- OAuth config keys deprecated
- yt-study now supports public YouTube access only

## Task
This issue is for tracking/monitoring the upstream problem. The work involves:
1. Documenting the upstream issue
2. Monitoring pytubefix and youtube-transcript-api for fixes
3. Potentially adding error handling for users who try OAuth
4. Update documentation about supported access methods

## Notes
- OAuth was already removed from the codebase
- This is a tracking/documentation issue
- May need to update README/docs to clarify limitations