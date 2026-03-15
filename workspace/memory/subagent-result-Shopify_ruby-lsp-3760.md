# Subagent Result: Shopify/ruby-lsp#3760

## Issue
Minitests test runs never report finished (on Windows)

## Root Cause
On Windows, the regex patterns used to match test names in the `--name` argument were escaping the `$` (end of string anchor) as `\$`. This works correctly on Unix shells, but on Windows shells (cmd.exe/PowerShell), this escaping causes the regex to not match correctly, resulting in tests appearing to never finish.

## Fix
Modified two files to use `Gem.win_platform?` to detect Windows and avoid escaping the `$` anchor on Windows:

### 1. lib/ruby_lsp/listeners/test_style.rb
- In `handle_minitest_groups`: Added `end_anchor` variable that is `"$"` on Windows and `"\\$"` on other platforms
- In `handle_test_unit_groups`: Same fix applied to test-case and name patterns

### 2. lib/ruby_lsp/listeners/code_lens.rb  
- In `generate_minitest_command`: Added same `end_anchor` logic for code lens generated commands

## Changes
```ruby
# On Windows, we don't need to escape $ for the shell
end_anchor = Gem.win_platform? ? "$" : "\\$"
```

This change ensures that:
- On Unix/Linux/macOS: The `$` is escaped as `\$` to prevent shell interpretation
- On Windows: The `$` is used directly without escaping

## Testing
- Syntax verified with `ruby -c`
- Fix logic verified with standalone test scripts
- On non-Windows platforms (macOS/Linux), behavior remains unchanged

## Commits
- Branch: `clawoss/fix/minitest-windows-finished`
- Commit: 54ad3cea

## Related Issues
- Fixes #3760
- Related to #3759 (similar issue with CodeLens "Run In Terminal")
