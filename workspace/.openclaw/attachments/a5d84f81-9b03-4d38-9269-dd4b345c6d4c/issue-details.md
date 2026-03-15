# Issue #9: Add template matching tests

**Repository:** sonpiaz/4x-game-agent
**Issue:** #9
**Title:** Add template matching tests
**Labels:** good-first-issue
**State:** OPEN, unassigned

## What to Test

The file `agent/template_match.py` contains `TemplateMatcher` class with these methods:
- `_load_templates()` — Load all .png templates from template_dir
- `find()` — Find a template in a screenshot (multi-scale)
- `find_all()` — Find all occurrences with deduplication
- `capture_template()` — Save a region as a new template
- `has_template()` — Check if template exists
- `list_templates()` — List loaded template names

## Required Tests

1. `_load_templates()` with a temp directory
2. `find()` with a known image + template (use numpy arrays → cv2)
3. `capture_template()` saves correctly
4. `find_all()` deduplication logic (within 50px)
5. Edge cases: empty directory, missing template

## Implementation Guidance

- Create `agent/tests/test_template_match.py`
- Look at `agent/tests/test_reflection.py` for test patterns
- Use small programmatic images (numpy arrays, not real images)
- Use `tempfile.mkstemp()` and `tempfile.TemporaryDirectory()` for isolation
- No game knowledge needed — pure computer vision testing

## Source File to Test

See `agent/template_match.py` — uses cv2.imread, cv2.matchTemplate, cv2.resize, cv2.imwrite.
