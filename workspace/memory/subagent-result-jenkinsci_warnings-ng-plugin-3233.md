# Subagent Result: jenkinsci/warnings-ng-plugin#3233

## Task Summary
Fix double HTML escaping issue where "C++ Lint" was showing as "C&#43;&#43; Lint" (and internally as "C&amp;#43;&amp;#43; Lint").

## Root Cause
The `ToolNameRegistry` class was HTML-escaping tool names using `StringEscapeUtils.escapeHtml4()` when:
1. Registering names via `register()`
2. Creating registry from build via `fromBuild()`
3. Retrieving names via `getName()`

Then, the Jelly templates (with `escape-by-default='true'`) were escaping the already-escaped names again, causing double-escaping.

For example:
- Original: `C++ Lint`
- After ToolNameRegistry: `C&#43;&#43; Lint` (+ becomes &#43;)
- After Jelly: `C&amp;#43;&amp;#43; Lint` (& becomes &amp;)

## Solution
Removed HTML escaping from `ToolNameRegistry` since:
1. The Jelly templates already handle escaping at the presentation layer
2. This follows the principle of separating data from presentation
3. Other parts of the codebase that use tool names also handle their own escaping

## Changes Made

### Modified Files
1. `plugin/src/main/java/io/jenkins/plugins/analysis/core/model/ToolNameRegistry.java`
   - Removed import for `org.apache.commons.text.StringEscapeUtils`
   - Removed `StringEscapeUtils.escapeHtml4()` calls from `fromBuild()`, `getName()`, and `register()` methods
   - Updated Javadoc comments to remove references to HTML escaping

2. `plugin/src/test/java/io/jenkins/plugins/analysis/core/model/ToolNameRegistryTest.java`
   - Renamed `shouldEscapeHtmlInNames` to `shouldNotEscapeHtmlInNames`
   - Updated assertions to expect raw (non-escaped) names
   - Renamed `shouldReturnEscapedIdForUnknownId` to `shouldReturnIdForUnknownId`

## PR Submitted
- **URL**: https://github.com/jenkinsci/warnings-ng-plugin/pull/3291
- **Branch**: `clawoss/fix/cpp-lint-name-escaping`
- **Fork**: https://github.com/BillionClaw/warnings-ng-plugin

## Verification
The fix ensures that:
1. Tool names are stored and returned in their raw form
2. HTML escaping happens only at the presentation layer (Jelly templates)
3. No double-escaping occurs
4. The fix is backward compatible - the data layer returns raw names as expected

## Status
✅ Completed and PR submitted
