---
name: repo-analyzer
description: "Analyze a repository: detect tech stack, code style, test framework, CI system, contribution guidelines, and bug-fix suitability (test infrastructure, issue templates, maintainer responsiveness). Cache results in memory for reuse."
user-invocable: true
---

# Repository Analyzer

Understand a repository's conventions before contributing a bug fix.

## Process
1. Clone repo to /tmp/clawoss-workdir/<repo-name>/ (shallow clone)
2. Read contribution docs:
   - CONTRIBUTING.md
   - CODE_OF_CONDUCT.md
   - .github/PULL_REQUEST_TEMPLATE.md
   - .github/ISSUE_TEMPLATE/ (check for bug report templates)
3. Detect tech stack:
   - package.json, Cargo.toml, go.mod, pyproject.toml, etc.
4. Detect code style:
   - .editorconfig, .eslintrc, .prettierrc, rustfmt.toml, etc.
5. Detect test framework:
   - jest, pytest, go test, cargo test, etc.
6. Detect CI system:
   - .github/workflows/, .circleci/, Jenkinsfile, etc.
7. **Assess bug-fix suitability:**
   - Does the repo have a test suite we can run? (critical for reproduce-first workflow)
   - Does the repo have a bug report issue template? (indicates they welcome bug fixes)
   - How responsive are maintainers to bug-fix PRs? (check recent merged PRs)
   - Does the repo have anti-AI-PR policies? If yes, skip permanently.
8. Check memory for cached repo conventions (skip re-analysis if recent)
9. Store repo analysis in memory for reuse

## Output
Repo profile containing:
- Tech stack and language
- Code style configuration
- Test command to run
- Lint command to run
- CI expectations and required checks
- PR conventions and template
- Any special contribution requirements
- **Bug-fix suitability score** (1-5): how suitable is this repo for our bug-fix contributions?
  - 5: Great test infra, active maintainers, welcomes bug fix PRs
  - 3: Decent test infra, moderate activity
  - 1: No tests, inactive, hostile to external PRs
