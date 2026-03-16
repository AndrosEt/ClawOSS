# Follow-up Sub-Agent Spawn Template

## Variables (substitute before spawning)
- `{owner}` — repo owner (e.g., `facebook`)
- `{repo}` — repo name (e.g., `react`)
- `{pr}` — PR number (e.g., `12345`)
- `{branch}` — PR branch name (e.g., `clawoss/fix/null-check`)
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

IMPORTANT: This is a FOLLOW-UP on an existing bug-fix PR, not new work.
Read the attached followup context file for all review comments and PR details.
Follow the oss-pr-review-handler skill workflow:

1. Create isolated workspace: WORKDIR=/tmp/clawoss-followup-{pr}-$(date +%s)
   mkdir -p $WORKDIR && cd $WORKDIR

2. Clone repo and checkout the PR branch (NOT main): git checkout {branch}

3. Read ALL review comments — understand what each reviewer is asking

4. For change requests: implement the requested modifications

5. For questions: prepare clear technical responses

6. Run tests to verify no regressions

7. Commit and push to the SAME branch (updates the PR automatically)

8. Respond to reviewers:
   - General comments: gh pr comment {number} --repo {owner}/{repo} --body '...'
   - Inline replies: gh api repos/{owner}/{repo}/pulls/{number}/comments -X POST -f body='...' -F in_reply_to={comment_id}

9. Stay within bug-fix scope — do NOT expand to features even if reviewer suggests

10. If reviewer says 'this is not a bug fix': close PR politely, mark as closed_scope_concern

11. If round 3: post polite disengagement message, do NOT close PR yourself

12. Write results to memory/subagent-result-followup-{repo}-{pr}.md
    using the format defined in templates/subagent-result-schema.md

13. CLEANUP: rm -rf $WORKDIR

Then reply: ANNOUNCE_SKIP

## Result File

When finished, write results to `memory/subagent-result-followup-{repo}-{pr}.md`
using the format defined in `templates/subagent-result-schema.md` with `type: followup`.
