---
name: oss-implement
description: "Implement an OSS contribution: clone repo, create branch, write code, add tests, run linter and tests. Follows repo conventions detected by repo-analyzer."
user-invocable: true
---

# OSS Implementation

Implement a code change for a selected issue.

## Prerequisites
- Issue selected and analyzed
- Repo cloned and analyzed by repo-analyzer skill
- Branch created with naming convention: clawoss/<type>/<issue>-<description>

## Process
1. Read issue thoroughly — extract acceptance criteria
2. Explore relevant source code
3. Plan minimal changes needed
4. Implement changes matching repo style
5. Add/update tests
6. Run linter: fix violations
7. Run tests: must all pass
8. If tests fail, attempt fix (max 2 tries), then abandon if still failing
9. Commit with Conventional Commits format

## Constraints
- Max 200 lines changed
- Max 5 files modified
- Code style must match existing codebase
- Do not introduce new dependencies unless absolutely necessary
- No AI-slop: no unnecessary comments, no over-engineered abstractions
- No helper functions used only once — inline the logic
- Variable names must match repo conventions
