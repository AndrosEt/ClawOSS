# Repo: sonpiaz/4x-game-agent

## Basic Info
- Default branch: main
- Language: Python
- Test framework: pytest
- Package manager: pip

## Development Setup
```bash
pip install -e ".[all,dev]"
pytest agent/tests/
ruff check .
```

## Code Style
- Python 3.9+ compatible
- Use type hints for function signatures
- Keep game-specific code in `games/your_game/`, NOT in `agent/`
- No game logic in `agent/` — game-agnostic

## Commit Messages
Use Conventional Commits:
- `feat:` — new feature or game
- `fix:` — bug fix
- `docs:` — documentation only
- `test:` — tests only

## PR Checklist
- [ ] pytest passes
- [ ] ruff check passes

## Branch Naming
- `feat/your-feature`
- `fix/your-bug-fix`
- `test/your-test`

## Test Patterns (from test_reflection.py)
- Use pytest fixtures for temp files
- Use tempfile module for temp directories
- Clean up in fixture teardown
- Test both success and failure cases
- Use assertions with clear messages
