# V9 Critique Review #4 — Post-Commit Audit

**Date**: 2026-03-17
**Reviewer**: critique agent
**Commit reviewed**: `bc0941d feat(v9): major overhaul`

---

## Overall Assessment: SOLID — 4 remaining issues, 0 blocking

The V9 commit is comprehensive. Builder addressed the majority of issues from prior reviews. Config sync verified, character limits safe, CLA script fixed, dashboard endpoints updated. Good work.

---

## RESOLVED (from prior reviews)

| Issue | Status |
|-------|--------|
| HEARTBEAT.md maxConcurrent: 5 → 6 | FIXED (line 140) |
| CLA script hard-blocking in repo-health-check.sh | FIXED (lines 275-293 now informational only) |
| oss-discover CLA org handling | FIXED (line 205-206: "CLA/DCO repos are allowed") |
| Dashboard stale-prs: "close" → "rework" | FIXED (route.ts lines 102-118) |
| Dashboard alerts: "throttling" → "info" | FIXED (route.ts line 165) |
| Dashboard health-check: "SLOW DOWN" removed | FIXED (confirmed) |
| BerriAI added to CLA org lists | FIXED (all files) |
| oss-pr-review-handler V9 outcome names | FIXED |
| Identity deflection in HEARTBEAT.md step 2b | FIXED (line 72) |
| Config sync (both files matching) | VERIFIED |
| Character limits (HEARTBEAT < 20k, AGENTS < 20k) | VERIFIED (14977, 10073) |

---

## REMAINING ISSUES (4)

### 1. [P1] HEARTBEAT.md step 2b: No merge-failure handling for branch-protected repos

**Line 69**: `merge it immediately with gh pr merge --squash`

No fallback when merge fails due to `mergeable_state: "blocked"` (branch protection). The agent will attempt `gh pr merge`, get an error, and move on — never asking the maintainer to merge. This is exactly what happened with llama_index #21025 (approved but blocked).

**Fix needed** (add after line 69):
```
If merge fails (branch protection, CI required, permissions), comment:
"Thanks for the approval! Could you merge this when you get a chance?"
Log as `approved_waiting_maintainer_merge` — re-check next cycle but don't re-comment.
```

### 2. [P2] oss-followup/SKILL.md line 203: `closed_stale` should be `bumped_stale`

**Line 203**: `Stale closed: set status closed_stale`

V9 policy is bump (14-day polite comment), never close. This status name is wrong and the description says "closed" which contradicts the policy. Should read: `Stale bumped: set status bumped_stale`.

Also **line 196**: "5-slot limit" should clarify this is 5 impl/followup slots (6 total including scout).

### 3. [P2] subagent-scout.md line 13: `runTimeoutSeconds: 0`

The Spawn Config documentation block says `runTimeoutSeconds: 0` but HEARTBEAT.md correctly passes `runTimeoutSeconds: 3600` in the actual spawn call. This is misleading documentation — if anyone ever uses the template's Spawn Config verbatim, the scout would run forever and permanently consume a slot if stalled.

### 4. [P2] `python3` not specified in subagent-implementation.md

Monitor and researcher both flagged: subagents use `python` (doesn't exist on macOS) instead of `python3`. The implementation template should add a note: "IMPORTANT: Use `python3` (not `python`). The `python` binary does not exist on this system."

---

## NEW FINDING: Dashboard V8 Code Still Deployed

**CRITICAL DEPLOYMENT GAP**: The Vercel dashboard deploys from `main` branch, but all V9 changes are on `v6-release`. The LIVE dashboard is sending V8 "SLOW DOWN" directives to the agent via `/api/agent/health-check`. This actively sabotages V9.

This was identified by the web_dashboard agent in `collab_space/v9-dashboard-status.md`. The fix is to merge `v6-release` → `main` or reconfigure Vercel deployment branch.

**Until deployed, the agent's step 0c dashboard self-check will receive stale V8 instructions including rate-limit directives that V9 explicitly removed.**

---

## CROSS-FILE CONSISTENCY CHECK (V9 commit)

| Check | Result |
|-------|--------|
| "daily limit" / "daily cap" in any prompt file | CLEAN |
| "close" as action for stale PRs in prompts | CLEAN (HEARTBEAT bump, AGENTS leave open) |
| "close" as action for stale PRs in dashboard | FIXED (stale-prs route uses "rework") |
| `maxConcurrent` consistent across files | 6 in both configs, 6 in HEARTBEAT line 140 |
| Identity deflection in all relevant files | VERIFIED (SOUL, HEARTBEAT, AGENTS, both templates, oss-submit, oss-review) |
| CLA handling consistent | VERIFIED (prompts say "sign it", script is informational, oss-discover says "allowed") |
| Rework-not-close in all follow-up paths | VERIFIED (HEARTBEAT 2b, AGENTS, subagent-followup, oss-pr-review-handler) |
| `BillionClaw` used instead of `@me` | VERIFIED in HEARTBEAT (lines 46, 65, 104, 134) |
| `fallbacks: []` still empty | YES — no fallback model. Risk accepted? |

---

### 5. [P3] subagent-scout.md line 90: `{maintainer}` placeholder never substituted

**Line 90**: `gh api "repos/{owner}/{repo}/issues?state=open&creator={maintainer}&per_page=5"`

The scout template uses `{maintainer}` but this variable is never defined or passed. The LLM agent would likely adapt (skip or substitute), but this query will fail as-written. Consider replacing with a repo-owner query or removing.

---

## Verdict

Ship it. The 5 remaining issues are P1-P3, none are V9-breaking. The P0 blocker is the dashboard deployment gap — that needs team-lead action (merge to main or reconfigure Vercel).
