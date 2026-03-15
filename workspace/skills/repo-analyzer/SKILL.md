---
name: repo-analyzer
description: "Analyze a repository: detect tech stack, code style, test framework, CI system, and contribution guidelines. Cache results in memory for reuse."
user-invocable: true
---

# Repository Analyzer

Understand a repository's conventions before contributing.

## Process
1. Clone repo to /tmp/clawoss-workdir/<repo-name>/ (shallow clone)
2. Read contribution docs:
   - CONTRIBUTING.md
   - CODE_OF_CONDUCT.md
   - .github/PULL_REQUEST_TEMPLATE.md
3. Detect tech stack:
   - package.json, Cargo.toml, go.mod, pyproject.toml, etc.
4. Detect code style:
   - .editorconfig, .eslintrc, .prettierrc, rustfmt.toml, etc.
5. Detect test framework:
   - jest, pytest, go test, cargo test, etc.
6. Detect CI system:
   - .github/workflows/, .circleci/, Jenkinsfile, etc.
7. Check memory for cached repo conventions (skip re-analysis if recent)
8. Store repo analysis in memory for reuse

## Output
Repo profile containing:
- Tech stack and language
- Code style configuration
- Test command to run
- Lint command to run
- CI expectations and required checks
- PR conventions and template
- Any special contribution requirements
