# Issue #22: Feature: Authenticated YouTube Requests (Cookie Support)

## Problem
Current implementation is unauthenticated, causing failures on age-gated videos, members-only content, or private playlists.

## Proposed Solution
Implement support for loading cookies from a file or browser to authenticate requests.

## Implementation Details
- Add `--cookies` CLI argument (path to Netscape format cookies.txt)
- Update `fetch_transcript` to use provided cookies
- Pass cookies to `youtube-transcript-api`
- Ensure cookies are NOT logged in debug output

## Acceptance Criteria
- [ ] User can pass a cookies.txt file
- [ ] Age-gated videos can be processed successfully
- [ ] Private playlists (accessible to user) can be processed

## Target File
- `src/yt_study/youtube/transcript.py`
