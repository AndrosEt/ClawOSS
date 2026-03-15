# Repository: sonpiaz/4x-game-agent

## Tech Stack
- Python 3.x
- PaddleOCR for OCR functionality
- Pillow (PIL) for image manipulation
- pytest for testing

## Project Structure
```
agent/
  ocr.py           # OCR engine to test
  tests/
    __init__.py
    test_llm.py    # Example tests
    test_reflection.py  # Best example to follow
```

## Code Style
- Use type hints
- Docstrings for classes and methods
- Logging via `logging` module
- Follow existing test patterns in test_reflection.py

## Test Patterns (from test_reflection.py)
- Use `@pytest.fixture` for setup
- Use `tempfile.mkstemp()` for temp files
- Clean up with `os.unlink()` in fixture teardown
- Test both success and failure cases
- Test edge cases explicitly

## Contributing Guidelines
- Fork and clone the repo
- Follow existing patterns
- Test-only contributions welcome
- No game knowledge needed for core utility tests

## Git Workflow
- Create feature branch
- Commit with clear messages
- Push to fork
- Open PR

## Notes
- Uses PaddleOCR which downloads models on first run
- Tests should mock or use small generated images
- Avoid requiring actual OCR models in unit tests if possible
