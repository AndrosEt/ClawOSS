---
name: oss-submit
description: "Submit a contribution PR (bug fix, docs fix, typo fix, or test addition) to an open-source repo: verify it's a valid contribution, push branch to fork, create PR with gh CLI, use repo's PR template, add AI disclosure, log submission, report to dashboard."
user-invocable: true
---

# OSS Contribution PR Submission

Submit a verified contribution branch as a pull request. **Valid types: bug fixes, docs fixes, typo fixes, test additions. Never features, large refactors, or enhancements.**

## Prerequisites
- Branch passes all 8 quality gates (oss-review skill), including Gate 0 (Contribution Type Gate)
- safety-checker skill has approved submission
- Commit type matches contribution: `fix` for bugs, `docs` for docs/typos, `test` for tests

## Pre-Submit Sanity Check
Before pushing anything, ask one final time:
- Is this a valid contribution (bug fix, docs fix, typo, or test addition)? If NO → ABANDON.
- Does the PR FULLY resolve the reported issue? If NO (partial fix) → ABANDON.
- For bugs: does the fix address the root cause? If NO → go back and fix properly.
- For docs/typos: is the corrected text factually accurate? If NO → verify against code.
- Does the PR reference a specific issue? If NO → ABANDON.
- Is the branch named `clawoss/{fix,docs,test,typo}/...`? If NO → fix it.

## Fork vs Direct Push
1. Check if we have write access to the repo
   - Yes: push branch directly, create PR
   - No: check if we have a fork already
     - Yes: push to fork, create cross-repo PR
     - No: fork the repo first, then push and create PR

## Process
1. Push branch to fork (or origin if write access)
2. Create PR using `gh pr create`:
   - Title: `{type}(scope): description` following Conventional Commits — type must match contribution
   - Body: use repo's PR template if available; must include:
     - **Bug fixes**: bug description, ROOT CAUSE ANALYSIS, reproduction steps, before/after test evidence
     - **Docs/typo fixes**: what was incorrect, what's now correct, how verified against code
     - **Test additions**: what's now tested, why it matters, test output
   - References: "Fixes #<issue-number>" in body
3. Add AI disclosure notice to PR body (identify as @BillionClaw / ClawOSS)
4. Log submission to memory: repo, issue, PR number, timestamp, contribution type
5. Report to dashboard via dashboard-reporter skill

## Post-Submission
- Monitor CI status on next heartbeat
- Respond to review comments within 4 hours (~8 heartbeats)
- Do NOT ping or bump PRs — wait patiently for maintainer response
- If maintainer says "this is not appropriate" or "out of scope" → close PR, learn from it, log in memory
