# Issue Details: sonpiaz/4x-game-agent#7

## Title
Write unit tests for OCR engine

## Labels
- good-first-issue

## State
OPEN

## Assignees
None

## Description
Add unit tests for `agent/ocr.py`.

### What to Test
- `OCREngine._run()` with a sample image
- `OCREngine.read_all()` caching behavior (same file returns cached results)
- `OCREngine.read_region()` coordinate adjustment
- Edge cases: non-existent file, empty image

### How to Start
1. Look at `agent/tests/test_reflection.py` for examples
2. Create `agent/tests/test_ocr.py`
3. Use small test images (can create programmatically with Pillow)

## Acceptance Criteria
- Test file created at `agent/tests/test_ocr.py`
- Tests cover: _run, read_all caching, read_region coordinates, edge cases
- Tests pass with `pytest agent/tests/test_ocr.py`
