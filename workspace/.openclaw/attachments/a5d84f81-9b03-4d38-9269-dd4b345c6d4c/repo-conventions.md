# Repository Conventions: sonpiaz/4x-game-agent

## Tech Stack
- Python 3.9+
- OpenCV (cv2), Pillow, NumPy
- pytest for testing
- ruff for linting (line-length: 100)

## Project Structure
- `agent/` — Core game-agnostic utilities
- `agent/tests/` — Test files
- `games/` — Game-specific implementations

## Test Framework
- pytest
- Tests live in `agent/tests/test_*.py`
- Use pytest fixtures for temp files/resources
- See `agent/tests/test_reflection.py` for patterns

## Code Style
- Line length: 100
- Target Python: 3.9+
- Use type hints for function signatures
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`

## CI/CD
- GitHub Actions: `.github/workflows/ci.yml`
- Required checks: lint (ruff), test-core (pytest)

## Branch Naming
- Feature branches: `feat/description`
- For tests: `test/add-template-matching-tests`

## Test Commands
```bash
# Run tests
pytest agent/tests/ -v

# Run linter
ruff check agent/
```

## Install Dev Dependencies
```bash
pip install -e ".[dev]"
```
