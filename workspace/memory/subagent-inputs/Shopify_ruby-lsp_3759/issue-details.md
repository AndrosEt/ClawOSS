# Issue #3759: CodeLens Run Test In Terminal doesn't work (on Windows)

## Description
CodeLens "Run Test In Terminal" doesn't work on Windows due to incorrectly escaped Regex.

## Problem
The regex used for test command generation is not properly escaped for Windows command line.

## Acceptance Criteria
- Fix regex escaping for Windows platform
- Ensure CodeLens test runner works on Windows
- Tests pass on both Windows and Unix

## Note
May need platform-specific handling in the test command generation code.
