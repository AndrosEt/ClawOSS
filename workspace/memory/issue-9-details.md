# Issue #9: Add template matching tests

**Repo:** sonpiaz/4x-game-agent
**Issue:** https://github.com/sonpiaz/4x-game-agent/issues/9
**State:** OPEN
**Labels:** good-first-issue

## Description
Add unit tests for `agent/template_match.py`.

## What to Test
- `TemplateMatcher._load_templates()` with a temp directory
- `TemplateMatcher.find()` with a known image + template
- `TemplateMatcher.capture_template()` saves correctly
- `TemplateMatcher.find_all()` deduplication logic
- Edge cases: empty directory, missing template

## How to Start
1. Look at `agent/tests/test_reflection.py` for test patterns
2. Create `agent/tests/test_template_match.py`
3. Use small programmatic images (numpy arrays → cv2)

No game knowledge needed — pure computer vision testing!

## Requirements
- MUST create failing test first (reproduce-first workflow)
- MUST verify tests pass after implementation
- Max 200 lines changed
- Use branch: clawoss/test/template-matching
