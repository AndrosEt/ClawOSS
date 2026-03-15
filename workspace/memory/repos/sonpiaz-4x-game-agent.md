# Repo Conventions: sonpiaz/4x-game-agent

## Tech Stack
- Python 3.x
- PaddleOCR for OCR
- PIL/Pillow for image processing
- pytest for testing

## Test Conventions
- Test files: `agent/tests/test_*.py`
- Uses pytest with fixtures
- Pattern: create tempfile, test, cleanup
- Example from test_reflection.py:
  ```python
  @pytest.fixture
  def reflection():
      fd, path = tempfile.mkstemp(suffix=".json")
      os.close(fd)
      log = ReflectionLog(filepath=path, log_fn=lambda x: None)
      yield log
      os.unlink(path)
  ```

## Code Style
- Type hints in function signatures
- Docstrings for classes and public methods
- Logging via `logging.getLogger(__name__)`
- Clean, minimal imports

## Key Files
- `agent/ocr.py` - OCREngine class with:
  - `_run(image_path)` - raw OCR on image
  - `read_all(image_path)` - cached full-screen OCR
  - `read_region(image_path, crop_box)` - OCR on cropped region

## Branch Naming
- Use: `clawoss/test/ocr-unit-tests`
