---
name: oss-followup
description: "Orchestrator-level PR follow-up detection and delegation: scan open PRs for new review comments, classify feedback type, write context files to subagent-inputs, delegate to oss-pr-review-handler sub-agents. Does NOT implement changes directly."
user-invocable: true
---

# OSS PR Follow-up — Detection & Delegation (Orchestrator Skill)

This skill runs in the ORCHESTRATOR session (HEARTBEAT step 2). It detects PRs
needing attention and delegates follow-up work to dedicated sub-agents — one per PR.
It does NOT implement changes directly.

## Overview

The orchestrator calls this skill to:
1. Scan all open PRs authored by us
2. Fetch review comments for each PR
3. Classify each PR's status
4. Write context files for sub-agents
5. Spawn follow-up sub-agents (via oss-pr-review-handler skill)
6. Update pr-followup-state.md

## Step 1: Scan Open PRs

```bash
gh pr list --author @me --state open --json number,title,url,updatedAt,reviewDecision,statusCheckRollup,comments,headRefName
```

If no open PRs: skip to next HEARTBEAT step. Nothing to follow up on.

## Step 2: Fetch Review Details Per PR

For each open PR, fetch both inline and general comments:

```bash
# Inline code review comments
gh api repos/{owner}/{repo}/pulls/{number}/comments \
  --jq '.[] | {id, body, path, line, created_at, user: .user.login, in_reply_to_id}'

# General PR-level comments
gh api repos/{owner}/{repo}/issues/{number}/comments \
  --jq '.[] | {id, body, created_at, user: .user.login}'
```

Filter to comments that are NEW since our last check:
- Read memory/pr-followup-state.md for the `last_checked` timestamp per PR
- Only consider comments with `created_at` > `last_checked`
- If no `last_checked` exists (first check), consider all non-self comments

Exclude our own comments (filter out comments where user matches our GitHub username).

## Step 3: Classify Each PR

Based on review state and new comments, classify each PR:

### `changes_requested`
Criteria (any of):
- `reviewDecision` == "CHANGES_REQUESTED"
- New inline comments requesting specific code changes
- New general comments asking for modifications
- Reviewer explicitly asks for changes

Action: Spawn follow-up sub-agent (if round < 3)

### `comment_only`
Criteria:
- New comments that are questions, clarifications, or discussions
- No explicit change requests
- Reviewer is engaging but not blocking

Action: Spawn follow-up sub-agent to respond thoughtfully

### `ci_failing`
Criteria:
- `statusCheckRollup` contains failures
- Failures are in OUR code (not pre-existing repo CI issues)

Action: Spawn follow-up sub-agent to fix CI (counts as a round)

### `approved`
Criteria:
- `reviewDecision` == "APPROVED"
- No new blocking comments

Action: Update pr-followup-state.md status to `approved`. No sub-agent needed.

### `stale`
Criteria:
- `updatedAt` is >7 days ago
- No new review activity

Action: Close PR with polite comment. Update state to `closed_stale`.
```bash
gh pr close {number} --repo {owner}/{repo} --comment "Closing this PR as it hasn't received review activity in over a week. If the fix is still wanted, I'm happy to resubmit. Thank you for your time."
```

### `close_withdraw`
Criteria:
- Repo is in `memory/repo-blacklist.md` (anti-AI policy, permanently blacklisted, etc.)

Action: Close PR with polite withdrawal message. Update state to `close_withdraw`. No sub-agent needed.
```bash
gh pr close {number} --repo {owner}/{repo} --comment "We apologize for the unsolicited contribution. We've learned this project prefers not to receive AI-assisted PRs, and we fully respect that. Closing this PR. Thank you for your time."
```

### `merged`
Criteria:
- PR state is merged (won't appear in `--state open`, but check explicitly if needed)

Action: Update state to `merged`. Log success.

### `no_new_activity`
Criteria:
- No new comments since last check
- Review decision unchanged

Action: Skip. Update `last_checked` timestamp only.

## Step 4: Check Round Limits

For PRs classified as `changes_requested`, `comment_only`, or `ci_failing`:

Read the current round count from memory/pr-followup-state.md:
- Round 0-1: Normal follow-up. Proceed to spawn.
- Round 2: This will be round 3 (final). Mark in context file so sub-agent knows to post disengagement message if needed.
- Round >= 3: Do NOT spawn. PR is in disengaged state. Log "skipped: max rounds reached".

## Step 5: Write Context File

For each PR that needs a sub-agent, write:
`memory/subagent-inputs/followup-{repo}-{pr}.md`

See HEARTBEAT.md step 2c for the exact format. The context file must include:
- PR URL, number, branch name
- Repository owner and name
- Original issue number (from PR body "Fixes #N")
- Classification
- Current revision round (will be incremented by 1 for this follow-up)
- ALL new review comments (inline + general) with comment IDs for reply threading
- Diff summary (first 200 lines of `gh pr diff`)

## Step 6: Spawn Sub-Agents

For each PR needing follow-up, request orchestrator to spawn via sessions_spawn.
See HEARTBEAT.md step 2d for exact spawn instructions.

**Priority**: Follow-up sub-agents are spawned BEFORE implementation sub-agents.
If spawning a follow-up would exceed the 5-slot limit, defer implementation work.

## Step 7: Update State

After processing all PRs, update memory/pr-followup-state.md:
- New PRs: add row with round 0, status pending_review
- Follow-up spawned: increment round, update last_checked, update status
- Stale closed: set status closed_stale
- Approved: set status approved
- No activity: update last_checked only

## Output

Return to orchestrator:
- Count of PRs needing follow-up sub-agents
- Count of PRs closed (stale)
- Count of PRs approved
- Count of PRs skipped (max rounds / no activity)
- List of sub-agents to spawn (PR number, repo, classification, round)

The orchestrator handles the actual spawning in HEARTBEAT step 2d.

## Important

- This skill runs in the ORCHESTRATOR context — keep it lightweight
- Do NOT implement code changes here — that's the sub-agent's job
- Do NOT read full file diffs in the orchestrator — just the summary
- Minimize GitHub API calls — batch where possible
- If a PR has >20 new comments, summarize rather than including all verbatim
- Always update pr-followup-state.md even if no action is taken (timestamps matter)
