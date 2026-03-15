# Throughput Architecture: 2-5 Commits Per Hour

> Designing the autonomous loop, configuration, and pipelining strategy to achieve sustained 2-5 high-quality commits per hour from a single OpenClaw agent running Minimax M2.5 via OpenRouter.

---

## Table of Contents

1. [Throughput Analysis](#1-throughput-analysis)
2. [Optimal Heartbeat Interval](#2-optimal-heartbeat-interval)
3. [The Self-Wake Architecture](#3-the-self-wake-architecture)
4. [Redesigned HEARTBEAT.md](#4-redesigned-heartbeatmd)
5. [Updated openclaw.json](#5-updated-openclawjson)
6. [Updated cron-jobs.json](#6-updated-cron-jobsjson)
7. [Pipelining Strategy](#7-pipelining-strategy)
8. [Fast Quality Gates](#8-fast-quality-gates)
9. [Latency Optimizations](#9-latency-optimizations)
10. [Realistic Throughput Expectations](#10-realistic-throughput-expectations)

---

## 1. Throughput Analysis

### The Math

**Target:** 2-5 commits/hour = 1 commit every **12-30 minutes**.

**Current state:** Heartbeat every 60 minutes. The agent can only begin new work on heartbeat ticks. This means at best 1 work cycle per hour — far too slow.

**What a single commit cycle requires:**

| Phase | Estimated Duration | Notes |
|-------|-------------------|-------|
| Discover/select issue | 1-3 min | If pre-queued via cron, ~0 min |
| Clone/analyze repo | 1-2 min | If cached from prior work, ~0 min |
| Read CONTRIBUTING.md + conventions | 0.5-1 min | Cached in memory after first visit |
| Implement fix | 3-8 min | Depends on complexity; Minimax M2.5 is fast |
| Run tests/lint | 1-3 min | Depends on repo's CI speed |
| Self-review quality gate | 1-2 min | Lightweight check, not full subagent |
| Commit + push + create PR | 0.5-1 min | Mechanical git operations |
| Report to dashboard | 0.5 min | Non-blocking API call |
| **Total** | **8-20 min** | **Fits 2-5/hour for simpler tasks** |

**Conclusion:** The cycle time math works for documentation, dependency updates, simple bug fixes, and test additions. Complex multi-file features will take 20-40 minutes and naturally fall to 1-2/hour.

### The Bottleneck Is Not the Model — It's the Loop

Minimax M2.5 via OpenRouter has fast inference times (typically 2-8 seconds per turn). The bottleneck is:

1. **Heartbeat interval** — currently 60 min, agent sits idle between heartbeats
2. **No self-wake** — agent cannot trigger its own next cycle
3. **No work pipelining** — agent finishes one task, then waits for next heartbeat
4. **Human delay** — artificial response delays waste time
5. **Cron isolation** — discovery runs in isolated sessions, results don't flow to main session efficiently

---

## 2. Optimal Heartbeat Interval

### Why Not Just Set Heartbeat to 5 Minutes?

Setting `every: "5m"` means 12 heartbeat runs per hour. Each heartbeat:
- Runs a full agent turn (model inference + tool calls)
- Consumes tokens even when there's nothing to do
- Most heartbeats will return `HEARTBEAT_OK` (wasted cycles)

**Cost analysis at 5-minute intervals with Minimax M2.5:**
- ~288 heartbeats/day
- Even with `HEARTBEAT_OK` fast-path (~$0.01-0.02 per tick via Minimax M2.5): ~$3-6/day
- With actual work on ~30% of ticks: $15-25/day
- Monthly: $450-750 in heartbeat overhead alone

**At 10-minute intervals:**
- ~144 heartbeats/day
- Fast-path cost: ~$1.50-3/day
- With work on ~50% of ticks: $10-18/day
- Monthly: $300-540

**At 15-minute intervals:**
- ~96 heartbeats/day
- Fast-path cost: ~$1-2/day
- With work on ~70% of ticks: $8-15/day
- Monthly: $240-450

### Recommendation: 10-Minute Heartbeat + Self-Wake

The optimal architecture is a **hybrid approach**:

1. **Base heartbeat: `every: "10m"`** — provides a safety net; agent is guaranteed to wake up at least every 10 minutes
2. **Self-wake via system events** — after completing a task, the agent triggers an immediate next cycle using `openclaw system event --mode now`
3. **Net effect:** The agent runs continuously when there's work to do (self-wake chain), but doesn't burn tokens when idle (10-min heartbeat catches new work)

This gives us the **best of both worlds**: continuous throughput during active work, and cost-efficient idle behavior.

---

## 3. The Self-Wake Architecture

### How It Works

OpenClaw's `system event --mode now` triggers an immediate heartbeat run. The agent can invoke this at the end of each work cycle to create a **continuous autonomous loop** without waiting for the next scheduled heartbeat.

```
[Heartbeat fires] → [Agent reads HEARTBEAT.md] → [Finds work] → [Implements] → [Commits] →
    [Reports to dashboard] → [Runs: openclaw system event --mode now] → [Immediate next heartbeat] →
    [Agent reads HEARTBEAT.md] → [Finds work] → ... (loop continues)
```

When there's no more work:
```
[Heartbeat fires] → [Agent reads HEARTBEAT.md] → [No work found] → [Responds HEARTBEAT_OK] →
    [Sleeps until next 10-min heartbeat]
```

### Implementation

The self-wake is triggered from within the HEARTBEAT.md checklist itself. The agent's final step after completing any work cycle is:

```bash
openclaw system event --text "Work cycle complete. Ready for next task." --mode now
```

This is a simple `exec` tool call — no framework modification required.

### Guard Rails for Self-Wake

**Critical: Prevent runaway loops.** The self-wake chain must have circuit breakers:

1. **Max consecutive wakes:** Track wake count in memory. After 8 consecutive self-wakes without a natural heartbeat pause, force a cooldown (skip the self-wake, wait for next scheduled heartbeat). This caps a burst at ~80-120 minutes of continuous work before a mandatory pause.

2. **Cost ceiling per hour:** If estimated token spend exceeds a threshold in the current hour, skip self-wake and wait.

3. **Error circuit breaker:** If 2 consecutive cycles fail (no commit produced, error encountered), stop self-waking and wait for next scheduled heartbeat.

4. **Work queue empty:** If discovery finds no suitable issues, respond `HEARTBEAT_OK` and don't self-wake.

5. **Rate limit awareness:** If GitHub API rate limits are approaching (>80% consumed), pause self-wake.

### Self-Wake Counter (Memory-Based)

The agent tracks wake state in `memory/wake-state.md`:

```markdown
# Wake State
- consecutive_wakes: 3
- last_wake: 2026-03-16T14:32:00Z
- commits_this_hour: 2
- errors_this_hour: 0
- hourly_reset: 2026-03-16T14:00:00Z
```

On each heartbeat:
- If `consecutive_wakes >= 8` → skip self-wake, reset counter on next scheduled heartbeat
- If `errors_this_hour >= 2` → skip self-wake
- If `commits_this_hour >= 6` → skip self-wake (anti-spam ceiling)
- On scheduled (non-self-wake) heartbeat → reset `consecutive_wakes` to 0

---

## 4. Redesigned HEARTBEAT.md

The HEARTBEAT.md must be optimized for speed. Every word costs tokens. The checklist must drive a tight loop with minimal deliberation.

```markdown
# Heartbeat — Fast Autonomous Loop

Read memory/wake-state.md. Update counters. If circuit breakers tripped, reply HEARTBEAT_OK.

## 1. Check Active PRs (1 min max)
Run: gh pr list --author @me --state open --json number,title,reviewDecision,statusCheckRollup
- If reviews received → run oss-followup. Then continue to step 4.
- If CI failing on our PR → investigate, fix, push. Then continue to step 4.
- If PR approved + CI green → it will be merged by maintainer. Continue.

## 2. Pre-Queued Work (0 min if queue empty)
Check memory/work-queue.md for pre-discovered issues.
- If queue has items → pick top item, skip to step 3.
- If queue empty → run oss-discover (fast mode: max 3 repos, max 5 issues). Write results to memory/work-queue.md.

## 3. Execute Work Cycle (5-15 min)
Pick ONE issue from queue. Run the pipeline:
1. oss-triage: confirm issue is still open, assess complexity (< 2 min)
2. repo-analyzer: read conventions if not in memory (< 1 min, skip if cached)
3. oss-implement: write the fix (3-8 min)
4. safety-checker: validate diff size, no secrets, file count (< 30 sec)
5. oss-review: lightweight self-check — does the change match the issue? (< 1 min)
6. oss-submit: commit, push, create PR (< 1 min)

## 4. Report & Continue
Run dashboard-reporter to log this cycle.
Update memory/wake-state.md: increment commits_this_hour, consecutive_wakes.
Remove completed item from memory/work-queue.md.

If circuit breakers OK and work remains → exec: openclaw system event --text "Cycle complete" --mode now
If no work or breakers tripped → HEARTBEAT_OK
```

### Key Design Decisions

1. **Work queue is pre-populated.** Discovery runs in the background (cron) so heartbeat cycles don't waste time searching. The heartbeat just picks from the queue.

2. **Skills are called in sequence, not debated.** The checklist is imperative: "run X, then Y." No open-ended reasoning about what to do next.

3. **Time budgets per step.** Each step has a max time. If repo-analyzer takes >1 min, skip and use defaults. This prevents any single step from blowing the cycle time.

4. **One issue per cycle.** Never try to batch multiple issues. Finish one, commit, report, then self-wake for the next.

5. **Follow-ups take priority.** Responding to PR reviews is higher priority than new work — it progresses existing PRs toward merge.

---

## 5. Updated openclaw.json

```json5
{
  "gateway": {
    "port": 18789,
    "mode": "headless"
  },

  "identity": {
    "name": "ClawOSS",
    "theme": "lobster",
    "github": "BillionClaw",
    "email": "drsparrowhawk@proton.me"
  },

  "agents": {
    "defaults": {
      "workspace": "./workspace",
      "model": {
        "primary": "openrouter/minimax/minimax-m2.5",
        "fallbacks": ["openrouter/minimax/minimax-m2.5"]
      },
      "models": {
        "allowlist": [
          "openrouter/minimax/minimax-m2.5"
        ],
        "aliases": {
          "default": "openrouter/minimax/minimax-m2.5"
        }
      },

      // === THROUGHPUT-CRITICAL CHANGES ===

      "heartbeat": {
        "every": "10m",                        // Was 60m. 10m base interval for safety net.
        "model": "openrouter/minimax/minimax-m2.5",
        "prompt": "Read HEARTBEAT.md. Follow it strictly. Do not infer old tasks. If nothing needs attention, reply HEARTBEAT_OK.",
        "lightContext": true,                  // Only inject HEARTBEAT.md, not full bootstrap. Saves tokens.
        "isolatedSession": false,              // Must run in main session for context continuity.
        "target": "none"                       // No external message delivery. Internal work only.
      },

      "humanDelay": {
        "mode": "off"                          // Was default (natural). Zero artificial delay.
      },

      // === END THROUGHPUT CHANGES ===

      "sandbox": {
        "enabled": true,
        "allowPaths": [
          "/tmp/clawoss-workdir",
          "~/.openclaw/workspace"
        ]
      },
      "compaction": {
        "mode": "auto",
        "targetTokens": 500000,
        "model": "openrouter/minimax/minimax-m2.5",
        "keepRecentTokens": 50000,
        "memoryFlush": true                    // Flush to memory before compacting — preserves state across compactions.
      },
      "subagents": {
        "model": "openrouter/minimax/minimax-m2.5",
        "maxConcurrent": 1,                    // Keep at 1 — single session architecture. Only used for oss-review.
        "runTimeoutSeconds": 120               // Was 300. Review subagent must finish in 2 min or abort.
      },
      "imageMaxDimensionPx": 1024
    },
    "list": [
      {
        "id": "clawoss",
        "model": {
          "primary": "openrouter/minimax/minimax-m2.5"
        },
        "tools": {
          "profile": "coding"
        }
      }
    ]
  },

  "skills": {
    "allowBundled": ["github", "agent-tools"],
    "load": {
      "extraDirs": [],
      "watch": true,
      "watchDebounceMs": 500
    },
    "entries": {
      "github": {
        "enabled": true
      }
    }
  },

  "tools": {
    "profile": "coding",
    "allow": [
      "exec",
      "memory_search",
      "memory_get",
      "memory_write",
      "web_fetch",
      "web_search"
    ],
    "deny": [
      "imsg",
      "wacli",
      "discord",
      "spotify-player",
      "openhue",
      "sonos",
      "camsnap",
      "peekaboo"
    ]
  },

  "messages": {
    "queue": {
      "mode": "collect",                       // Batch system events; don't interrupt active work.
      "debounceMs": 500,                       // Short debounce — we want fast reaction to self-wake events.
      "cap": 10
    }
  },

  "logging": {
    "level": "info",
    "file": "/tmp/openclaw/clawoss-{date}.log",
    "consoleLevel": "warn",
    "consoleStyle": "compact",
    "redactSensitive": true
  },

  "session": {
    "scope": "agent",
    "resetTriggers": {
      "daily": "04:00"
    },
    "maintenance": {
      "mode": "enforce",
      "pruneAfter": "7d",
      "maxEntries": 100
    }
  },

  "diagnostics": {
    "enabled": true,
    "otel": {
      "endpoint": "https://clawoss-dashboard.vercel.app/api/otel",
      "logs": true
    }
  }
}
```

### Key Changes Summary

| Setting | Before | After | Why |
|---------|--------|-------|-----|
| `heartbeat.every` | `"60m"` | `"10m"` | 6x faster base cycle; self-wake makes it near-continuous |
| `heartbeat.lightContext` | not set | `true` | Only loads HEARTBEAT.md, saving ~5-10K tokens per heartbeat |
| `heartbeat.target` | not set | `"none"` | No external delivery; all work is internal |
| `humanDelay.mode` | default (`"natural"`) | `"off"` | Eliminates 800-2500ms artificial delay per response block |
| `subagents.runTimeoutSeconds` | `300` | `120` | Review subagent must be fast or fail |
| `messages.queue` | not set | `collect` with 500ms debounce | Fast reaction to self-wake events |

---

## 6. Updated cron-jobs.json

The cron system shifts from "do the work" to "prepare the work queue." The heartbeat loop does the actual execution.

```json
[
  {
    "id": "work-queue-refill",
    "name": "Refill work queue",
    "schedule": { "kind": "cron", "expr": "0 */2 * * *" },
    "sessionTarget": "isolated",
    "wakeMode": "next-heartbeat",
    "payload": {
      "kind": "agentTurn",
      "message": "Run oss-discover skill in batch mode. Search target repos for 10-15 candidate issues. Score by feasibility and impact. Write top 10 to memory/work-queue.md. Do NOT start implementing — just discover and queue.",
      "lightContext": true
    },
    "delivery": { "mode": "none" }
  },
  {
    "id": "pr-followup-scan",
    "name": "Scan PRs for reviews",
    "schedule": { "kind": "cron", "expr": "*/30 * * * *" },
    "sessionTarget": "main",
    "wakeMode": "now",
    "payload": {
      "kind": "systemEvent",
      "message": "PR follow-up check: run gh pr list --author @me --state open. If any have new review comments, add to top of work-queue.md with priority: urgent."
    }
  },
  {
    "id": "daily-report",
    "name": "Daily summary report",
    "schedule": { "kind": "cron", "expr": "0 23 * * *" },
    "sessionTarget": "isolated",
    "wakeMode": "next-heartbeat",
    "payload": {
      "kind": "agentTurn",
      "message": "Compile daily report: PRs submitted, merged, rejected. Commits count. Repos contributed to. Token spend estimate. Send to dashboard-reporter skill.",
      "lightContext": true
    },
    "delivery": { "mode": "none" }
  },
  {
    "id": "weekly-retrospective",
    "name": "Weekly strategy review",
    "schedule": { "kind": "cron", "expr": "0 9 * * 1" },
    "sessionTarget": "isolated",
    "wakeMode": "next-heartbeat",
    "payload": {
      "kind": "agentTurn",
      "message": "Analyze the past week: acceptance rate per repo, rejection patterns, average cycle time. Update MEMORY.md with strategy adjustments. Prune stale entries from work-queue.md.",
      "lightContext": true
    },
    "delivery": { "mode": "none" }
  },
  {
    "id": "memory-cleanup",
    "name": "Memory hygiene",
    "schedule": { "kind": "cron", "expr": "0 3 * * 0" },
    "sessionTarget": "isolated",
    "wakeMode": "next-heartbeat",
    "payload": {
      "kind": "agentTurn",
      "message": "Review memory files older than 14 days. Archive patterns to MEMORY.md. Remove stale daily logs and expired work queue items.",
      "lightContext": true
    },
    "delivery": { "mode": "none" }
  }
]
```

### Key Changes from Previous Cron Config

| Change | Before | After | Why |
|--------|--------|-------|-----|
| Discovery | Once daily at 8am | Every 2 hours, isolated | Keep work queue full; agent never starves for work |
| PR follow-up | Every 4 hours, isolated | Every 30 min, main session | Reviews are urgent; faster response = faster merge |
| PR follow-up wake | Next heartbeat | `now` | Immediately wake agent to handle reviews |
| All payloads | Free-text strings | Structured `kind`/`message` | Proper OpenClaw cron-jobs.json format |
| Discovery directive | "Search and write" | "Queue only, don't implement" | Separation of concerns: cron discovers, heartbeat executes |

---

## 7. Pipelining Strategy

### The Problem

Without pipelining, the agent's cycle is strictly serial:

```
Discover → Implement → Submit → Wait for review → (idle) → Next task
```

The "wait for review" gap can be hours or days. The agent should not block on reviews.

### The Pipeline

The agent maintains a **multi-stage pipeline** tracked in `memory/pipeline-state.md`:

```markdown
# Pipeline State

## Active PR (awaiting review)
- repo: facebook/react
- pr: #12345
- submitted: 2026-03-16T10:30:00Z
- status: awaiting_review

## Active PR (awaiting review)
- repo: vercel/next.js
- pr: #67890
- submitted: 2026-03-16T11:15:00Z
- status: ci_running

## Current Work
- repo: none (picking from queue)

## Work Queue (from cron discovery)
- [ ] expressjs/express#8901 - Fix typo in middleware docs
- [ ] prisma/prisma#4567 - Add missing test for schema validation
- [ ] vitejs/vite#2345 - Update deprecated API usage in plugin
```

### Pipeline Rules

1. **Never block on reviews.** After submitting a PR, immediately move to the next task. PR follow-ups are handled reactively when the cron scan detects new review comments.

2. **Max 5 active PRs at any time.** Beyond 5, the agent stops submitting new PRs and focuses on follow-ups. This prevents overwhelming maintainers and avoids spreading attention too thin.

3. **Follow-ups take priority over new work.** When the 30-minute PR scan detects review comments, the follow-up item goes to the TOP of the work queue with `priority: urgent`. The next heartbeat cycle handles it first.

4. **Track per-repo cadence.** The existing anti-spam rule (max 3 PRs/repo/day, min 30-min gap) is enforced by checking pipeline-state.md before starting new work on a repo.

5. **Stale PR cleanup.** If a PR has been open >7 days with no review activity, close it with a polite comment and remove from pipeline. Don't let stale PRs accumulate.

### Pipeline Flow Diagram

```
                    ┌─────────────────┐
                    │  Work Queue     │ ← Filled by cron (every 2hr)
                    │  (10-15 items)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Pick Top Item  │ ← Heartbeat cycle picks one
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Implement      │ ← 3-8 min
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Quality Gate   │ ← 1-2 min (safety-checker + oss-review)
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Submit PR      │ ← Add to Active PRs in pipeline-state.md
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Self-Wake      │ ← Immediately start next cycle
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Next Item...   │ ← Continuous loop
                    └─────────────────┘

    Meanwhile, independently:

    ┌──────────────────────────┐
    │  PR Follow-up Cron       │ ← Every 30 min
    │  Scans for review        │
    │  comments, injects       │
    │  urgent items into queue │
    └──────────────────────────┘
```

---

## 8. Fast Quality Gates

Quality gates must be fast (< 2 minutes total) but effective. No gate should require a separate model invocation unless absolutely necessary.

### Gate 1: Pre-Commit Checks (< 30 seconds)

Run by `safety-checker` skill. All checks are mechanical (no LLM needed):

```bash
# Diff size check
LINES=$(git diff --stat HEAD | tail -1 | awk '{print $4}')
[ "$LINES" -gt 200 ] && echo "FAIL: diff too large ($LINES lines)" && exit 1

# File count check
FILES=$(git diff --name-only HEAD | wc -l)
[ "$FILES" -gt 5 ] && echo "FAIL: too many files changed ($FILES)" && exit 1

# Secret scan
git diff HEAD | grep -iE '(api_key|secret|password|token|credential)' && echo "WARN: possible secret" && exit 1

# No force-push or main branch
BRANCH=$(git branch --show-current)
[ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ] && echo "FAIL: on protected branch" && exit 1
```

### Gate 2: Repo Test Suite (1-3 minutes)

Run the target repo's test suite. This is the most time-variable gate.

**Speed optimization:** Only run tests related to changed files when possible:
- If the repo has a test runner that supports `--related` or `--changed` flags (Jest, pytest), use it
- If not, run the full suite but set a 3-minute timeout
- If tests timeout, the PR description notes "full test suite not run; please verify in CI"

### Gate 3: Lightweight LLM Self-Check (< 1 minute)

Instead of spawning a full review subagent (expensive, slow), run a single-turn self-check within the main session:

```
Review your diff against the issue description. Answer these 5 questions:
1. Does the change address the stated issue? (yes/no)
2. Are there any files changed that are unrelated to the issue? (yes/no)
3. Is the change minimal and focused? (yes/no)
4. Does the PR description explain why, not just what? (yes/no)
5. Does the code match the repo's existing style? (yes/no)

If any answer is "no", fix it before submitting. If 3+ are "no", abandon this task.
```

This is cheaper than a subagent and catches the most common quality issues.

### Gate 4: Full Subagent Review (Optional, for complex PRs only)

Only triggered when:
- Diff > 100 lines
- Changes span 3+ files
- The issue is labeled as anything other than "good-first-issue" or "docs"

When triggered, the `oss-review` subagent gets a 2-minute timeout (`runTimeoutSeconds: 120`). If it doesn't finish in time, the lightweight self-check result stands.

### Total Gate Time Budget

| Gate | Time | When |
|------|------|------|
| Pre-commit mechanical checks | < 30s | Always |
| Repo test suite | 1-3 min | Always |
| Lightweight self-check | < 1 min | Always |
| Full subagent review | 1-2 min | Complex PRs only |
| **Total (simple PR)** | **2-4 min** | |
| **Total (complex PR)** | **3-6 min** | |

---

## 9. Latency Optimizations

Every millisecond matters when targeting 12-30 minute cycles. These optimizations reduce per-turn overhead.

### 9.1 Disable Human Delay

```json5
"humanDelay": { "mode": "off" }
```

Saves 800-2500ms per response block. Over a 10-turn work cycle, this saves 8-25 seconds.

### 9.2 Reduce WebSocket Throttle

Set before starting the gateway:

```bash
export OPENCLAW_WS_DELTA_THROTTLE_MS=20
```

Reduces token delivery delay from 150ms to 20ms. Primarily affects streaming response display but can impact total turn time.

### 9.3 Light Context for Heartbeats

```json5
"heartbeat": { "lightContext": true }
```

Only injects `HEARTBEAT.md` into the context for heartbeat runs, not the full bootstrap set (AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, BOOTSTRAP.md). Saves ~5-10K input tokens per heartbeat.

**Trade-off:** The agent won't have AGENTS.md instructions during heartbeat runs. The HEARTBEAT.md must be self-contained with all necessary directives. This is why we put the full work loop checklist in HEARTBEAT.md rather than relying on AGENTS.md.

### 9.4 Minimize Thinking Mode

For Minimax M2.5 via OpenRouter, extended thinking/chain-of-thought burns extra tokens and time. If the model supports thinking level configuration:

```json5
"thinkingDefault": "minimal"
```

Saves approximately 1-2 seconds per turn based on latency benchmarks.

### 9.5 Aggressive Prompt Caching

OpenClaw v2026.2.0+ preserves cache between turns (prunes context only after 5 minutes idle). The self-wake architecture naturally keeps the session active, maximizing cache hits. No configuration needed — this happens automatically as long as turns are < 5 minutes apart.

### 9.6 Work Queue Prefetch

The 2-hour discovery cron prefills `memory/work-queue.md`. When the heartbeat fires, the agent doesn't need to search for work — it reads from the queue. This saves 1-3 minutes per cycle that would otherwise be spent on discovery.

### 9.7 Repo Convention Caching

After first visiting a repo, the `repo-analyzer` skill writes conventions to `memory/repos/<repo-slug>.md`:

```markdown
# vercel/next.js
- test_framework: jest
- lint: eslint + prettier
- commit_style: conventional
- pr_template: yes (.github/PULL_REQUEST_TEMPLATE.md)
- contributing_notes: must sign CLA
- last_updated: 2026-03-16
```

Subsequent visits skip the analyzer, saving 1-2 minutes.

---

## 10. Realistic Throughput Expectations

### Honest Projections with Minimax M2.5

**Minimax M2.5 characteristics:**
- Fast inference via OpenRouter (2-8s per turn)
- Lower cost than Claude Opus/Sonnet
- Good at straightforward code tasks
- Less capable at complex architectural reasoning
- Unknown context window limits through OpenRouter (likely 128K-256K)

### Throughput by Task Type

| Task Type | Cycle Time | Commits/Hour | Quality Risk |
|-----------|-----------|--------------|--------------|
| Documentation fixes | 8-12 min | 4-5 | Low |
| Dependency updates (minor) | 10-15 min | 3-4 | Low |
| Test additions | 12-18 min | 2-3 | Medium |
| Simple bug fixes | 15-25 min | 2-3 | Medium |
| Small refactors | 20-30 min | 1-2 | High |
| Feature additions | 25-40 min | 1-2 | High |

### Blended Throughput Projection

Assuming a realistic task mix (40% docs/deps, 30% tests/simple bugs, 20% small fixes, 10% features):

| Metric | Pessimistic | Realistic | Optimistic |
|--------|-------------|-----------|------------|
| Commits/hour (burst) | 2 | 3-4 | 5 |
| Commits/hour (sustained 8hr) | 1.5 | 2-3 | 4 |
| Commits/day (24hr) | 20-30 | 35-50 | 60-80 |
| PR merge rate | 25-35% | 40-55% | 60-70% |
| Merged PRs/day | 5-10 | 14-27 | 36-56 |

### Cost Projections

| Component | Daily Cost | Monthly Cost |
|-----------|-----------|--------------|
| Heartbeat overhead (10m, lightContext) | $2-4 | $60-120 |
| Work execution (35-50 cycles/day) | $15-30 | $450-900 |
| Discovery cron (12x/day) | $1-3 | $30-90 |
| PR follow-up cron (48x/day) | $2-5 | $60-150 |
| Review subagent (10% of PRs) | $1-3 | $30-90 |
| **Total** | **$21-45** | **$630-1,350** |

*Note: Minimax M2.5 pricing through OpenRouter is significantly cheaper than Claude Opus/Sonnet, which makes high-throughput operation viable. Actual costs depend on OpenRouter pricing tiers and token consumption patterns.*

### The Quality-Throughput Trade-off

**Pushing for 5 commits/hour** means:
- Only documentation and trivial fixes
- Minimal review time
- Higher rejection rate
- Risk of being perceived as spam

**Settling for 2-3 commits/hour** means:
- Mix of docs, tests, and real bug fixes
- Proper quality gates
- Higher merge rate
- Better reputation with maintainers

**Recommendation:** Target **2-3 commits/hour sustained** with occasional bursts to 5 during documentation-heavy periods. Quality over quantity — 2 merged PRs are worth more than 5 rejected ones.

---

## Appendix A: Updated HEARTBEAT.md (Full Version)

This replaces `/workspace/HEARTBEAT.md`:

```markdown
# Heartbeat — Fast Autonomous Loop

On each heartbeat, execute this checklist strictly and sequentially.

## 0. Circuit Breaker Check
Read memory/wake-state.md. If any condition is true, reply HEARTBEAT_OK:
- consecutive_wakes >= 8
- errors_this_hour >= 2
- commits_this_hour >= 6
If hourly_reset is stale (>1 hour ago), reset all hourly counters.

## 1. PR Follow-ups (Priority: Urgent)
Run: gh pr list --author @me --state open --json number,title,reviewDecision,statusCheckRollup,url
- If any PR has new review comments → run oss-followup for that PR. Then go to step 4.
- If any PR has failing CI that we caused → investigate and fix. Then go to step 4.
- Otherwise continue.

## 2. Pick Work
Check memory/work-queue.md:
- If items with priority: urgent exist → pick first urgent item.
- If normal items exist → pick top item.
- If queue is empty → run oss-discover (fast: 3 repos, 5 issues max). If still nothing, reply HEARTBEAT_OK.

## 3. Execute
For the selected issue, run in sequence:
1. oss-triage: Confirm still open. If closed/assigned, remove from queue, go to step 2.
2. repo-analyzer: Only if repo not in memory/repos/. Otherwise skip.
3. oss-implement: Write the fix. Max 200 lines changed, max 5 files.
4. safety-checker: Diff size, secrets scan, branch check. If FAIL, abandon and log.
5. oss-review: Quick self-check (5 questions). If 3+ fail, abandon and log.
6. oss-submit: Commit, push, create PR.

## 4. Report & Loop
Run dashboard-reporter with cycle results.
Update memory/wake-state.md: increment commits_this_hour, consecutive_wakes.
Update memory/pipeline-state.md with new PR if submitted.
Remove completed item from memory/work-queue.md.

If circuit breakers OK and work remains:
  exec: openclaw system event --text "Cycle done, continuing" --mode now

Otherwise: HEARTBEAT_OK
```

---

## Appendix B: New Memory Files

### memory/wake-state.md

```markdown
# Wake State
- consecutive_wakes: 0
- last_wake: 2026-03-16T00:00:00Z
- commits_this_hour: 0
- errors_this_hour: 0
- hourly_reset: 2026-03-16T00:00:00Z
```

### memory/work-queue.md

```markdown
# Work Queue
<!-- Populated by work-queue-refill cron job. Consumed by heartbeat loop. -->
<!-- Format: priority | repo | issue | title | complexity | discovered -->

- [ ] normal | expressjs/express#8901 | Fix typo in middleware docs | trivial | 2026-03-16
- [ ] normal | prisma/prisma#4567 | Add test for schema validation | simple | 2026-03-16
```

### memory/pipeline-state.md

```markdown
# Pipeline State
<!-- Tracks active PRs and current work. Max 5 active PRs. -->

## Active PRs
<!-- None yet -->

## Stats Today
- submitted: 0
- merged: 0
- rejected: 0
- abandoned: 0
```

---

## Appendix C: Environment Setup Script Addition

Add to the gateway startup script:

```bash
# Throughput optimizations
export OPENCLAW_WS_DELTA_THROTTLE_MS=20  # Reduce WebSocket token delivery delay

# Start gateway
openclaw gateway start --config ./config/openclaw.json
```

---

## Sources

- [OpenClaw Heartbeat Documentation](https://docs.openclaw.ai/gateway/heartbeat)
- [OpenClaw Configuration Reference](https://moltfounders.com/openclaw-configuration)
- [Reduce OpenClaw Latency: 5 Proven Optimizations](https://markaicode.com/reduce-openclaw-latency-5-optimization-tips/)
- [OpenClaw Ralph Loop: Autonomous Agent Loop Explained](https://clawtank.dev/blog/openclaw-ralph-loop-guide)
- [How Does OpenClaw Work? Inside the Agent Loop](https://tomaszs2.medium.com/how-does-openclaw-work-inside-the-agent-loop-that-powers-200-000-github-stars-e61db2bbfcbb)
- [OpenClaw v2026.2.25 Release Notes](https://globalclaw.github.io/globalclaw-blog/posts/2026-02-26-openclaw-2026-2-25.html)
- [OpenClaw DeepWiki](https://deepwiki.com/openclaw/openclaw)
- [How I Built a Deterministic Multi-Agent Dev Pipeline Inside OpenClaw](https://dev.to/ggondim/how-i-built-a-deterministic-multi-agent-dev-pipeline-inside-openclaw-and-contributed-a-missing-4ool)
