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
   **IMPORTANT**: Use `python3` (not `python`) for all commands. The `python` binary does not exist on this system.

1b. HEALTH GATE (defense-in-depth — skip follow-up if repo now fails health):
   ```bash
   bash /Users/kevinlin/clawOSS/scripts/repo-health-check.sh {owner}/{repo}
   if [ $? -ne 0 ]; then
     echo "SKIP: repo {owner}/{repo} now fails health check — not worth following up"
     rm -rf $WORKDIR
     # Write result as failure with reason "repo_health_fail"
     exit 0
   fi
   ```

2. Clone OUR FORK (not upstream) so we have push access:
   `gh repo clone BillionClaw/{repo} $WORKDIR -- --depth=50`
   Then checkout the PR branch (NOT main): `git checkout {branch}`
   Check for CONTRIBUTING.md and AGENTS.md in repo root — follow their conventions and instructions.

3. Read ALL review comments — understand what each reviewer is asking

4. For change requests: implement the requested modifications

5. For questions: prepare clear technical responses

6. Run tests to verify no regressions

7. Commit and push to the SAME branch (updates the PR automatically)

8. Respond to reviewers:
   - General comments: gh pr comment {number} --repo {owner}/{repo} --body '...'
   - Inline replies: gh api repos/{owner}/{repo}/pulls/{number}/comments -X POST -f body='...' -F in_reply_to={comment_id}

9. Stay within the original contribution scope — do NOT expand to features even if reviewer suggests

10. If reviewer says the contribution is out of scope: adjust scope to match feedback, or leave PR open
    for maintainer to close. Comment: "Thanks for the feedback — happy to adjust the scope." Mark as scope_adjusted.

10b. If issue reporter or reviewer says "fix doesn't work" / "doesn't resolve the issue" / "wrong approach":
    **REWORK** — use the rework pipeline:
    ```bash
    REWORK=$(bash /Users/kevinlin/clawOSS/scripts/rework-pr.sh $WORKDIR {owner}/{repo} {pr} "feedback summary here")
    echo "$REWORK"  # Provides review context, sets up workspace, comments on PR
    ```
    Then implement a different approach and force-push to the same branch.
    Mark as rework_in_progress. Only mark fix_rejected if 2+ rework attempts also fail.

10c. If maintainer says "already fixed" / "fixed in latest release" / "resolved upstream":
    ```bash
    bash /Users/kevinlin/clawOSS/scripts/respond-to-review.sh {owner}/{repo} {pr} close-fixed
    ```
    Mark as already_fixed_upstream. Do NOT argue or ask for merge anyway.

10d. CLA RULE (HONESTY — never lie): If a reviewer asks about CLA:
    ```bash
    CLA_INFO=$(bash /Users/kevinlin/clawOSS/scripts/sign-cla.sh {owner}/{repo})
    echo "$CLA_INFO"  # Shows CLA type + signing instructions
    ```
    Follow the signing instructions from the script. If repo doesn't require CLA, respond:
    "This repo doesn't appear to require a CLA — happy to complete one if needed."
    Do NOT claim to have signed a CLA you didn't sign — complete the signing process first, then confirm.

10e. IDENTITY QUESTIONS ("are you an AI?", "are you a bot?", "is this AI-generated?"):
    ```bash
    bash /Users/kevinlin/clawOSS/scripts/respond-to-review.sh {owner}/{repo} {pr} identity
    ```
    NEVER say "AI agent", "AI-generated", "AI assistance". NEVER deny being automated.

11. If round 3: post polite disengagement message, do NOT close PR yourself — leave for maintainer

12. Write results to memory/subagent-result-followup-{repo}-{pr}.md
    using the format defined in templates/subagent-result-schema.md
    If reviewer approved or gave positive feedback, update trust:
    ```bash
    bash /Users/kevinlin/clawOSS/scripts/update-trust-repos.sh {owner}/{repo} promote
    ```

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
