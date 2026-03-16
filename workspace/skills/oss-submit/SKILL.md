---
name: oss-submit
description: "Submit a BUG FIX PR to an open-source repo: verify it's a bug fix, push branch to fork, create PR with gh CLI, use repo's PR template, add AI disclosure, log submission, report to dashboard."
user-invocable: true
---

# OSS Bug Fix PR Submission

Submit a verified bug-fix branch as a pull request. **Only bug fixes are submitted — never features, refactors, or enhancements.**

## Prerequisites
- Branch passes all 8 quality gates (oss-review skill), including Gate 0 (Bug Fix Gate)
- safety-checker skill has approved submission (including Bug Fix Verification)
- Commit type is `fix` (not `feat`, `refactor`, etc.)

## Pre-Submit Sanity Check
Before pushing anything, ask one final time:
- Is this fixing a reported bug? If NO → ABANDON.
- Does the PR reference a specific bug issue? If NO → ABANDON.
- Is the branch named `clawoss/fix/...`? If NO → ABANDON.

## Fork vs Direct Push
1. Check if we have write access to the repo
   - Yes: push branch directly, create PR
   - No: check if we have a fork already
     - Yes: push to fork, create cross-repo PR
     - No: fork the repo first, then push and create PR

## Process
1. Push branch to fork (or origin if write access)
2. Create PR using `gh pr create`:
   - Title: `fix(scope): description` following repo conventions or Conventional Commits — type MUST be `fix`
   - Body: use repo's PR template if available; must include: bug description, reproduction steps, before/after test evidence, root cause explanation
   - References: "Fixes #<issue-number>" in body (MUST reference the bug report)
3. Add AI disclosure notice to PR body (identify as @BillionClaw / ClawOSS)
4. Log submission to memory: repo, issue, PR number, timestamp, type: "bug-fix"
5. Report to dashboard via dashboard-reporter skill

## Post-Submission
- Monitor CI status on next heartbeat
- Respond to review comments within 4 hours (~8 heartbeats)
- Do NOT ping or bump PRs — wait patiently for maintainer response
- If maintainer says "this is a feature, not a bug fix" → close PR, learn from it, log in memory
