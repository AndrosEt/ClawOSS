# V9 Dedup Architecture — Research & Recommendations

*2026-03-17 by researcher agent*

---

## Problem Statement

28% of ClawOSS rejections (15 of 53) are duplicate submissions — the same fix submitted 2-5 times to the same repo. Current dedup checks in HEARTBEAT.md step 3b, subagent-implementation.md step 8, and oss-triage step 0d are all bypassed.

**Root causes identified by critique:**
1. Concurrent sub-agents spawn before the first one's PR is created → `gh search prs --author BillionClaw` returns 0
2. `pr-ledger.md` not updated fast enough
3. `impl-spawn-state.md` not checked

## OpenClaw Constraints (from DeepWiki research)

1. **No built-in locking mechanism** — OpenClaw has no mutex, semaphore, or lock between subagent sessions
2. **Subagents get separate workspaces by default** — `~/.openclaw/workspace-<agentId>` pattern means subagents can't see each other's files unless configured
3. **Memory tools are DENIED to subagents** — can't use shared memory for coordination
4. **`maxConcurrent` controls parallelism** but doesn't prevent duplicate task assignment
5. **Subagents CAN share the main workspace** if sandbox is disabled and workspace is explicitly configured

## Proposed Solution: Multi-Layer Dedup

### Layer 1: Pre-Spawn Lock (Main Agent / Heartbeat)

**Before spawning any implementation subagent, the main heartbeat writes a lock file:**

```bash
# In workspace/memory/locks/
# Format: <org>__<repo>.lock
# Content: timestamp, issue URL, session key

LOCK_FILE="workspace/memory/locks/${ORG}__${REPO}.lock"
if [ -f "$LOCK_FILE" ]; then
  echo "SKIP: Already working on ${ORG}/${REPO}"
  # Check if lock is stale (>2 hours old)
  # If stale, remove and proceed
else
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | ${ISSUE_URL} | spawning" > "$LOCK_FILE"
  # Proceed with spawn
fi
```

**Why this works:** The main heartbeat is single-threaded — it processes issues sequentially. The lock file is written BEFORE `sessions_spawn` is called, eliminating the race condition.

**Key:** Lock files must be in the MAIN agent workspace (`~/.openclaw/workspace/memory/locks/`), NOT in subagent workspaces.

### Layer 2: Pre-Push Dedup (Subagent)

**Right before `git push` in subagent-implementation, check GitHub:**

```bash
# Check for existing PRs by our bot in this repo
EXISTING_PRS=$(gh pr list --repo "${ORG}/${REPO}" --author "BillionClaw" --state open --json number,title --jq 'length')
if [ "$EXISTING_PRS" -gt 0 ]; then
  echo "ABORT: BillionClaw already has ${EXISTING_PRS} open PR(s) in ${ORG}/${REPO}"
  exit 1
fi

# Also check recently closed PRs (last 7 days) for same issue
RECENT_CLOSED=$(gh pr list --repo "${ORG}/${REPO}" --author "BillionClaw" --state closed --json number,closedAt --jq '[.[] | select(.closedAt > (now - 604800 | todate))] | length')
if [ "$RECENT_CLOSED" -gt 0 ]; then
  echo "WARNING: BillionClaw had ${RECENT_CLOSED} closed PR(s) in ${ORG}/${REPO} in last 7 days"
  # Consider abort or proceed with caution
fi
```

**Why this works:** By the time subagent reaches `git push`, any earlier subagent for the same repo would have already created its PR. The `gh pr list` check at push-time catches the race.

### Layer 3: Post-PR Dedup (Subagent)

**Immediately after `gh pr create`, check for duplicates:**

```bash
PR_URL=$(gh pr create --title "..." --body "...")

# Check if we now have multiple open PRs in this repo
ALL_OUR_PRS=$(gh pr list --repo "${ORG}/${REPO}" --author "BillionClaw" --state open --json number,url --jq '.')
PR_COUNT=$(echo "$ALL_OUR_PRS" | jq 'length')

if [ "$PR_COUNT" -gt 1 ]; then
  echo "DUPLICATE DETECTED: We have ${PR_COUNT} open PRs in ${ORG}/${REPO}"
  # Close the NEWER PR (this one) and keep the older one
  gh pr close "$PR_URL" --comment "Closing duplicate — already submitted via another PR"
fi
```

### Layer 4: Heartbeat Sweep (Main Agent)

**In each heartbeat cycle, sweep for duplicates across all repos:**

```bash
# Check all open PRs by BillionClaw
gh search prs --author "BillionClaw" --state open --json repository,number,createdAt --jq '
  group_by(.repository.nameWithOwner)
  | map(select(length > 1))
  | .[]
  | sort_by(.createdAt)
  | .[1:][]  # Keep oldest, list newer duplicates
  | {repo: .repository.nameWithOwner, number: .number, action: "close"}
'
```

This finds any repo where we have 2+ open PRs and marks the newer ones for closure.

## Why NOT Use flock/mkdir Locks

While `flock` is the standard Unix mutex mechanism, it requires:
- Processes running on the same machine (our subagents may use sandboxed workspaces)
- File descriptors that persist across the lock scope
- Shell-level coordination that OpenClaw's subagent model doesn't support

**File-based locks (Layer 1) are simpler and sufficient** because the main heartbeat is single-threaded and controls spawn decisions.

## Why NOT Use `maxConcurrent: 1`

Setting `maxConcurrent: 1` would prevent race conditions but kills parallelism entirely. We want multiple subagents working on DIFFERENT repos simultaneously. The problem is duplicate assignment to the SAME repo, not concurrent execution itself.

## Implementation Priority

| Layer | Effort | Impact | Priority |
|-------|--------|--------|----------|
| Layer 1 (Pre-spawn lock) | Low | High — prevents 90% of duplicates | **P0** |
| Layer 2 (Pre-push check) | Low | Medium — catches race survivors | **P0** |
| Layer 3 (Post-PR check) | Low | Low — last-resort cleanup | P1 |
| Layer 4 (Heartbeat sweep) | Medium | Medium — catches anything else | P1 |

## Additional Recommendations

1. **One-PR-per-repo policy**: Never have more than 1 open PR per repo. If we want to submit a new fix, close the old one first (unless it's actively being reviewed).

2. **Lock file cleanup**: Heartbeat should clean lock files older than 4 hours (subagent either completed or died).

3. **pr-ledger.md remains useful** as a human-readable audit trail, but should NOT be the primary dedup mechanism — it's too slow to update in concurrent scenarios.

4. **Workspace sharing**: Configure subagents to share the main workspace (disable sandbox, or use `workspaceAccess: "rw"`) so they can read the locks directory. OR, have the main heartbeat pass the current lock state in the spawn prompt.

5. **Alternative — pass lock state in spawn prompt**: Since memory tools are denied to subagents, the simplest approach is to include "Currently active repos: [list]" in the `sessions_spawn` task prompt. The subagent can then skip if its target repo is in the list.
