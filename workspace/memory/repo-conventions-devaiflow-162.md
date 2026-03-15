# Repository: itdove/devaiflow

## Tech Stack
- Python 3
- CLI using Click or similar
- File-based storage backend
- fcntl for file locking (Unix)

## Project Structure
- `devflow/cli/commands/` - CLI command implementations
- `devflow/storage/file_backend.py` - File storage operations
- `docs/` - Documentation
- `tests/` - Test suite

## Code Style
- Python type hints
- fcntl.flock for file locking
- Follow existing command patterns

## Notes
- Uses @require_outside_claude decorator for session-restricted commands
- File locking already implemented for sessions.json
- Simple file append operations for notes