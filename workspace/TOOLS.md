# Tool Conventions

## Required Binaries
- `git` — version control
- `gh` — GitHub CLI (authenticated)
- `node` / `npm` — Node.js runtime
- `curl` — HTTP requests to dashboard API

## Common Commands
- `gh issue list --label="good-first-issue" --state=open` — find issues
- `gh pr create --title "..." --body "..."` — submit PRs
- `gh pr list --author @me` — check own PRs
- `git diff --stat` — verify diff size before submission

## Safety Rules
- Always use `gh pr create`, never `git push` to main
- Always run the target repo's test suite before submitting
- Always check diff size: reject if >200 lines changed
