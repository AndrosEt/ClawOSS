# V9 Follow-up Subagent Architecture

**Author**: team-lead
**Date**: 2026-03-17
**Status**: DESIGN — ready for builder implementation

---

## Problem

The current follow-up system is a cron job + inline HEARTBEAT step 2 that:
- Burns ~97 API calls per cycle scanning 48+ open PRs
- Runs in the main agent context (eating its token budget)
- Only reacts to current state (reviews/comments) with no historical analysis
- Doesn't learn from past PR outcomes (merges, rejections, patterns)
- Competes for context space with discovery, triage, and spawning

## Solution: 2 Dedicated Follow-up Subagents

### Subagent 1: PR Monitor (always-on, like the scout)

**Role**: Continuous scanning of ALL open PRs for new activity. This replaces HEARTBEAT step 2a (the expensive scan loop) and the pr-followup cron.

**Spawn config**:
```
sessions_spawn(
  task: <read templates/subagent-pr-monitor.md>,
  label: "pr-monitor",
  mode: "session",
  thread: true,
  runTimeoutSeconds: 3600
)
```

**What it does every cycle (15-min loop)**:
1. Fetch ALL open BillionClaw PRs: `gh search prs --author BillionClaw --state open --limit 50`
2. For each PR, check:
   - `gh api repos/{repo}/pulls/{num}/reviews` — formal reviews
   - `gh api repos/{repo}/issues/{num}/comments` — maintainer comments
   - `gh api repos/{repo}/pulls/{num}` — CI status, mergeable state
3. Classify each PR (approved, changes_requested, comment_only, maintainer_question, ci_failing, fix_rejected, stale, etc.)
4. For simple actions (merge approved PRs, bump stale, respond to identity questions), execute DIRECTLY — no need to involve the main agent
5. For complex actions (changes_requested, fix_rejected, rework), write to `memory/followup-staging.md` for the main agent to spawn follow-up subagents
6. Update `memory/pr-followup-state.md` with current state of every PR
7. Sleep 15 min, repeat

**What it offloads from the main agent**:
- The entire step 2a scan (97+ API calls per cycle)
- Simple follow-up actions (merging, bumping, identity responses)
- PR state tracking

**HEARTBEAT step 2 becomes**: "Read followup-staging.md. Spawn follow-up subagents for any items needing code changes. Clear staging."

### Subagent 2: PR Analyst (runs on demand, not always-on)

**Role**: Deep analysis of PR portfolio — historical patterns, repo behavior, merge predictions, strategy recommendations. This is the "intelligence" layer that learns from past outcomes.

**Spawn config**:
```
sessions_spawn(
  task: <read templates/subagent-pr-analyst.md>,
  label: "pr-analyst",
  runTimeoutSeconds: 1800
)
```

**When it runs**: Spawned by the main agent once per day (or when the PR monitor flags unusual patterns).

**What it does**:
1. **Portfolio analysis**: Fetch ALL PRs (open + closed + merged) from BillionClaw
2. **Failure mode classification**: For each closed/unmerged PR:
   - Read maintainer comments — what went wrong?
   - Categorize: duplicate fix, feature not bug, CLA, didn't follow contributing guide, AI detected, fix doesn't work, already fixed upstream, repo hostile, etc.
   - Track which repos are friendly vs hostile
3. **Merge pattern analysis**:
   - Which PR types merge fastest? (docs > typos > tests > bugs)
   - Which repos are most responsive?
   - What PR size merges best?
   - What time of day/week gets fastest reviews?
4. **Trust scoring update**: Update `memory/trust-repos.md` based on actual merge/rejection data
5. **Strategy recommendations**: Write to `memory/pr-strategy.md`:
   - "Focus on repo X — 2 merges, fast review cycle"
   - "Avoid repo Y — maintainer hostile, banned us"
   - "PR size sweet spot: 15-45 lines"
   - "Best PR types: docs fixes (84% merge), test additions (75%)"
6. **Repo blocklist maintenance**: Auto-add repos that:
   - Banned or threatened to ban BillionClaw
   - Closed 3+ PRs without merge
   - Have anti-AI policies
   - Maintainer explicitly said "no bot PRs"

**Output files**:
- `memory/pr-portfolio-analysis.md` — full analysis with data
- `memory/trust-repos.md` — updated trust scores
- `memory/pr-strategy.md` — strategic recommendations for the main agent
- `memory/repo-blocklist.md` — repos to avoid (with reasons)

## Slot Allocation

Current: 6 slots (1 scout + 5 impl/followup)

New: 7 slots total:
- 1 scout (always-on, discovery)
- 1 PR monitor (always-on, follow-up scanning)
- 5 impl/followup (unchanged)

The PR analyst is NOT always-on — it runs once per day and uses 1 of the 5 impl slots temporarily.

Update `maxConcurrent` from 6 to 7 in both configs.

## HEARTBEAT Changes

### Step 0.5 becomes: "Subagent Management"
```
Check always-on subagents:
1. Scout (label "scout-*"): respawn if dead
2. PR Monitor (label "pr-monitor"): respawn if dead

Read outputs:
- memory/scout-report-*.md → merge into work-queue-staging.md
- memory/followup-staging.md → process follow-up items (spawn subagents for code changes)

Once daily (check date in pr-strategy.md):
- Spawn PR Analyst if not run today
- Read memory/pr-strategy.md and memory/repo-blocklist.md — adjust behavior
```

### Step 2 simplifies to:
```
2. PR Follow-ups (delegated to PR Monitor subagent)
Read memory/followup-staging.md. For items needing code changes:
- changes_requested → spawn follow-up subagent
- fix_rejected → spawn rework subagent
Clear processed items from staging.
The PR Monitor handles: merging approved PRs, bumping stale PRs, responding to questions, updating state.
```

This saves ~2000 tokens from HEARTBEAT.md and eliminates the 97-API-call scan from the main loop.

## Template Files Needed

### templates/subagent-pr-monitor.md (NEW)
Persistent loop that scans PRs, handles simple actions, writes staging for complex actions.

### templates/subagent-pr-analyst.md (NEW)
On-demand deep analysis of PR portfolio with historical pattern recognition.

### Changes to existing files:
- HEARTBEAT.md: Simplify step 2, expand step 0.5
- config/openclaw.json: maxConcurrent 6 → 7
- ~/.openclaw/openclaw.json: same

## Why 2 Subagents Instead of 1

The PR Monitor needs to be fast and lightweight — scan, classify, act on simple items, stage complex ones. It runs every 15 minutes and should complete in <5 minutes.

The PR Analyst needs to be slow and thorough — read every closed PR's comments, build statistical models, update strategy. It runs once daily and might take 30-60 minutes.

Combining them would make the monitor too slow (can't spend 30 min analyzing history when reviews need responses within 4 hours) or the analyst too shallow (rushing analysis to keep up with the monitor cycle).

## Migration Path

1. Builder creates the two template files
2. Builder updates HEARTBEAT.md step 0.5 and step 2
3. Builder updates maxConcurrent to 7
4. Remove the pr-followup cron job from config/cron-jobs.json (replaced by PR Monitor)
5. Test: restart agent, verify PR Monitor spawns and scans correctly
6. Verify: main agent heartbeat cycle is faster (no more step 2a scan)
