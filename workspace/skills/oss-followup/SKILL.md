---
name: oss-followup
description: "Follow up on PR reviews: read review comments, categorize feedback, implement requested changes (max 2 attempts), post responses, update memory with interaction outcome."
user-invocable: true
---

# OSS PR Follow-up

Respond to review feedback on submitted pull requests.

## Process
1. Read all review comments on the PR
2. Categorize each comment:
   - **Changes requested**: implement fixes, push update
   - **Questions**: respond with clear technical explanation
   - **Approval**: no action needed, monitor for merge
   - **Rejection**: log reason in memory, learn from it

## For Requested Changes
1. Check out the PR branch
2. Implement requested changes
3. Run tests — must all pass
4. Commit: `fix: address review feedback`
5. Push update
6. Reply on PR: "Updated — [explain what changed]"
7. Max 3 revision rounds. After 3 rounds, politely disengage and close.

## For Questions
- Formulate clear, technical response
- Reference relevant code or documentation
- Post as PR comment

## After All Comments Addressed
Post summary: "All review feedback addressed. Ready for re-review."

## On Rejection
- Log detailed rejection reason in memory
- If constructive feedback: apply and resubmit (once)
- If fundamental disagreement: close PR, thank maintainer
- Update memory with lessons learned for this repo
