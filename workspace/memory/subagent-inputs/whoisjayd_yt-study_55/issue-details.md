# Issue #55: Track upstream Google consent 500s behind removed OAuth flow

## What
Track and handle Google consent 500 errors that occur after OAuth flow removal.

## Context
YouTube API changes have affected authentication. Need to handle new error patterns.

## Acceptance Criteria
- Detect Google consent 500 errors
- Provide user-friendly error messages
- Suggest alternative approaches
