# V9: PR Conflict & Supersession Prevention — prompt-architect Implementation
**Date**: 2026-03-16
**Status**: IMPLEMENTED (all 4 phases)

---

## Problem
PRs getting closed because:
1. Another contributor already has an open PR for the same issue
2. Issue is assigned to someone (we're stepping on toes)
3. Our PR conflicts with existing open PRs in the repo
4. We don't check issue timeline for linked PRs before starting work

## Changes Made

### Phase 1: Sub-Agent Pre-Implementation Checks
**File**: `workspace/templates/subagent-implementation.md` — step 1c completely rewritten

5 checks now run BEFORE any code is written:
1. **Linked PRs (timeline API)**: `gh api "repos/{repo}/issues/{issue}/timeline"` — checks for cross-referenced PRs. If any open PR addresses this issue, ABANDON with `superseded`.
2. **Issue assignee**: `gh api "repos/{repo}/issues/{issue}" --jq '.assignees'` — if assigned, ABANDON with `issue_assigned`.
3. **Already fixed in commits**: git log scan for fix keywords (existing check, preserved).
4. **Competing open PRs**: `gh pr list --search "{issue}"` — checks for PRs from other contributors (existing check, preserved).
5. **File conflict awareness**: `gh pr list --json number,title,headRefName` — reads ALL open PRs to understand what's in flight. If our fix would touch same files as another PR, ABANDON or adjust scope.

Also added to step 1d: "Someone commented 'I'm working on this' or 'I'll take this'" as an ABANDON trigger.

### Phase 2: AGENTS.md Rules
**File**: `workspace/AGENTS.md` — added "PR Conflict & Supersession Prevention" section

5 rules:
1. No linked PRs
2. Not assigned
3. No competing PRs
4. No file conflicts
5. Not already fixed

### Phase 3: HEARTBEAT Integration
**File**: `workspace/HEARTBEAT.md`

- **Step 3b gate h**: Added SUPERSESSION CHECK — quick timeline API + assignee check before spawning. Skipped issues marked `superseded`/`assigned` in pr-ledger.md.
- **Step 4b-SUPERSESSION**: Added "is anyone else already working on this?" check during triage. Cheaper to check here (1 API call) than discover mid-implementation.
- **Step 5c**: Added PASS OPEN PR CONTEXT — fetches repo's open PRs and passes as attachment to sub-agent so it can avoid file conflicts.

### Phase 4: Discovery & Triage Updates
- **oss-triage/SKILL.md**: Added step 0e (Supersession Check) — checks linked PRs and assignees before scoring.
- **oss-discover/SKILL.md**: Updated pre-checks to include supersession filtering. Issues with assignees or linked PRs skipped and marked in pr-ledger.md.
- **subagent-result-schema.md**: Added `superseded` failure category to taxonomy.
- **config/openclaw.json + ~/.openclaw/openclaw.json**: Added SUPERSESSION CHECK to heartbeat prompt.

## Defense-in-Depth Architecture

The supersession check runs at 4 levels (any one catching it prevents wasted work):

| Level | Where | Check | Cost |
|-------|-------|-------|------|
| Discovery | oss-discover pre-checks | Assignee + linked PRs | 1 API call |
| Triage | oss-triage step 0e | Timeline API + assignee | 2 API calls |
| Spawn | HEARTBEAT step 3b gate h | Timeline API + assignee | 2 API calls |
| Implementation | subagent step 1c | Full 5-check suite | 3-4 API calls |

## Files Changed (9 total)

| File | Change |
|------|--------|
| workspace/templates/subagent-implementation.md | Step 1c: 5-check supersession suite |
| workspace/AGENTS.md | PR Conflict & Supersession Prevention section |
| workspace/HEARTBEAT.md | Steps 3b(h), 4b-SUPERSESSION, 5c |
| workspace/skills/oss-triage/SKILL.md | Step 0e: Supersession Check |
| workspace/skills/oss-discover/SKILL.md | Pre-checks: supersession filtering |
| workspace/templates/subagent-result-schema.md | `superseded` failure category |
| config/openclaw.json | SUPERSESSION CHECK in heartbeat prompt |
| ~/.openclaw/openclaw.json | Same (live config) |
| collab_space/v9-supersession-prevention.md | This document |

## File Sizes (verified safe)
- HEARTBEAT.md: 12987 chars (limit 20000)
- AGENTS.md: 9981 chars (limit 20000)
