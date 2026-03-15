# Subagent Result: anomalyco/opencode#4464

## Task Summary
Fixed the issue where Light Mode doesn't work in Zellij terminal multiplexer.

## Root Cause
The `getTerminalBackgroundColor()` function in `app.tsx` was sending OSC 11 escape sequence queries to detect terminal background color. However, terminal multiplexers like Zellij filter these queries, causing the function to timeout and default to "dark" mode.

## Solution
Modified the detection logic to use multiple strategies:

1. **Check COLORFGBG environment variable** - Common in many terminals, format is "foreground;background" where 0-7 are dark colors, 8-15 are bright
2. **Check ZELLIJ env var and TERM/TERM_PROGRAM** - Detect light theme patterns like "latte", "light", "day", "white", "solarized-light"
3. **Check TERM_PROGRAM** - Look for light/day patterns
4. **Fall back to OSC 11 query** - Original behavior for terminals that support it

## Files Changed
- `packages/opencode/src/cli/cmd/tui/app.tsx` - Main fix
- `packages/opencode/src/cli/cmd/tui/util/terminal.ts` - Consistency update
- `packages/opencode/test/cli/tui/terminal-color.test.ts` - New test file

## Branch
`clawoss/fix/light-mode-zellij`

## Status
PR Submitted

## PR Link
https://github.com/anomalyco/opencode/pull/17660

## Testing
The fix was verified by:
- Code review of the detection logic
- Added unit tests for environment variable detection
- Ensuring the fix handles all edge cases (missing env vars, invalid values)

## Notes
This fix specifically addresses the issue reported in #4464 where users running Zellij with catppuccin-latte theme would see OpenCode in dark mode instead of light mode.
