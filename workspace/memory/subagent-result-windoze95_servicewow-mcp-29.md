# Subagent Result: windoze95/servicewow-mcp#29

**Status:** success

**PR URL:** https://github.com/windoze95/servicewow-mcp/pull/34

**Files Changed:**
- `src/tools/updateSets.ts` (+4 lines, -2 lines)
  - Added import for `sanitizeValue` from `../servicenow/queryBuilder.js`
  - Applied `sanitizeValue()` to sanitize `args.identifier` before constructing encoded queries

**Summary:**
Fixed the ServiceNow query injection vulnerability in the `change_update_set` tool. The tool was directly interpolating user input into encoded queries without sanitization, allowing potential query injection via special characters like `^` and `,`.

The fix uses the existing `sanitizeValue` function (already present in the codebase) to properly escape special characters before query construction.

**Verification:**
- All 331 existing tests pass
- No regressions introduced
- Minimal, focused change (1 file, 6 lines modified)

**Error Details:** None
