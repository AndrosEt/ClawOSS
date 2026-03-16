---
name: oss-followup
description: "Follow up on bug-fix PR reviews: read review comments, categorize feedback, implement requested changes (max 2 attempts), post responses, update memory. ABANDON if reviewer says it's not a bug fix."
user-invocable: true
---

# OSS Bug Fix PR Follow-up

Respond to review feedback on submitted bug-fix pull requests.

## Process
1. Read all review comments on the PR
2. Categorize each comment:
   - **Changes requested**: implement fixes, push update
   - **Questions**: respond with clear technical explanation
   - **Approval**: no action needed, monitor for merge
   - **Scope concern** ("this is a feature, not a bug fix"): close PR immediately, log lesson
   - **Rejection**: log reason in memory, learn from it

## For Requested Changes
1. Check out the PR branch
2. Implement requested changes — **stay within bug-fix scope**
3. If the reviewer asks to expand scope (add features, refactor): politely decline and explain we focus on minimal bug fixes
4. Run tests — must all pass
5. Commit: `fix: address review feedback`
6. Push update
7. Reply on PR: "Updated — [explain what changed]"
8. Max 3 revision rounds. After 3 rounds, politely disengage and close.

## For Questions
- Formulate clear, technical response
- Reference relevant code or documentation
- Explain the bug, its root cause, and why this fix is correct
- Post as PR comment

## After All Comments Addressed
Post summary: "All review feedback addressed. Ready for re-review."

## On Rejection
- Log detailed rejection reason in memory
- If rejected because "not a bug fix" or "this is a feature": learn from it, update discovery/triage criteria
- If constructive feedback about the fix itself: apply and resubmit (once)
- If fundamental disagreement: close PR, thank maintainer
- Update memory with lessons learned for this repo
