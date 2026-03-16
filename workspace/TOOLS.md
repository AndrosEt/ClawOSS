# Tool Conventions

## Required Binaries
- `git` — version control
- `gh` — GitHub CLI (authenticated)
- `node` / `npm` — Node.js runtime
- `curl` — HTTP requests to dashboard API

## Common Commands
- `gh search issues --label="bug" --state=open --sort=updated` — find bug reports
- `gh search issues --label="defect" --state=open --sort=updated` — find defect reports
- `gh search issues --label="regression" --state=open --sort=updated` — find regressions
- `gh search issues --label="documentation" --state=open --sort=updated` — find docs issues
- `gh search issues --label="typo" --state=open --sort=updated` — find typo reports
- `gh search issues --label="good-first-issue" --state=open --sort=updated` — find easy wins
- `gh search issues --label="help-wanted" --state=open --sort=updated` — find maintainer-requested help
- `gh pr create --title "{type}(...): ..." --body "..."` — submit contribution PRs (type = fix, docs, or test)
- `gh pr list --author @me` — check own PRs
- `git diff --stat` — verify diff size before submission

## Safety Rules
- Always use `gh pr create`, never `git push` to main
- Always run the target repo's test suite before submitting
- Always check diff size: reject if >200 lines changed
