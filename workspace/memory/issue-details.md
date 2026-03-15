# Issue #7: Write unit tests for OCR engine

## Repository
sonpiaz/4x-game-agent

## Issue Details
**Title:** Write unit tests for OCR engine
**State:** OPEN
**Labels:** good-first-issue

## Description
Add unit tests for `agent/ocr.py`.

### What to Test
1. `OCREngine._run()` with a sample image
2. `OCREngine.read_all()` caching behavior (same file returns cached results)
3. `OCREngine.read_region()` coordinate adjustment
4. Edge cases: non-existent file, empty image

### How to Start
1. Look at `agent/tests/test_reflection.py` for examples
2. Create `agent/tests/test_ocr.py`
3. Use small test images (can create programmatically with Pillow)

## OCR Engine Interface (from agent/ocr.py)

```python
class OCREngine:
    def __init__(self, lang: str = "en"):
        from paddleocr import PaddleOCR
        self._ocr = PaddleOCR(lang=lang)
        self._cached_path = None
        self._cached_texts = None

    def read_all(self, image_path: str) -> list:
        """Full-screen OCR. Returns cached results if same file (by mtime)."""
        # Caches by "{path}:{mtime}"
        # Returns list of dicts: [{text, confidence, x, y}, ...]

    def read_region(self, image_path: str, crop_box: tuple) -> list:
        """OCR a specific region. crop_box = (x1, y1, x2, y2) in pixels.
        Returns text dicts with coordinates adjusted to full-image space.
        """
        # Crops image, runs OCR, adjusts x,y by x1,y1

    def _run(self, image_path: str) -> list:
        """Run PaddleOCR on an image file."""
        # Uses self._ocr.predict(image_path)
        # Filters by confidence >= 0.5 and non-empty text
        # Returns [{text, confidence, x, y}, ...]
```

## Test Requirements
- Create `agent/tests/test_ocr.py`
- Test caching behavior (same path + mtime returns cached)
- Test coordinate adjustment in read_region
- Test edge cases gracefully handled
- Follow pytest patterns from test_reflection.py

## Implementation Notes
- Can create test images programmatically with PIL
- Consider mocking PaddleOCR for faster tests
- Test file paths should use temp files
- Clean up temp files in fixtures
