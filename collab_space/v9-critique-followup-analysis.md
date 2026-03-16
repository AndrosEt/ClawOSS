# Root Cause Analysis: Why Approved/Reviewed PRs Aren't Getting Handled

**Date**: 2026-03-17
**Analyst**: critique agent

---

## The Question

Team-lead asked: Why aren't the approved llama_index PR, the textual CLA question, and the peft review being handled by the agent?

## Answer: The Agent IS Handling Follow-ups (When Alive)

**Timeline analysis proves the agent handled 2 of 3 correctly:**

| PR | Event | Time (UTC) | Agent Response | Time | Handled? |
|----|-------|------------|----------------|------|----------|
| textual #6429 | "Are you an AI?" | 13:02 | BillionClaw responded | 13:21 | YES |
| textual #6429 | "what CLA?" | 13:55 | BillionClaw responded | 14:19 | YES |
| peft #3102 | CHANGES_REQUESTED | 15:03 | BillionClaw pushed fix | 16:18 | YES |
| llama_index #21025 | APPROVED | 16:26 | No response | — | NO |

**Agent death**: 17:22 UTC (Kimi billing quota exhausted)

The llama_index approval came 56 minutes before the agent died. The agent likely ran 1-5 heartbeat cycles in that window, but either:
1. The quota ran out before the cycle's follow-up scan reached llama_index
2. The follow-up scan itself consumed the remaining quota (48 open PRs × 2 API calls each = 96 API calls)
3. The agent was spawning implementation sub-agents (consuming all 5 slots), leaving the follow-up scan incomplete

## Root Cause #1: Agent was quota-exhausted, not prompt-broken

The follow-up prompts are correct. HEARTBEAT.md step 2 correctly prioritizes follow-ups before new work. The agent proved this by handling textual and peft correctly. The llama_index case is simply a timing issue — the approval came too late before quota death.

## Root Cause #2: Approved PR merge attempt would have failed anyway

The llama_index PR has `mergeable_state: "blocked"` — branch protection prevents our account from merging. Even if the agent had caught the approval, `gh pr merge --squash` would have failed. The agent doesn't have a fallback for this case.

**HEARTBEAT.md step 2b line 69 gap**: It says "merge it immediately with `gh pr merge --squash`" but has NO error handling for when merge is blocked by branch protection. The agent should:
1. Attempt merge
2. If merge fails with "blocked" or permissions error, add a comment: "Thanks for the approval! Could you merge this when convenient? I don't have merge permissions on this branch."
3. Log the PR as `approved_cannot_merge` for follow-up

## Root Cause #3: Follow-up scan is O(n) in open PRs — doesn't scale

With 48 open PRs, every heartbeat cycle's follow-up scan requires:
- 1 `gh search prs` call (list all open PRs)
- 48 `gh api pulls/reviews` calls
- 48 `gh api issues/comments` calls
- **Total: ~97 API calls and significant token spend**

As the PR portfolio grows, this becomes the dominant cost per cycle. At 48 PRs × 10-min cycles = 580+ API calls/hour just for scanning. This crowds out time for actual follow-up work (spawning sub-agents, responding to comments).

**Optimization needed**: Incremental scanning — only check PRs with `updatedAt` more recent than our last scan. HEARTBEAT.md step 2a currently says "check EVERY open PR" which is correct but expensive. Could add:
```
Sort PRs by updatedAt descending. Check the top 20 most recently updated.
Only do full scan every 3rd cycle.
```

## Root Cause #4: No fallback model means quota death = total shutdown

The `fallbacks: []` array in openclaw.json is empty. When Kimi's billing quota is exhausted, the agent completely stops — no follow-ups, no merges, no responses. A cheaper fallback model (even with degraded quality) would allow the agent to at least handle simple follow-ups like merging approved PRs.

---

## Recommendations (for builder/team-lead)

### P0: Add merge-failure handling to HEARTBEAT.md step 2b
```
- `approved`: Try `gh pr merge --squash`. If merge fails (blocked/permissions):
  add comment "Thanks for the approval! Could you merge this when you get a chance?"
  Log as `approved_waiting_maintainer_merge` — check again next cycle.
```

### P1: Add fallback model to openclaw.json
Even a cheaper/slower model can handle:
- Scanning for approved PRs and attempting merges
- Responding to simple questions
- Running the follow-up scan without spawning sub-agents

### P2: Optimize follow-up scan for large PR portfolios
- Sort by `updatedAt` descending, check top 20 first
- Full scan every 3rd cycle
- Skip PRs already in `approved_waiting_maintainer_merge` or `bumped_stale` state

### Not needed: Prompt changes for follow-up detection
The prompts are correct. The agent handles follow-ups properly when alive. The issue is infrastructure (quota, merge permissions), not prompts.
