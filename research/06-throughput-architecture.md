# Throughput Architecture: Maximum Quality PRs Per Day

> Designing the autonomous loop, configuration, and pipelining strategy to achieve sustained high-quality OSS contributions from a single OpenClaw agent running Minimax M2.5 via OpenRouter.
>
> **Primary metric:** 3-5 merged PRs/day with >70% acceptance rate at <$2/merged PR.
> **Secondary metric:** Fastest possible cycle time per task without sacrificing quality.

---

## Table of Contents

1. [Metric Reframing: Why Not "Commits Per Hour"](#1-metric-reframing)
2. [M2.5 Capability Assessment](#2-m25-capability-assessment)
3. [Optimal Heartbeat Interval](#3-optimal-heartbeat-interval)
4. [The Self-Wake Architecture](#4-the-self-wake-architecture)
5. [Context Pollution: Session Strategy](#5-context-pollution-session-strategy)
6. [Issue Curation Layer](#6-issue-curation-layer)
7. [Redesigned HEARTBEAT.md](#7-redesigned-heartbeatmd)
8. [Updated openclaw.json](#8-updated-openclawjson)
9. [Updated cron-jobs.json](#9-updated-cron-jobsjson)
10. [Async CI & Pipelining Strategy](#10-async-ci--pipelining-strategy)
11. [Fast Quality Gates](#11-fast-quality-gates)
12. [Latency Optimizations](#12-latency-optimizations)
13. [Realistic Throughput Expectations](#13-realistic-throughput-expectations)

---

## 1. Metric Reframing

### Why "Commits Per Hour" Is the Wrong Target

The throughput critic's analysis (see `07-throughput-critique.md`) identifies a fundamental problem: optimizing for commits/hour incentivizes trivial work, damages repository reputation, and measures output instead of outcome.

**What happens when you optimize for 5 commits/hour:**
- Agent gravitates toward README typos, whitespace fixes, single-line changes
- These inflate commit counts but contribute minimal value
- Maintainers get annoyed reviewing trivial PRs and may block the bot
- One bad batch of AI slop PRs = permanent ban from repositories

**What matters to OSS maintainers:**
- Does this PR solve a real problem?
- Is it well-crafted and minimal?
- Does the contributor respond to feedback?

### The Right Metrics

| Metric | Target | Why |
|--------|--------|-----|
| **Merged PRs per day** | 3-5 (week 3+) | Measures actual impact |
| **PR acceptance rate** | >70% | Measures quality |
| **Mean time to merge** | <48 hours | Measures relevance |
| **Cost per merged PR** | <$2 | Measures efficiency (M2.5 makes this possible) |
| **Unique repos per week** | 5-10 | Measures breadth |
| Issues resolved per day | 2-4 | Measures real value |

### Ramp Schedule

| Phase | Timeline | Target |
|-------|----------|--------|
| Calibration | Week 1-2 | 1-2 merged PRs/day, tuning acceptance rate |
| Ramp | Week 3-4 | 3-5 merged PRs/day on curated repos |
| Steady state | Month 2+ | 5-10 merged PRs/day, >70% acceptance rate |
| Aspirational | Month 3+ | 10-15 merged PRs/day with multi-repo pipelining |

### How This Relates to Cycle Time

Even with merged-PRs-per-day as the primary metric, cycle time still matters. Faster cycles mean more PR attempts per day, which — given a consistent acceptance rate — means more merges. The architecture below optimizes cycle time while never sacrificing quality for speed.

**Target cycle time: 15-30 minutes per task** (including quality gates and CI). This enables 2-4 PR attempts per hour during active work, yielding the 3-5 merged PRs/day target at a 50-65% real-world success rate.

---

## 2. M2.5 Capability Assessment

### The Model Is Not the Bottleneck

Minimax M2.5 is genuinely frontier-tier for coding tasks:

| Benchmark | M2.5 | Claude Sonnet 4.6 | Claude Opus 4.6 |
|-----------|-------|--------------------|------------------|
| SWE-bench Verified | **80.2%** | 79.6% | 80.8% |
| Multi-SWE-bench | **51.3%** (best) | -- | -- |

**Architecture advantage:** 230B total parameters, only 10B active (MoE). Frontier capability at 11x cheaper input tokens and 16x cheaper output tokens than Claude Sonnet.

**Inference speed:**
- Standard: ~45-50 tokens/second
- Lightning variant: ~100 tokens/second
- TTFT: 2.41s (MiniMax API), 0.49s (Together.ai)
- A 2000-token response takes 20-40 seconds

### Real-World Agentic Performance

**Critical distinction:** SWE-bench measures isolated task completion with curated issues and pre-staged repos. Real-world agentic operation is harder:

| Scenario | Expected Success Rate |
|----------|-----------------------|
| Well-scoped issues (good-first-issue, docs) | 60-75% |
| Medium complexity (simple bug fixes, test additions) | 40-55% |
| Complex or ambiguous issues | 15-30% |
| **Blended (curated queue)** | **50-65%** |

The 50-65% blended rate is achievable because the issue curation layer (Section 6) pre-filters for solvability, heavily weighting the queue toward higher-success-rate tasks.

### Cost Per Task (via OpenRouter)

| Scenario | Input Tokens | Output Tokens | Cost |
|----------|-------------|---------------|------|
| Trivial fix (1-2 turns) | 100K | 20K | $0.05 |
| Small fix (3-5 turns) | 300K | 75K | $0.17 |
| Medium fix (5-10 turns) | 600K | 150K | $0.33 |
| Complex fix (10+ turns) | 1M+ | 250K+ | $0.55+ |

**At 50-65% success rate, cost per merged PR: $0.30-1.10.** This is well under the $2 target.

---

## 3. Optimal Heartbeat Interval

### The Trade-off

| Interval | Heartbeats/Day | Idle Cost/Day | Response Latency |
|----------|---------------|---------------|------------------|
| 5 min | 288 | $3-6 | 0-5 min |
| 10 min | 144 | $1.50-3 | 0-10 min |
| 15 min | 96 | $1-2 | 0-15 min |
| 60 min (current) | 24 | $0.25-0.50 | 0-60 min |

### Recommendation: 10-Minute Heartbeat + Self-Wake

The optimal architecture is a **hybrid approach**:

1. **Base heartbeat: `every: "10m"`** — safety net ensuring the agent wakes at least every 10 minutes to check for new work or PR reviews
2. **Self-wake via system events** — after completing a task, the agent triggers `openclaw system event --mode now` for an immediate next cycle
3. **Net effect:** Continuous throughput during active work; cost-efficient idle when no work is queued

This was validated against the critic's concern about idle cost: at $1.50-3/day for heartbeat overhead with M2.5, this is negligible compared to work execution costs ($5-15/day).

---

## 4. The Self-Wake Architecture

### How It Works

OpenClaw's `system event --mode now` triggers an immediate heartbeat run. The agent invokes this at the end of each work cycle to create a **continuous autonomous loop**.

```
[Heartbeat fires] --> [Agent reads HEARTBEAT.md] --> [Finds work] --> [Implements] --> [Submits PR] -->
    [Reports to dashboard] --> [exec: openclaw system event --mode now] --> [Immediate next heartbeat] -->
    [Agent reads HEARTBEAT.md] --> [Finds work] --> ... (loop continues)
```

When there's no more work:
```
[Heartbeat fires] --> [Agent reads HEARTBEAT.md] --> [No work found] --> [HEARTBEAT_OK] -->
    [Sleeps until next 10-min heartbeat]
```

### Circuit Breakers (Preventing Runaway Loops)

| Breaker | Threshold | Action |
|---------|-----------|--------|
| Max consecutive self-wakes | 8 | Force cooldown; wait for next scheduled heartbeat |
| Errors this hour | 2 consecutive failures | Pause self-wake; wait for next scheduled heartbeat |
| PRs submitted this hour | 6 | Pause new submissions; focus on follow-ups only |
| PRs per repo per day | 2-3 | Skip that repo; pick from different repos |
| GitHub API rate limit | >80% consumed | Pause all work; wait for rate limit reset |
| Work queue empty | 0 items | HEARTBEAT_OK; no self-wake |

### Self-Wake State Tracking

Tracked in `memory/wake-state.md`:

```markdown
# Wake State
- consecutive_wakes: 3
- last_wake: 2026-03-16T14:32:00Z
- commits_this_hour: 2
- errors_this_hour: 0
- hourly_reset: 2026-03-16T14:00:00Z
- prs_today_by_repo:
  - expressjs/express: 1
  - prisma/prisma: 0
```

On scheduled (non-self-wake) heartbeat: reset `consecutive_wakes` to 0.
On hourly boundary: reset `commits_this_hour`, `errors_this_hour`.
On daily reset (04:00): reset `prs_today_by_repo`.

---

## 5. Context Pollution: Two-Layer Session Architecture

### The Problem

The critic correctly identifies that **context pollution degrades quality after 3-4 tasks** in a single session:

- Residual context from task N bleeds into task N+1
- The model may reference files from the wrong repository
- Error patterns from one task bias approaches to the next
- M2.5's 196K context window fills quickly with multi-repo implementation history

### The Solution: Orchestrator + Sub-Agent Sessions

The key insight (from the critic's follow-up research): **the main session is the orchestrator; sub-agents are the disposable workers.** This satisfies both the "single agent" requirement AND the "fresh context per task" requirement.

**Layer 1: Main Session (Orchestrator)**

The main session runs the heartbeat loop and handles:
- Reading HEARTBEAT.md and executing the checklist
- Checking PR status and queuing follow-ups
- Picking work from the queue
- Reporting to the dashboard
- Self-wake triggers
- State tracking (memory files)

The main session **never touches implementation code directly.** It stays clean, lightweight, and focused on orchestration. Context pollution from coding tasks never enters this session.

**Layer 2: Sub-Agent Sessions (Implementation Workers)**

Each coding task is delegated to a sub-agent via `sessions_spawn`:
- Fresh context per task -- zero cross-task pollution
- The sub-agent receives ONLY: the issue description, repo conventions (from memory), and the task directive
- Sub-agent runs with `maxConcurrent: 1` (serialized) -- no parallel session sprawl
- Sub-agent has full coding tools but no session management tools (can't spawn further sub-agents)
- On completion, the sub-agent posts a summary back to the main session (the "announce step")
- Sub-agent session is auto-archived after completion

**How it flows:**

```
Main Session (orchestrator):
  [Heartbeat] --> [Pick work from queue] --> [sessions_spawn: "Implement fix for issue #123"]
       |                                              |
       |                                    Sub-Agent Session (worker):
       |                                      [Fresh context]
       |                                      [Clone repo / checkout branch]
       |                                      [Read issue + CONTRIBUTING.md]
       |                                      [Implement fix]
       |                                      [Run safety-checker]
       |                                      [Run self-review]
       |                                      [Run local tests]
       |                                      [Commit + push + create PR]
       |                                      [Announce result back to main]
       |                                              |
       | <--- [Receive announce: "PR #456 submitted"] |
       |                                              |
  [Update pipeline-state.md] --> [Self-wake] --> [Next task...]
```

### Why This Architecture Works

1. **Zero context pollution.** Each implementation runs in isolation. The main session only sees the announce summary (status, PR URL, stats), not the full coding context.

2. **Maintains "single agent" identity.** There is one `clawoss` agent with one persistent main session. Sub-agents are internal implementation details, not separate agents. They use the same model, same identity, same GitHub credentials.

3. **Self-wake chain preserved.** System events target the main session. The orchestrator handles all self-wake logic. Sub-agent completion triggers the announce step, which naturally flows back to the main session for the next cycle.

4. **`sessions_spawn` is non-blocking.** The main session can fire off a sub-agent and immediately handle other orchestration tasks (checking PR status, processing follow-ups) while the sub-agent works. However, with `maxConcurrent: 1`, we serialize implementation to avoid resource contention.

5. **Cost-neutral vs. main-session implementation.** The sub-agent uses the same model (M2.5) at the same cost. The overhead is only the announce step (~100 tokens). The savings from avoiding context pollution (fewer retries, higher success rate) more than compensate.

### Configuration Requirements

**Critical:** The clawoss agent needs `"default": true` in the agent list config. Without this flag, cron jobs and heartbeats targeting the main session will be rejected by OpenClaw.

```json5
"list": [
  {
    "id": "clawoss",
    "default": true,                    // REQUIRED for main session routing
    "model": { "primary": "openrouter/minimax/minimax-m2.5" },
    "tools": { "profile": "coding" }
  }
]
```

Sub-agent configuration in defaults:
```json5
"subagents": {
  "model": "openrouter/minimax/minimax-m2.5",
  "maxConcurrent": 1,                  // Serialized: one implementation at a time
  "runTimeoutSeconds": 600             // 10 min per task (was 120 for review-only; now full implementation)
}
```

### Fallback: What If Sub-Agent Fails?

If the sub-agent times out or errors:
- The announce step reports the failure to the main session
- The main session logs the failure in `memory/wake-state.md` (increment `errors_this_hour`)
- The issue is marked as failed in `memory/work-queue.md` with the error reason
- The main session continues to the next task via self-wake

### Additional Safeguards

- **Daily session reset at 04:00** -- already configured; hard reset for main session
- **Memory-based state** -- all persistent state lives in memory files, not session history
- **Sub-agent auto-archive** -- sub-agent sessions are archived after 60 minutes (default `archiveAfterMinutes`), preventing disk bloat
- **Circuit breakers** -- still enforced at the orchestrator level (main session)

---

## 6. Issue Curation Layer

### Why This Is Critical

The critic identifies this as a must-have: **pre-filter issues for solvability before attempting them.** Without curation, the agent wastes cycles on issues that are:
- Too complex (multi-file architectural changes)
- Too ambiguous (no clear reproduction steps)
- Already being worked on
- In hostile repos (anti-AI-PR policies)
- Requiring domain expertise the model lacks

### Three-Stage Curation Pipeline

**Stage 1: Discovery Cron (every 2 hours, isolated session)**

Searches target repos for candidate issues. Filters:
- Labels: `good-first-issue`, `help-wanted`, `bug`, `documentation`, `tests`
- NOT labeled: `wontfix`, `duplicate`, `question`, `discussion`
- No assignee (not already claimed)
- Created within last 30 days (not stale)
- Repo has merged an external PR in the last 30 days (is active and receptive)

**Stage 2: Solvability Scoring (part of discovery)**

Each candidate issue gets a score (1-10):

| Factor | Points |
|--------|--------|
| Has clear reproduction steps | +2 |
| Single file likely affected | +2 |
| Has related test file | +1 |
| Labeled `good-first-issue` | +2 |
| Repo has CONTRIBUTING.md | +1 |
| Repo has merged AI PRs before | +2 |
| Issue has >3 comments (complex discussion) | -2 |
| Issue references multiple files/components | -2 |
| Repo has anti-AI-PR policy | -10 (auto-reject) |

Issues scoring >= 5 go into the work queue. Issues scoring >= 7 are prioritized.

**Stage 3: Triage Confirmation (at execution time)**

Before starting implementation, the agent runs `oss-triage`:
- Confirms issue is still open and unassigned
- Re-reads issue description for any updates
- Checks if the issue is reproducible with a quick test
- Estimates implementation complexity (< 2 minutes)
- If complexity is too high or issue changed, skip and pick next from queue

### Maintainer Relationship Tracking

Stored in `memory/repos/<repo-slug>.md`:

```markdown
# expressjs/express
- receptiveness: high (3/4 PRs merged)
- avg_review_time: 18 hours
- preferred_pr_style: small, focused, with tests
- anti_ai_policy: none detected
- our_history:
  - PR #8901: merged (docs fix, 2026-03-15)
  - PR #8920: merged (test addition, 2026-03-16)
  - PR #8935: rejected (style mismatch, 2026-03-17)
- last_updated: 2026-03-17
```

This data feeds back into solvability scoring: repos with higher receptiveness get higher-priority issues in the queue.

---

## 7. Redesigned HEARTBEAT.md

The HEARTBEAT.md drives a tight autonomous loop. Because `lightContext: true` strips all bootstrap files except HEARTBEAT.md, this file must be self-contained with all operational directives.

```markdown
# Heartbeat -- Autonomous Work Loop

Execute this checklist strictly. One task per cycle. Quality over speed.

## Rules (always in effect -- AGENTS.md is NOT loaded in lightContext mode)

### Safety (non-negotiable)
- NEVER push to main/master or default branches directly
- NEVER force-push to any branch
- NEVER commit secrets, credentials, API keys, or .env files
- NEVER modify CI/CD pipelines in contributed repos without explicit approval
- GitHub token scope must be public_repo (least privilege)

### PR Limits
- Max 200 lines changed, max 5 files per PR
- Max 2-3 PRs per repo per day, 30-min gap between same-repo PRs
- Max 10 PRs total per day across all repos
- Max 5 active PRs across all repos at any time
- Max 3 follow-up revision rounds per PR -- after 3, politely disengage
- Do NOT submit trivial PRs (whitespace-only, comment-only unless meaningful)
- ALWAYS use branch naming: clawoss/<type>/<description>

### Quality (non-negotiable)
- Read CONTRIBUTING.md before first PR to any repo
- Every code change must include relevant tests
- Every PR description must explain the "why" not just the "what"
- Commit messages: Conventional Commits format -- type(scope): description
- Code style must match the target repo's existing conventions
- No AI-slop: no unnecessary comments, no over-engineering, no "I" statements
- If tests fail after 2 fix attempts, abandon task
- If self-review fails 3+ checks, abandon task

### Failure Handling
- If a contribution is rejected, log reason and adapt
- If repo's CI is broken (not our fault), skip and move to next
- If rate-limited by GitHub API, back off and wait
- Never get stuck in retry loops -- fail fast and move forward

## 0. Circuit Breakers
Read memory/wake-state.md. Reply HEARTBEAT_OK if:
- consecutive_wakes >= 8 (mandatory cooldown)
- errors_this_hour >= 2
- If hourly_reset is stale (>1hr), reset hourly counters first.

## 1. PR Follow-ups (Highest Priority)
Run: gh pr list --author @me --state open --json number,title,reviewDecision,statusCheckRollup,url,updatedAt
- New review comments? --> oss-followup for that PR. Go to step 5.
- CI failing (our fault)? --> fix and push. Go to step 5.
- PR merged? --> Update memory/pipeline-state.md. Continue.
- PR stale >7 days, no review? --> Close with polite comment. Remove from pipeline.

## 2. Merge Staging Files & Pick Work
Merge any new items from memory/work-queue-staging.md and memory/followup-staging.md into memory/work-queue.md, then clear the staging files. (This prevents race conditions with concurrent cron writes.)

Read memory/work-queue.md:
- Urgent items (PR follow-ups) --> pick first urgent.
- Normal items --> pick top item with score >= 5.
- Queue empty --> run oss-discover (fast: 3 repos, 5 issues, score >= 5). If nothing, HEARTBEAT_OK.
Check memory/wake-state.md prs_today_by_repo. If selected repo is at daily limit, skip to next item.

## 3. Triage (in main session, < 2 min)
1. oss-triage: Confirm open, unassigned, estimate complexity.
2. If too complex or closed, remove from queue, go to step 2.
3. repo-analyzer: Only if repo NOT in memory/repos/. Check for anti-AI-PR policy. If hostile, skip permanently. (skip if cached)

## 4. Spawn Implementation Sub-Agent
Use sessions_spawn to delegate the coding task to a fresh sub-agent session:
  task: "Fix <repo>#<issue>: <title>. Repo conventions in memory/repos/<slug>.md.
    1. Clone repo, create branch clawoss/<type>/<desc>.
    2. Implement fix (max 200 lines, max 5 files).
    3. Run safety-checker: diff size, secrets scan, branch check.
    4. Self-review: 5-question check. 3+ NO = abandon.
    5. Run local tests (related tests, 3-min timeout). 2 fix attempts max.
    6. Commit, push, create PR with clear description.
    7. Do NOT wait for remote CI. Submit and report result."
  label: "<repo>#<issue>"
  runTimeoutSeconds: 600

The sub-agent runs in a FRESH context with zero pollution from prior tasks.
Do NOT implement in the main session. Wait for the announce step.

## 5. Handle Sub-Agent Result
When the sub-agent announces back:
- If PR submitted: update memory/pipeline-state.md with new PR.
- If abandoned: log reason in memory/work-queue.md.
- If timeout/error: increment errors_this_hour in wake-state.md.

## 6. Report & Loop
Run dashboard-reporter: log cycle outcome (submitted/abandoned/followup), cost, repo, issue.
Update memory/wake-state.md: increment counters.
Remove completed/abandoned item from memory/work-queue.md.

If circuit breakers OK AND work-queue.md has items AND active PRs < 5:
  exec: openclaw system event --text "Cycle complete" --mode now

Otherwise: HEARTBEAT_OK
```

### Key Design Principles

1. **Two-layer session architecture** — the main session orchestrates (triage, queue management, self-wake); sub-agents implement (coding, testing, PR submission). This provides fresh context per task with zero cross-task pollution.

2. **Rules section replaces AGENTS.md** — because `lightContext: true` strips AGENTS.md, all critical safety rules are embedded directly in HEARTBEAT.md. The sub-agent receives implementation rules via its task prompt.

3. **Async CI** — the sub-agent does NOT wait for GitHub Actions CI. It submits the PR and announces the result. CI failures are caught reactively by the PR follow-up cron (every 30 min). This eliminates the 5-15 minute CI bottleneck identified by the critic.

4. **Issue scoring threshold** — only issues with solvability score >= 5 are attempted. This implements the critic's "issue curation layer" requirement.

5. **Anti-AI-PR policy detection** — repo-analyzer checks for explicit policies against AI PRs. If detected, the repo is permanently skipped.

6. **Sub-agent isolation** — the main session never sees implementation code, diffs, or test output. It only receives the announce summary (status + PR URL). This keeps the orchestrator's context permanently clean.

7. **Staging file pattern for memory race conditions** — the `work-queue-refill` cron (isolated session) and `pr-followup-scan` cron (main session) both write to work queue files. To avoid race conditions between concurrent cron and heartbeat writes, cron jobs write to staging files (`memory/work-queue-staging.md`, `memory/followup-staging.md`) and the heartbeat merges them into `memory/work-queue.md` at the start of each cycle. Only the heartbeat (main session) writes to `work-queue.md`.

---

## 8. Updated openclaw.json

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

      // === THROUGHPUT-CRITICAL SETTINGS ===

      "heartbeat": {
        "every": "10m",                        // Was 60m. 10m base; self-wake makes it near-continuous.
        "model": "openrouter/minimax/minimax-m2.5",
        "prompt": "Read HEARTBEAT.md. Follow it strictly. Do not infer old tasks. If nothing needs attention, reply HEARTBEAT_OK.",
        "lightContext": true,                  // Only inject HEARTBEAT.md. Saves tokens + reduces context pollution.
        "isolatedSession": false,              // Main session for self-wake chain continuity.
        "target": "none"                       // Internal work only; no external delivery.
      },

      "humanDelay": {
        "mode": "off"                          // Was default (natural). Zero artificial delay. Saves 800-2500ms/block.
      },

      // === END THROUGHPUT SETTINGS ===

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
        "memoryFlush": true                    // Flush to memory before compacting.
      },
      "subagents": {
        "model": "openrouter/minimax/minimax-m2.5",
        "maxConcurrent": 1,                    // Serialized: one implementation sub-agent at a time.
        "runTimeoutSeconds": 600               // 10 min per task. Full implementation cycle, not just review.
      },
      "imageMaxDimensionPx": 1024
    },
    "list": [
      {
        "id": "clawoss",
        "default": true,                       // REQUIRED: routes heartbeats + cron to main session.
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
      "debounceMs": 500,                       // Short debounce for fast self-wake reaction.
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

### Changes Summary

| Setting | Before | After | Why |
|---------|--------|-------|-----|
| `heartbeat.every` | `"60m"` | `"10m"` | 6x faster base cycle; self-wake makes continuous |
| `heartbeat.lightContext` | not set | `true` | Saves ~5-10K tokens/heartbeat + reduces context pollution |
| `heartbeat.target` | not set | `"none"` | No external delivery; internal work only |
| `humanDelay.mode` | default | `"off"` | Eliminates 800-2500ms delay per response block |
| `agents.list[].default` | not set | `true` | **Required** for heartbeat/cron routing to main session |
| `subagents.runTimeoutSeconds` | `300` | `600` | Full implementation cycle per sub-agent (was 120 for review-only) |
| `subagents.maxConcurrent` | `1` | `1` (unchanged) | Serialized execution; one task at a time |
| `messages.queue` | not set | `collect`, 500ms debounce | Fast reaction to self-wake events |

---

## 9. Updated cron-jobs.json

The cron system shifts from "do the work" to "prepare the work queue and scan for follow-ups." The heartbeat loop handles execution.

```json
[
  {
    "id": "work-queue-refill",
    "name": "Discover and curate issues",
    "schedule": { "kind": "cron", "expr": "0 */2 * * *" },
    "sessionTarget": "isolated",
    "wakeMode": "next-heartbeat",
    "payload": {
      "kind": "agentTurn",
      "message": "Run oss-discover in batch mode. Search target repos for candidate issues. Apply solvability scoring (labels, assignee, recency, repo receptiveness). Write top 10 items scoring >= 5 to memory/work-queue-staging.md (NOT work-queue.md -- staging file to avoid race conditions). Do NOT implement -- discover and score only. Check memory/repos/ for anti-AI-PR policies and skip those repos.",
      "lightContext": true
    },
    "delivery": { "mode": "none" }
  },
  {
    "id": "pr-followup-scan",
    "name": "Scan PRs for reviews and CI status",
    "schedule": { "kind": "cron", "expr": "*/30 * * * *" },
    "sessionTarget": "main",
    "wakeMode": "now",
    "payload": {
      "kind": "systemEvent",
      "message": "PR follow-up scan: run gh pr list --author @me --state open --json number,reviewDecision,statusCheckRollup,updatedAt. If any have new review comments or our-fault CI failures, add to memory/followup-staging.md with priority: urgent. (Staging file -- heartbeat merges into work-queue.md to avoid race conditions.)"
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
      "message": "Compile daily report: PRs submitted vs merged vs rejected. Acceptance rate. Cost estimate. Repos contributed to. Update memory/pipeline-state.md stats. Send to dashboard-reporter skill. Calculate cost-per-merged-PR metric.",
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
      "message": "Weekly retrospective: acceptance rate per repo, rejection reasons, average cycle time. Update solvability scores in memory/repos/. Adjust issue selection strategy based on what worked. Prune stale work-queue items. Update MEMORY.md with learned patterns.",
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
      "message": "Review memory files older than 14 days. Archive important patterns to MEMORY.md. Remove stale daily logs and expired work queue items. Prune closed PRs from pipeline-state.md.",
      "lightContext": true
    },
    "delivery": { "mode": "none" }
  }
]
```

### Changes from Previous Config

| Change | Before | After | Why |
|--------|--------|-------|-----|
| Discovery | Once daily at 8am | Every 2 hours, with solvability scoring | Keep queue full; pre-filter for quality |
| PR follow-up | Every 4 hours, isolated | Every 30 min, main session, `wakeMode: now` | Reviews are urgent; fast response = faster merge |
| Daily report | Simple stats | Includes acceptance rate + cost-per-merged-PR | Tracks the metrics that matter |
| Weekly retro | Pattern analysis only | Feeds back into solvability scoring | Closes the learning loop |
| All payloads | Free-text strings | Structured `kind`/`message` format | Proper OpenClaw cron schema |

---

## 10. Async CI & Pipelining Strategy

### The CI Bottleneck (Critic's Key Insight)

> "If the agent waits for CI (5-15 minutes typical), 5 commits/hour is mathematically impossible."

CI is the single biggest time sink. The solution: **never wait for CI.**

### Async CI Flow

```
Agent submits PR --> PR appears on GitHub --> GitHub Actions starts CI --> Agent moves to next task
                                                    |
                                              [5-15 minutes later]
                                                    |
                                              CI passes/fails
                                                    |
                                   PR follow-up cron (every 30 min) detects result
                                                    |
                                   If CI failed (our fault): inject urgent fix into work queue
                                   If CI passed: no action needed (wait for maintainer review)
```

**The agent runs local tests before submitting** (Gate 2 in quality gates). This catches most issues. Remote CI may catch environment-specific failures, which are handled reactively.

### Pipeline State Machine

Each PR moves through states tracked in `memory/pipeline-state.md`:

```
IMPLEMENTING --> LOCAL_TESTS_PASS --> SUBMITTED --> CI_RUNNING --> AWAITING_REVIEW --> MERGED/REJECTED/STALE
```

```markdown
# Pipeline State

## Active PRs (max 5)

### expressjs/express#8901
- branch: clawoss/docs/middleware-typo
- submitted: 2026-03-16T10:30:00Z
- status: awaiting_review
- ci: passed
- last_check: 2026-03-16T11:00:00Z

### prisma/prisma#4567
- branch: clawoss/test/schema-validation
- submitted: 2026-03-16T11:15:00Z
- status: ci_running
- ci: pending
- last_check: 2026-03-16T11:30:00Z

## Stats Today
- submitted: 4
- merged: 1
- rejected: 0
- abandoned: 1
- acceptance_rate: 100% (1/1 reviewed)
- cost_per_merged: $0.85
```

### Pipeline Rules

1. **Never block on reviews or CI.** Submit and move on.
2. **Max 5 active PRs.** Beyond 5, stop submitting; focus on follow-ups.
3. **Follow-ups take absolute priority.** Review comments go to top of queue as `urgent`.
4. **Per-repo rate limiting:** Max 2-3 PRs/repo/day, min 30-min gap.
5. **Stale PR cleanup:** Close PRs with no review activity after 7 days.
6. **Max 3 follow-up rounds per PR.** After 3, politely disengage.

### Effective Throughput With Pipelining

Without pipelining (serial, wait for CI):
```
Task 1 [15 min] --> CI wait [10 min] --> Task 2 [15 min] --> CI wait [10 min] ...
= 50 min per 2 PRs = ~2.4 PRs/hour
```

With pipelining (async CI):
```
Task 1 [15 min] --> Task 2 [15 min] --> Task 3 [15 min] --> Task 4 [15 min] ...
= 15 min per PR = ~4 PR attempts/hour
```

**Pipelining doubles effective throughput** by eliminating CI wait time from the critical path.

---

## 11. Fast Quality Gates

Quality gates must be fast (< 4 minutes total for simple PRs) but effective. The critic emphasized: quality gate before every PR submission.

**Important:** Gates 1-3 run inside the implementation sub-agent (fresh context, no orchestrator pollution). Gate 4 (optional subagent review) spawns a second-level sub-agent from within the implementation sub-agent, providing a truly independent review perspective. This requires `maxSpawnDepth >= 2` if used, but for cost/complexity reasons we recommend keeping Gate 3 (self-check) as the primary LLM gate and reserving Gate 4 for exceptional cases only.

### Gate 1: Pre-Commit Mechanical Checks (< 30 seconds)

Run by `safety-checker` skill. No LLM needed:

```bash
# Diff size
LINES=$(git diff --stat HEAD | tail -1 | awk '{print $4}')
[ "$LINES" -gt 200 ] && echo "FAIL: diff too large" && exit 1

# File count
FILES=$(git diff --name-only HEAD | wc -l)
[ "$FILES" -gt 5 ] && echo "FAIL: too many files" && exit 1

# Secret scan
git diff HEAD | grep -iE '(api_key|secret|password|token|credential)' && echo "FAIL: possible secret" && exit 1

# Branch check
BRANCH=$(git branch --show-current)
echo "$BRANCH" | grep -qE '^(main|master|develop)$' && echo "FAIL: protected branch" && exit 1
echo "$BRANCH" | grep -q '^clawoss/' || echo "FAIL: wrong branch naming" && exit 1
```

### Gate 2: Local Test Suite (1-3 minutes, 3-min timeout)

Run related tests when possible:
- Jest: `npx jest --findRelatedTests <changed-files>`
- pytest: `python -m pytest <changed-files> --timeout=180`
- Generic: run full suite with 3-minute timeout

If tests timeout: note in PR description "Local test suite exceeded timeout; please verify in CI." Do NOT skip submission — let CI be the arbiter.

### Gate 3: LLM Self-Check (< 1 minute)

Single-turn check within the main session (no subagent):

```
Review the diff against the issue. Answer YES or NO:
1. Does the change address the stated issue?
2. Is the change minimal (no unrelated files)?
3. Does the code match the repo's style?
4. Does the PR description explain WHY?
5. Are there tests for the change (if code change)?

If 3+ are NO: abandon this task and log reason.
If 1-2 are NO: fix before submitting.
```

### Gate 4: Subagent Review (Complex PRs Only, < 2 minutes)

Triggered only when diff > 100 lines OR changes span 3+ files:
- Spawns `oss-review` subagent with 120-second timeout
- Fresh context (no pollution from implementation reasoning)
- If timeout: lightweight self-check stands

### Gate Summary

| Gate | Time | When | Cost |
|------|------|------|------|
| Mechanical checks | < 30s | Always | $0 |
| Local tests | 1-3 min | Always | $0 |
| LLM self-check | < 1 min | Always | ~$0.02 |
| Subagent review | < 2 min | Complex PRs | ~$0.10 |
| **Total (simple)** | **2-4 min** | | **~$0.02** |
| **Total (complex)** | **3-6 min** | | **~$0.12** |

---

## 12. Latency Optimizations

### 12.1 Disable Human Delay
```json5
"humanDelay": { "mode": "off" }
```
Saves 800-2500ms per response block. Over a 10-turn cycle: 8-25 seconds saved.

### 12.2 Reduce WebSocket Throttle
```bash
export OPENCLAW_WS_DELTA_THROTTLE_MS=20  # Default: 150ms
```
7x faster token delivery.

### 12.3 Light Context for Heartbeats
```json5
"heartbeat": { "lightContext": true }
```
Only injects HEARTBEAT.md. Saves ~5-10K input tokens per heartbeat. Also reduces context pollution between tasks.

### 12.4 Work Queue Prefetch
Discovery cron fills `memory/work-queue.md` every 2 hours. Heartbeat picks from queue instead of searching. Saves 1-3 min/cycle.

### 12.5 Repo Convention Caching
After first visit, conventions are cached in `memory/repos/<repo-slug>.md`. Subsequent visits skip `repo-analyzer`. Saves 1-2 min/cycle.

### 12.6 Async CI (Not Waiting)
Submit PR and move on. CI results handled reactively. Saves 5-15 min/cycle.

### 12.7 Prompt Cache Warmth
Self-wake keeps the session active (turns < 5 min apart), maximizing OpenClaw's prompt cache hits (cache prunes after 5 min idle).

### Combined Impact

| Optimization | Time Saved/Cycle |
|-------------|-----------------|
| Async CI | 5-15 min |
| Work queue prefetch | 1-3 min |
| Repo convention cache | 1-2 min |
| Human delay off | 8-25 sec |
| Light context | 2-5 sec (fewer tokens) |
| WebSocket throttle | 1-3 sec |
| **Total** | **7-21 min** |

These optimizations reduce a 25-40 min serial cycle to a **15-25 min pipelined cycle**.

---

## 13. Realistic Throughput Expectations

### Honest Projections (Calibrated Against Critic's Analysis)

**Key assumptions:**
- M2.5 real-world agentic success rate: **30-45% blended** (critic calibration: 67% on pre-curated well-defined tasks, 15% on complex/ambiguous; weighted average with curation layer)
- Async CI (no waiting for remote CI)
- Pre-curated work queue with solvability scoring
- 15-25 minute cycle time for small-to-medium tasks
- Per-repo rate limiting (2-3/repo/day)
- **Critical: "merged PRs/day" lags "submitted PRs/day" by 1-7 days** due to maintainer review time

### Submitted vs. Merged PRs (The Pipeline Lag)

The agent can SUBMIT PRs much faster than they get MERGED. Most OSS PRs take 1-7 days for first review. The pipeline needs to fill before merged-per-day stabilizes:

| Phase | PR Attempts/Day | Acceptance Rate | Submitted/Day | Merged/Day (actual) |
|-------|----------------|----------------|---------------|---------------------|
| Week 1-2 (calibration) | 8-12 | 30-40% | 3-5 | **1-2** (pipeline filling) |
| Week 3-4 (ramp) | 15-25 | 35-45% | 5-11 | **3-7** (pipeline filling) |
| Month 2+ (steady state) | 20-35 | 40-50% | 8-17 | **5-12** (pipeline full) |

**Note:** "Merged/Day" reflects the lag. By month 2, the pipeline is full -- PRs submitted in earlier days are getting reviewed and merged, so the daily merge rate catches up to the daily acceptance rate.

### Cost Breakdown (Two Scenarios)

**24/7 Operation:**

| Component | Daily Cost | Monthly Cost |
|-----------|-----------|--------------|
| Heartbeat overhead (10m, lightContext) | $1.50-3 | $45-90 |
| Work execution (20-35 cycles/day) | $4-10 | $120-300 |
| Discovery cron (12x/day) | $0.50-1 | $15-30 |
| PR follow-up cron (48x/day) | $0.50-1 | $15-30 |
| Sub-agent implementation (~all tasks) | included above | included above |
| **Total (24/7)** | **$7-15** | **$210-450** |

**Active Hours Only (8-12 hrs/day via `activeHours` config):**

| Component | Daily Cost | Monthly Cost |
|-----------|-----------|--------------|
| Heartbeat overhead | $0.50-1.50 | $15-45 |
| Work execution | $2-6 | $60-180 |
| Discovery + follow-up crons | $0.50-1 | $15-30 |
| **Total (active hours)** | **$3-9** | **$90-255** |

### Cost Per Merged PR

| Phase | Cost/Day | Merged/Day | Cost/Merged PR |
|-------|---------|-----------|----------------|
| Week 1-2 | $3-6 | 1-2 | **$1.50-6.00** |
| Week 3-4 | $5-10 | 3-7 | **$0.70-3.30** |
| Month 2+ | $7-15 | 5-12 | **$0.60-3.00** |

**Month 2+ meets the <$2/merged PR target at the realistic end.** Early phases may exceed $2 while calibrating -- this is expected. The cost per merged PR improves as the issue curation layer learns which repos and issue types have the highest acceptance rates.

### The Quality-Throughput Sweet Spot

The target is **3-5 merged PRs/day with >70% acceptance rate** as the initial goal (weeks 3-4). At steady state, the architecture is designed to scale to **5-12 merged PRs/day** as the pipeline fills and curation improves.

Key expectations for the dashboard:
- **Submitted PRs/day** will ramp faster than **Merged PRs/day** -- this is normal pipeline lag, not a quality problem
- **Acceptance rate** is the leading indicator of quality; if it drops below 30%, pause and recalibrate
- **Cost per merged PR** should trend downward as curation improves; if it trends up, the agent is attempting tasks that are too complex

### What Could Go Wrong

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Repos block bot account | Medium | High | Per-repo rate limiting, reputation tracking, quality gates |
| Context pollution degrades quality | Low (with sub-agents) | Medium | Two-layer session architecture; fresh context per task |
| OpenRouter rate limits or outages | Low-Medium | Medium | Consider direct MiniMax API as fallback |
| Cost overrun from stuck loops | Low | Medium | Circuit breakers, max consecutive wakes, error limits |
| M2.5 agentic performance lower than expected | Low | High | Start with documentation/simple fixes; ramp based on data |
| Maintainer review lag inflates pipeline | Medium | Low | Stale PR cleanup after 7 days; cap at 5 active PRs |
| Memory file race conditions | Low (with staging) | Medium | Staging file pattern; only heartbeat writes to work-queue.md |

---

## Appendix A: New Memory Files

### memory/wake-state.md
```markdown
# Wake State
- consecutive_wakes: 0
- last_wake: 2026-03-16T00:00:00Z
- commits_this_hour: 0
- errors_this_hour: 0
- hourly_reset: 2026-03-16T00:00:00Z
- prs_today_by_repo: {}
```

### memory/work-queue.md
```markdown
# Work Queue
<!-- Consumed by heartbeat loop. Only heartbeat writes to this file. -->
<!-- Cron jobs write to staging files; heartbeat merges them here. -->
<!-- Format: priority | repo | issue | title | solvability_score | discovered -->

- [ ] normal | expressjs/express#8901 | Fix typo in middleware docs | 8 | 2026-03-16
- [ ] normal | prisma/prisma#4567 | Add test for schema validation | 6 | 2026-03-16
```

### memory/work-queue-staging.md
```markdown
# Work Queue Staging
<!-- Written by work-queue-refill cron (isolated session). -->
<!-- Heartbeat merges contents into work-queue.md and clears this file. -->
```

### memory/followup-staging.md
```markdown
# Follow-up Staging
<!-- Written by pr-followup-scan cron. -->
<!-- Heartbeat merges contents into work-queue.md as priority: urgent and clears this file. -->
```

### memory/pipeline-state.md
```markdown
# Pipeline State
<!-- Max 5 active PRs. Updated by heartbeat loop. -->

## Active PRs
<!-- None yet -->

## Stats Today
- submitted: 0
- merged: 0
- rejected: 0
- abandoned: 0
- acceptance_rate: N/A
- cost_per_merged: N/A
```

---

## Appendix B: Environment Setup

```bash
# Throughput optimizations
export OPENCLAW_WS_DELTA_THROTTLE_MS=20  # 7x faster WebSocket delivery

# Start gateway
openclaw gateway start --config ./config/openclaw.json
```

---

## Appendix C: Decision Log

| Decision | Considered | Chosen | Rationale |
|----------|-----------|--------|-----------|
| Primary metric | Commits/hour | Merged PRs/day | Critic: commits incentivizes trivial work |
| Session strategy | a) lightContext + memory flush, b) Isolated session per task, c) **Orchestrator + sub-agent** | **(c) Orchestrator + sub-agent** | Critic v2: fresh context per task via `sessions_spawn`; main session stays clean as orchestrator; preserves self-wake chain and "single agent" identity |
| Agent default flag | Not set | `"default": true` | Critic: required for heartbeat/cron routing to main session; without it, jobs are rejected. **Also fixed in live config/openclaw.json.** |
| Sub-agent timeout | 120s (review only) | 600s (full implementation) | Sub-agents now run entire implementation cycle, not just review |
| CI handling | Wait for CI | Async (submit + move on) | CI wait eliminates high-throughput possibility |
| Heartbeat interval | 5m / 10m / 15m / 55m | 10m + self-wake | Balance cost, responsiveness, cache warmth |
| Quality gate | Subagent every PR | Lightweight self-check inside sub-agent | Quality gates run inside the implementation sub-agent, not in main session |
| Issue selection | All labeled issues | Solvability scoring >= 5 | Pre-filter reduces wasted cycles |
| Self-review model | Different model | Same model, different prompt strategy | Single-model constraint (M2.5 only) |
| lightContext safety | lightContext off (full bootstrap) | lightContext on + **full AGENTS.md rules replicated in HEARTBEAT.md** | Critic v3: lightContext strips AGENTS.md; all safety rules must be embedded in HEARTBEAT.md or they're invisible during autonomous operation |
| Memory file concurrency | Single work-queue.md for all writers | **Staging file pattern** (cron writes to staging, heartbeat merges) | Critic v3: race condition between isolated cron sessions and main session writing same file |
| Throughput projections | 14-27 merged PRs/day | **5-12 merged PRs/day** (steady state) | Critic v3: pipeline lag (1-7 day review), blended success rate 30-45% not 50-65% |

---

## Sources

- [OpenClaw Heartbeat Documentation](https://docs.openclaw.ai/gateway/heartbeat)
- [OpenClaw Configuration Reference](https://moltfounders.com/openclaw-configuration)
- [Reduce OpenClaw Latency: 5 Proven Optimizations](https://markaicode.com/reduce-openclaw-latency-5-optimization-tips/)
- [OpenClaw Ralph Loop: Autonomous Agent Loop Explained](https://clawtank.dev/blog/openclaw-ralph-loop-guide)
- [How Does OpenClaw Work? Inside the Agent Loop](https://tomaszs2.medium.com/how-does-openclaw-work-inside-the-agent-loop-that-powers-200-000-github-stars-e61db2bbfcbb)
- [OpenClaw v2026.2.25 Release Notes](https://globalclaw.github.io/globalclaw-blog/posts/2026-02-26-openclaw-2026-2-25.html)
- [OpenClaw DeepWiki](https://deepwiki.com/openclaw/openclaw)
- [Throughput Critique Analysis](./07-throughput-critique.md)
- [SWE-bench Verified Leaderboard](https://www.swebench.com/)
- [Minimax M2.5 Technical Report](https://arxiv.org/abs/2505.17279)
