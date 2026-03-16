# Follow-up Sub-Agent Spawn Template

## Variables (substitute before spawning)
- `{owner}` — repo owner (e.g., `facebook`)
- `{repo}` — repo name (e.g., `react`)
- `{pr}` — PR number (e.g., `12345`)
- `{branch}` — PR branch name (e.g., `clawoss/fix/null-check`, `clawoss/docs/update-readme`)
- `{round}` — current revision round (1, 2, or 3)
- `{number}` — same as {pr} (for gh CLI commands)
- `{comment_id}` — inline comment ID (for threaded replies)

## Spawn Config
```
label: "followup-{repo}#{pr}"
attachments: [followup-{repo}-{pr}.md]
```

## Task Prompt

Handle PR review feedback for {owner}/{repo}#{pr} (round {round}).

IMPORTANT: This is a FOLLOW-UP on an existing PR (bug fix, docs fix, typo, or test), not new work.
Read the attached followup context file for all review comments and PR details.
Follow the oss-pr-review-handler skill workflow:

1. Create isolated workspace: WORKDIR=/tmp/clawoss-followup-{pr}-$(date +%s)
   mkdir -p $WORKDIR && cd $WORKDIR

2. Clone OUR FORK (not upstream) so we have push access:
   `gh repo clone BillionClaw/{repo} $WORKDIR -- --depth=50`
   Then checkout the PR branch (NOT main): `git checkout {branch}`
   Check for AGENTS.md in repo root — if present, follow its agent-specific instructions.

3. Read ALL review comments — understand what each reviewer is asking

4. For change requests: implement the requested modifications

5. For questions: prepare clear technical responses

6. Run tests to verify no regressions

7. Commit and push to the SAME branch (updates the PR automatically)

8. Respond to reviewers:
   - General comments: gh pr comment {number} --repo {owner}/{repo} --body '...'
   - Inline replies: gh api repos/{owner}/{repo}/pulls/{number}/comments -X POST -f body='...' -F in_reply_to={comment_id}

9. Stay within the original contribution scope — do NOT expand to features even if reviewer suggests

10. If reviewer says the contribution is out of scope: close PR politely, mark as closed_scope_concern

10b. If issue reporter or reviewer says "fix doesn't work" / "doesn't resolve the issue" / "wrong approach":
    Close the PR with: "Thanks for the feedback. Closing this as the approach doesn't resolve the issue. Apologies for the noise."
    Mark as fix_rejected. Do NOT iterate on a fundamentally broken fix — it wastes maintainer time.

10c. If maintainer says "already fixed" / "fixed in latest release" / "resolved upstream":
    Close the PR with: "Thanks for confirming — glad this is resolved. Closing as it's already fixed upstream."
    Mark as already_fixed_upstream. Do NOT argue or ask for merge anyway.

11. If round 3: post polite disengagement message, do NOT close PR yourself

12. Write results to memory/subagent-result-followup-{repo}-{pr}.md
    using the format defined in templates/subagent-result-schema.md

13. CLEANUP: rm -rf $WORKDIR

Then reply: ANNOUNCE_SKIP

## Result File

When finished, write results to `memory/subagent-result-followup-{repo}-{pr}.md`
using the format defined in `templates/subagent-result-schema.md` with `type: followup`.

**failure_reason MUST use a standard category** from the taxonomy in the schema.
Common follow-up failures: `reviewer_rejected_scope`, `reviewer_requested_rewrite`,
`max_rounds_exceeded`, `pr_closed_by_maintainer`, `branch_conflict`,
`fix_rejected`, `already_fixed_upstream`.
Format: `"category: optional details"` — e.g., `"reviewer_rejected_scope: maintainer said not a bug"`.
