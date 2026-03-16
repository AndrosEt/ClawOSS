---
name: oss-pr-review-handler
description: "Sub-agent skill for handling PR review feedback: clone repo, checkout PR branch, read all review comments (inline + general), implement requested changes, push updates, respond to reviewers via gh CLI, cleanup workspace. Spawned 1-per-PR by the orchestrator."
user-invocable: false
---

# OSS PR Review Handler (Sub-Agent Skill)

Handle review feedback on a submitted pull request (bug fix, docs fix, typo fix, or test addition).
This skill runs inside a dedicated sub-agent spawned by the orchestrator — one sub-agent per PR, never mixed.

## Context (provided via attachments)

The orchestrator writes a context file to `memory/subagent-inputs/followup-{repo}-{pr}.md`
and passes it as an attachment. It contains:
- PR URL and number
- Repository owner and name
- Original issue link and number
- PR classification: `changes_requested` or `comment_only`
- All review comments (inline file comments + general PR comments)
- File diff summary
- Current revision round (1, 2, or 3)
- PR branch name

## Workflow

### 0. Setup Isolated Workspace
```
WORKDIR=/tmp/clawoss-followup-{pr}-$(date +%s)
mkdir -p $WORKDIR && cd $WORKDIR
```
All work happens in this directory. Never use a shared directory.

### 1. Clone and Checkout PR Branch
```bash
# Clone OUR FORK (not upstream) so we have push access
gh repo clone BillionClaw/{repo} $WORKDIR -- --depth=50
cd $WORKDIR
# Add upstream remote for reference
git remote add upstream https://github.com/{owner}/{repo}.git
git checkout {pr-branch}
git pull origin {pr-branch}
```
Clone our FORK, not the upstream repo — we need push access to update the PR.
Checkout the PR branch — NOT main. We are updating an existing PR, not starting fresh.

### 2. Read ALL Review Comments
Parse the context file for all comments. Categorize each one:

**Comment Types:**
- **Change request**: Reviewer wants specific code modifications (implement these)
- **Question**: Reviewer wants clarification (respond with explanation)
- **Nitpick/style**: Minor style suggestion (implement if reasonable)
- **Approval/praise**: No action needed
- **Scope concern**: Reviewer says the contribution is out of scope or not appropriate (special handling — see section below)
- **Rejection**: Reviewer rejects the approach entirely (special handling)
- **CLA question**: If reviewer asks about CLA and the repo does NOT require one, respond: "This repo doesn't appear to require a CLA — happy to complete one if needed." NEVER claim to have signed a CLA you didn't sign. If repo DOES require a CLA we can't sign, close PR politely.

### 3. Deep Comprehension of Feedback
For each change request or question:
- **Understand what the reviewer is asking for** — read the full comment in context
- **Read the referenced code** — understand the file and surrounding context
- **Understand WHY they want the change** — is it correctness, style, performance, safety?
- **Plan the response** — code change, explanation, or both

Do NOT rush to implement. Misunderstanding a reviewer wastes everyone's time.

### 4. Implement Requested Changes
For each change request:
1. Make the specific code modification the reviewer asked for
2. Ensure it stays within the original contribution scope — do NOT expand to features even if reviewer suggests it
3. Run the test suite to verify no regressions
4. If the reviewer's suggestion would break tests or introduce bugs, explain why in the response

**Stay within scope:**
- If a reviewer asks to expand scope (add features, large refactor): politely decline
- Explain: "This PR is scoped to [specific fix/docs correction/test addition]. I'd be happy to open a separate issue for that."
- Never argue — just politely set the boundary

**Quality standards:**
- Every change must maintain or improve test coverage
- Code style must continue to match the repo's conventions
- No new scope creep in the process of addressing feedback

### 5. Commit and Push
```bash
git add -u
git commit -m "{type}: address review feedback

- [summary of changes made in response to feedback]
- Addresses reviewer comments on [files/areas]"
git push origin {pr-branch}
```

Commit message type MUST remain the same as the original PR (`fix`/`docs`/`test`) — we are still addressing the same issue.
Push to the SAME branch — this updates the existing PR automatically.

### 6. Respond to Reviewers

**For general PR comments (issue-level):**
```bash
gh pr comment {number} --repo {owner}/{repo} --body "Updated. [explanation of what changed and why]

Changes in this revision:
- [change 1]: [reason/reviewer who requested]
- [change 2]: [reason/reviewer who requested]

Ready for re-review."
```

**For inline file comments (reply in thread):**
```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments \
  -X POST \
  -f body="Done. [brief explanation]" \
  -F in_reply_to={comment_id}
```
Reply to each inline comment individually so reviewers see responses in context.

**Response tone:**
- Professional and concise — no fluff
- Thank the reviewer for the feedback (once, at the top — not for every comment)
- Explain what you changed and why
- If you disagreed but implemented anyway, note it gracefully
- Never argue, never be defensive
- If you could not implement a suggestion, explain why clearly

### 7. Handle Special Cases

**Scope Concern ("this is not appropriate" / "out of scope"):**
- Do NOT argue. The maintainer knows their codebase better than we do.
- Close the PR with a polite comment:
  ```
  Thank you for the review. I understand this change doesn't align with what
  the project needs. I'll close this PR. Apologies for the noise.
  ```
- Set `followup_outcome: closed_scope_concern` in result file YAML frontmatter
- This is a learning opportunity — log the feedback for future triage improvement

**Rejection (approach is fundamentally wrong):**
- Close the PR politely
- Set `followup_outcome: closed_rejected` in result file YAML frontmatter
- Log the reason — it helps us avoid similar mistakes

**Round 3 (max revision limit reached):**
- Post a polite disengagement message:
  ```
  Thank you for the thorough review and feedback. I've made my best effort to
  address the concerns raised. If the changes still don't meet the project's
  standards, I understand — please feel free to close this PR. I appreciate
  the time you've taken to review.
  ```
- Set `followup_outcome: disengaged_max_rounds` in result file YAML frontmatter
- Do NOT close the PR yourself on round 3 — leave it for the maintainer to decide

### 8. Write Result File
Write results to `memory/subagent-result-followup-{repo}-{pr}.md` using the YAML frontmatter
format defined in `templates/subagent-result-schema.md`. Example:

```markdown
---
type: followup
status: success
repo: {owner}/{repo}
pr_number: {pr}
pr_url: https://github.com/{owner}/{repo}/pull/{pr}
branch: {branch}
followup_round: {round}
followup_outcome: changes_pushed
files_changed: 2
additions: 15
deletions: 5
---

# Follow-up Result: {owner}/{repo}#{pr}

## Summary
Addressed reviewer feedback in round {round}. [describe what was done]

## Reviewer Interaction
- [What reviewers asked for and how we responded]

## Changes Made
- [list of files and changes]
```

For terminal outcomes, use the appropriate `followup_outcome`:
- `closed_scope_concern` — reviewer said the contribution is out of scope
- `closed_rejected` — reviewer rejected the approach
- `disengaged_max_rounds` — round 3 polite disengagement

### 9. Cleanup
```bash
rm -rf $WORKDIR
```
This is NON-OPTIONAL. Cloned repos waste 500MB-2GB each.

## Constraints
- Target 25-100 LOC per revision round (max 200)
- Commit type MUST remain the same as the original PR (`fix`/`docs`/`test`)
- Never force-push — always regular push to update the PR
- Never rebase the PR branch — just add new commits
- Never close a PR without posting a comment explaining why
- Never argue with reviewers — implement or politely disengage
- 1 PR = 1 sub-agent — never handle multiple PRs in one agent
- All GitHub communication via `gh` CLI
- After completion, reply ANNOUNCE_SKIP to the orchestrator

## Anti-Patterns (never do these)
- Do NOT rewrite the entire PR in response to a minor comment
- Do NOT add new features even if a reviewer suggests them
- Do NOT squash commits — let the maintainer decide on merge strategy
- Do NOT ping reviewers or request re-review — just push and comment
- Do NOT respond to comments you've already addressed in a previous round
- Do NOT leave the workspace directory behind after completion
