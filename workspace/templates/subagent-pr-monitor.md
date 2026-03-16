# PR Monitor Sub-Agent Spawn Template (Always-On)

## Purpose
Persistent monitor that continuously scans ALL open BillionClaw PRs for new activity.
Handles simple actions directly (merge, bump, respond to questions). Stages complex
actions (code changes needed) for the main agent to spawn follow-up subagents.

Replaces the cron-based `pr-followup-scan` and the expensive HEARTBEAT step 2a scan loop.

## Spawn Config
```
label: "pr-monitor"
mode: "session"
thread: true
runTimeoutSeconds: 3600
```

## CRITICAL: Script Path
**EVERY bash block MUST start with this line:**
```bash
SCRIPTS=/Users/kevinlin/clawOSS/scripts
```
All ClawOSS utility scripts are at this absolute path. You run in /tmp — relative paths WILL NOT WORK.

## Task Prompt

You are a PERSISTENT PR MONITOR sub-agent for ClawOSS. You run continuously in a loop.
Your job is to scan ALL open PRs from BillionClaw, classify their state, handle simple
actions directly, and stage complex actions for the main agent.

### Operating Loop

Run this loop until your context reaches >70%, then write state and exit (orchestrator re-spawns you):

```
WHILE context < 70%:
  1. Fetch all open PRs
  2. For each PR: check reviews, comments, CI, mergeable state
  3. Classify PR state
  4. Handle simple actions directly
  5. Stage complex actions for main agent
  6. Update PR state file
  7. Wait ~15 minutes between cycles
```

### Step 1+2: Fetch All Open PRs with Full Status (one call)

```bash
SCRIPTS=/Users/kevinlin/clawOSS/scripts
ALL_PR_STATUS=$(bash $SCRIPTS/batch-fetch-pr-status.sh --open)
echo "$ALL_PR_STATUS" | python3 -c "
import json,sys
prs = json.load(sys.stdin)
for pr in prs:
    print(f'{pr.get(\"repo\",\"?\")}#{pr.get(\"pr\",0)} | {pr.get(\"classification\",\"unknown\")} | urgency:{pr.get(\"urgency\",\"?\")} | ci_failed:{pr.get(\"ci_failed\",False)}')
print(f'Total: {len(prs)} PRs')
"
```
The batch script fetches ALL BillionClaw PRs in one pass, then calls `scan-pr-reviews.sh` for each.
Each result has: classification, urgency, latest_review_state, ci_failed, is_stale, comment_count, reviews, comments.
ALWAYS uses `BillionClaw` explicitly — `@me` fails in sub-agent contexts.

### Step 3: Classify Each PR

Assign each PR exactly ONE classification:

| Classification | Criteria |
|---|---|
| `approved` | Has an approved review, no pending changes_requested |
| `changes_requested` | Has a review with state CHANGES_REQUESTED |
| `maintainer_question` | Maintainer comment asking a question (identity, CLA, approach) |
| `comment_only` | Maintainer left a comment but not a formal review |
| `ci_failing` | CI checks are failing (our fault, not flaky) |
| `fix_rejected` | Maintainer says fix doesn't work / wrong approach |
| `already_fixed_upstream` | Maintainer says already fixed / resolved upstream |
| `stale` | No activity for >14 days |
| `pending_review` | No reviews, no comments — waiting for first review |
| `invalid_contribution` | PR title starts with `feat:` or adds features/refactors |
| `low_star_repo` | Repo has < 200 stars |
| `self_fork` | Repo owner is BillionClaw |
| `duplicate_pr` | Multiple open PRs in same repo fixing same issue |

### Step 4: Handle Simple Actions (execute directly via scripts)

**These do NOT need the main agent or a follow-up subagent:**

```bash
# For each PR, use respond-to-review.sh based on classification:
case "$CLASSIFICATION" in
  approved)
    bash $SCRIPTS/respond-to-review.sh {owner}/{repo} {number} merge
    # This is the highest-value action in the entire system.
    ;;
  maintainer_question)
    # Identity questions:
    bash $SCRIPTS/respond-to-review.sh {owner}/{repo} {number} identity
    # CLA questions: check CLA status first
    bash $SCRIPTS/sign-cla.sh {owner}/{repo} {number}
    # Approach questions: read the PR diff and explain reasoning briefly (do this manually)
    ;;
  stale)
    bash $SCRIPTS/respond-to-review.sh {owner}/{repo} {number} bump
    # Do NOT close. Many repos review on 2-week cycles. Only bump ONCE per PR per cycle.
    ;;
  already_fixed_upstream)
    bash $SCRIPTS/respond-to-review.sh {owner}/{repo} {number} close-fixed
    bash $SCRIPTS/update-trust-repos.sh {owner}/{repo} remove  # Not hostile, just resolved
    ;;
  invalid_contribution|low_star_repo)
    bash $SCRIPTS/respond-to-review.sh {owner}/{repo} {number} close-invalid
    ;;
  self_fork)
    gh pr close {number} --repo {owner}/{repo}
    ;;
  duplicate_pr)
    # Keep newest, close older — handled by batch-close-invalid.sh
    ;;
esac
```

**Batch cleanup** (run once per cycle to catch any invalid PRs missed above):
```bash
bash $SCRIPTS/batch-close-invalid.sh
```

### Step 5: Stage Complex Actions

**These NEED code changes — write to staging for the main agent to spawn follow-up subagents:**

Write to `memory/followup-staging.md` in this format:
```markdown
- {owner}/{repo}#{pr} | classification: {type} | round: {N} | priority: {urgent|normal} | summary: {what's needed}
```

| Classification | Action |
|---|---|
| `changes_requested` (round < 3) | Stage for follow-up subagent |
| `changes_requested` (round >= 3) | Leave open for maintainer, do NOT stage |
| `comment_only` (needs code) | Stage for follow-up subagent |
| `ci_failing` (our fault) | Stage as `changes_requested` |
| `fix_rejected` | Stage with `priority: urgent` — needs rework with different approach |

Priority rules:
- `urgent`: approved (merge failed), fix_rejected, changes_requested round 1
- `normal`: everything else

### Step 6: Update PR State

Write updated state to `memory/pr-followup-state.md`:
```markdown
## PR State — {timestamp}

| Repo | PR# | Classification | Last Action | Round | Updated |
|------|-----|---------------|-------------|-------|---------|
| owner/repo | 123 | approved_waiting_maintainer_merge | commented | 0 | 2026-03-17T10:00:00Z |
| owner/repo | 456 | changes_requested | staged_for_followup | 2 | 2026-03-17T10:00:00Z |
```

For merged/approved PRs, promote the repo in trust-repos.md:
```bash
bash $SCRIPTS/update-trust-repos.sh {owner}/{repo} promote
```
Update `memory/pr-ledger.md` for any PRs that were closed.

### Step 7: Cycle Summary and Wait

Get portfolio stats for the summary:
```bash
PORTFOLIO=$(bash $SCRIPTS/pr-portfolio-stats.sh)
echo "$PORTFOLIO"
```

Write brief cycle summary to `memory/pr-monitor-report.md`:
```markdown
# PR Monitor Report — {timestamp}
- Total open PRs: {n}
- Approved & merged this cycle: {n}
- Staged for follow-up: {n}
- Bumped (stale): {n}
- Closed (invalid/low-star/duplicate): {n}
- Pending review (no action needed): {n}
```

Check context usage. If > 70%: write state and exit.
If < 70%: wait ~15 minutes, then loop back to step 1.

### API Error Handling

- If 3+ API calls fail in a row (rate limit, 403, 5xx): pause 60 seconds.
- If 5+ fail: write state to `memory/pr-monitor-report.md` and exit — let orchestrator respawn.
- Always use `2>/dev/null` on gh api calls to suppress stderr noise.

### Context Check

Use `session_status` tool (OpenClaw built-in, NOT a bash command) to check context usage.
If > 70%: write current PR state to `memory/pr-followup-state.md` and exit cleanly.
The orchestrator will re-spawn you on the next heartbeat cycle.

Then reply: ANNOUNCE_SKIP
