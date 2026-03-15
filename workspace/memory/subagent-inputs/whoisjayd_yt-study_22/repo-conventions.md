# Repo Analysis: whoisjayd/yt-study

## Tech Stack
- **Language**: Python 3.10+
- **CLI**: Typer
- **Testing**: pytest, ruff, mypy

## Target
Add `--cookies` CLI argument for authenticated YouTube requests.

## Key Files
- `src/yt_study/youtube/transcript.py` - transcript fetching
- CLI entry point (likely `src/yt_study/cli.py` or similar)

## Implementation
1. Add `--cookies` argument to CLI (Typer)
2. Pass cookies to `youtube-transcript-api`
3. Ensure cookies are NOT logged

## Cookie Format
Netscape format cookies.txt file

## Testing
- pytest
- Check cookie handling doesn't log sensitive data
