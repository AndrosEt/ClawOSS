---
name: oss-submit
description: "Submit a PR to an open-source repo: push branch to fork, create PR with gh CLI, use repo's PR template, add AI disclosure, log submission, report to dashboard."
user-invocable: true
---

# OSS PR Submission

Submit a verified branch as a pull request.

## Prerequisites
- Branch passes all 7 quality gates (oss-review skill)
- safety-checker skill has approved submission

## Fork vs Direct Push
1. Check if we have write access to the repo
   - Yes: push branch directly, create PR
   - No: check if we have a fork already
     - Yes: push to fork, create cross-repo PR
     - No: fork the repo first, then push and create PR

## Process
1. Push branch to fork (or origin if write access)
2. Create PR using `gh pr create`:
   - Title: follows repo conventions or Conventional Commits
   - Body: use repo's PR template if available, otherwise templates/pr-template.md
   - References: "Fixes #<issue-number>" in body
3. Add AI disclosure notice to PR body (identify as @BillionClaw / ClawOSS)
4. Log submission to memory: repo, issue, PR number, timestamp
5. Report to dashboard via dashboard-reporter skill

## Post-Submission
- Monitor CI status on next heartbeat
- Respond to review comments within 4 hours (~8 heartbeats)
- Do NOT ping or bump PRs — wait patiently for maintainer response
