# Issue #3760: Minitests test runs never report finished (on Windows)

## What
Minitest test runs never report as finished on Windows.

## Context
Related to #3759 (Windows regex escaping). Test execution status not properly reported.

## Acceptance Criteria
- Minitest runs properly report finished status on Windows
- Fix platform-specific issue
