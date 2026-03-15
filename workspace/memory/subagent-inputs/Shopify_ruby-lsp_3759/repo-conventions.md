# Repo Analysis: Shopify/ruby-lsp

## Tech Stack
- **Language**: Ruby
- **Test**: Minitest

## Target Issue
CodeLens "Run Test In Terminal" doesn't work on Windows due to incorrectly escaped Regex.

## Files to Investigate
- Look for CodeLens test command generation
- Files likely in `lib/ruby_lsp/` related to code_lens or test commands

## Fix Pattern
Need platform-specific regex escaping for Windows vs Unix.

## Testing
- Run tests: `bundle exec rake test`
- Check Windows-specific test scenarios
