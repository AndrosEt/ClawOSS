# ClawOSS

```
     ██████╗██╗      █████╗ ██╗    ██╗ ██████╗ ███████╗███████╗
    ██╔════╝██║     ██╔══██╗██║    ██║██╔═══██╗██╔════╝██╔════╝
    ██║     ██║     ███████║██║ █╗ ██║██║   ██║███████╗███████╗
    ██║     ██║     ██╔══██║██║███╗██║██║   ██║╚════██║╚════██║
    ╚██████╗███████╗██║  ██║╚███╔███╔╝╚██████╔╝███████║███████║
     ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝  ╚═════╝ ╚══════╝╚══════╝
           Autonomous Open-Source Contribution Engine
```

**The best OpenClaw agent configuration for autonomous open-source contribution.**

ClawOSS configures an [OpenClaw](https://github.com/openclaw/openclaw) agent to autonomously discover issues, implement fixes, and submit high-quality pull requests to open-source projects — 24/7, without human intervention.

> **OpenClaw is the engine; ClawOSS is the race car.** We do not modify OpenClaw. We configure it — writing skills, workspace instructions, hooks, and monitoring — to produce the highest quality OSS contributions possible.

---

### Day 1: 17 PRs Across 11 Repos

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │   17 PULL REQUESTS SUBMITTED  ·  DAY 1  ·  ZERO HUMAN INTERVENTION │
  │                                                                     │
  │   Repos ....  11 distinct repositories                              │
  │   Range ....  apache/mahout to jenkinsci to ray-project             │
  │   Languages   Rust, Python, Java, TypeScript, Ruby                  │
  │   Model ....  Kimi Code k2p5 (direct API)                           │
  │   Mode .....  5 concurrent sub-agents                               │
  │                                                                     │
  │   ┌──────────────────────────────────────────────────────────────┐  │
  │   │  HIGHLIGHT: jenkinsci/warnings-ng-plugin#3291                │  │
  │   │  Fixed double HTML escaping (C++ Lint -> C&#43;&#43; Lint)  │  │
  │   │  Root cause: ToolNameRegistry + Jelly escape-by-default      │  │
  │   └──────────────────────────────────────────────────────────────┘  │
  │                                                                     │
  │   apache/mahout ···· #1191 #1192 #1193 #1194  (4 PRs, Parquet)    │
  │   autokey/autokey ·· #1090 #1091  (X11 leak fix + controllers)     │
  │   ray-project/ray ·· #61754  (distributed computing, 83k stars)    │
  │   apache/arrow ····· #49516  (in-memory data platform)             │
  │   Shopify/ruby-lsp · #4007  (Ruby language server)                 │
  │   jenkinsci ········ #3291  (warnings-ng-plugin, HTML escaping)    │
  │   + 6 more across windoze95, sonpiaz, Nexal-AI, whoisjayd, itdove │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## System Architecture

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                          O P E N C L A W   G A T E W A Y                ║
║                                                                         ║
║   ┌──────────────┐   ┌──────────────┐   ┌────────────────────────────┐  ║
║   │  HEARTBEAT   │   │  CRON JOBS   │   │         A G E N T          │  ║
║   │              │   │              │   │                            │  ║
║   │  every 10m   │   │  5 scheduled │   │  Model: GLM-5 / Kimi Code │  ║
║   │  lightCtx    │   │  jobs        │   │  Skills: 15 (10+5)        │  ║
║   │              │   │              │   │  Quality: 9-gate system    │  ║
║   │  9 steps:    │   │  - discover  │   │  Memory: persistent       │  ║
║   │  0a,0b,1-7   │   │  - followup  │   │  Sub-agents: max 5       │  ║
║   │              │   │  - report    │   │                            │  ║
║   └──────┬───────┘   │  - retro     │   └─────────────┬──────────────┘  ║
║          │           │  - cleanup   │                 │                  ║
║          │           └──────┬───────┘                 │                  ║
║          └─────────┬────────┘                         │                  ║
║                    │                                  │                  ║
╚════════════════════╪══════════════════════════════════╪══════════════════╝
                     │                                  │
        ┌────────────▼────────────┐        ┌────────────▼────────────┐
        │                         │        │                         │
        │      G I T H U B        │        │    V E R C E L          │
        │                         │        │    D A S H B O A R D    │
        │  ░░ Fork repos          │        │                         │
        │  ░░ Create PRs          │        │  ░░ Agent status        │
        │  ░░ Respond to reviews  │        │  ░░ PR tracker          │
        │  ░░ Search issues       │        │  ░░ Quality metrics     │
        │  ░░ AI disclosure       │        │  ░░ Token/cost tracking │
        │                         │        │  ░░ Live conversation   │
        └─────────────────────────┘        └─────────────────────────┘
```

## How It Works

ClawOSS uses an **orchestrator + sub-agent architecture**: a persistent main session handles orchestration (heartbeat loop, work queue, PR follow-ups), while implementation tasks are delegated to fresh sub-agent sessions via `sessions_spawn` for zero cross-task context pollution.

### Orchestrator + Sub-Agent Model

```
    ┌─────────────────────────────────────────────────────────────┐
    │                    ORCHESTRATOR (main session)               │
    │                                                             │
    │   Heartbeat ──► Triage ──► Spawn ──► Monitor ──► Report    │
    │       │                       │          │                   │
    │       │              ┌────────┼──────────┤                   │
    │       ▼              ▼        ▼          ▼                   │
    │   ┌────────┐   ┌────────┐ ┌────────┐ ┌────────┐            │
    │   │  Work  │   │Sub     │ │Sub     │ │Sub     │  max 5     │
    │   │  Queue │   │Agent 1 │ │Agent 2 │ │Agent 3 │  concurrent│
    │   │  ░░░░░ │   │        │ │        │ │        │            │
    │   │  ░░░░░ │   │ clone  │ │ clone  │ │ clone  │            │
    │   │  ░░░   │   │ test   │ │ test   │ │ test   │            │
    │   │        │   │ fix    │ │ fix    │ │ fix    │            │
    │   └────────┘   │ PR     │ │ PR     │ │ PR     │            │
    │                └───┬────┘ └───┬────┘ └───┬────┘            │
    │                    │          │          │                   │
    │                    └──────────┼──────────┘                   │
    │                               ▼                              │
    │                    ┌────────────────────┐                    │
    │                    │   Results + PRs    │                    │
    │                    │   back to orch.    │                    │
    │                    └────────────────────┘                    │
    └─────────────────────────────────────────────────────────────┘
```

### Contribution Pipeline

The pipeline follows a 9-phase loop driven by a 10-minute heartbeat cycle:

```
    ╭──────────╮   ╭──────────╮   ╭──────────╮   ╭──────────╮
    │    1.    │──▶│    2.    │──▶│    3.    │──▶│    4.    │
    │ DISCOVER │   │  TRIAGE  │   │ ANALYZE  │   │IMPLEMENT │
    │          │   │          │   │          │   │          │
    │ search   │   │ feasible │   │ clone    │   │ failing  │
    │ github   │   │ assess   │   │ read     │   │ test     │
    │ score    │   │ score    │   │ detect   │   │ min fix  │
    ╰──────────╯   ╰──────────╯   ╰──────────╯   ╰─────┬────╯
                                                        │
    ╭──────────╮   ╭──────────╮   ╭──────────╮   ╭─────▼────╮
    │    8.    │◀──│    7.    │◀──│    6.    │◀──│    5.    │
    │ FOLLOW   │   │  SUBMIT  │   │  SAFETY  │   │  REVIEW  │
    │   UP     │   │          │   │  CHECK   │   │          │
    │          │   │ push     │   │          │   │ 7-gate   │
    │ review   │   │ fork     │   │ budget   │   │ quality  │
    │ respond  │   │ PR       │   │ secrets  │   │ subagent │
    ╰────┬─────╯   ╰──────────╯   ╰──────────╯   ╰──────────╯
         │
    ╭────▼─────╮
    │    9.    │
    │ CONTEXT  │
    │ MANAGE   │
    │          │
    │ flush    │
    │ compact  │
    ╰──────────╯
```

| Phase | Skill | Description |
|-------|-------|-------------|
| 1. Discover | `oss-discover` | Search GitHub for `good-first-issue`, `help-wanted`, `bug` labels |
| 2. Triage | `oss-triage` | Assess feasibility, complexity, success probability |
| 3. Analyze | `repo-analyzer` | Clone repo, read CONTRIBUTING.md, detect tech stack and style |
| 4. Implement | `oss-implement` | Reproduce-first: failing test, minimal fix, verify, evidence-based PR |
| 5. Self-Review | `oss-review` | 7-gate quality check + isolated subagent independent review |
| 6. Safety Check | `safety-checker` | Budget, diff size, secrets, spam limits, final independent review |
| 7. Submit | `oss-submit` | Push to fork, create PR with AI disclosure |
| 8. Follow Up | `oss-followup` | Respond to review feedback (max 3 rounds) |
| 9. Context | `context-manager` | Flush state to memory, manage compaction, clean up between tasks |

The `dashboard-reporter` skill runs throughout, sending metrics to the Vercel dashboard on every heartbeat and after significant events.

---

## Features

```
    ┌───────────────────────────────────────────────────────────────┐
    │                    C L A W O S S   F E A T U R E S            │
    ├───────────────────────────────────────────────────────────────┤
    │                                                               │
    │  MODEL          GLM-5 via OpenRouter / Kimi Code direct API   │
    │  ·············  $0.72/MTok in, $2.30/MTok out                 │
    │                                                               │
    │  ARCHITECTURE   Orchestrator + up to 5 parallel sub-agents    │
    │  ·············  Fresh context per task, zero pollution         │
    │                                                               │
    │  SKILLS         15 total (10 pipeline + 5 superpowers)        │
    │  ·············  TDD, debugging, brainstorming, code review    │
    │                                                               │
    │  QUALITY        9-gate system + independent subagent review   │
    │  ·············  Scope, tests, security, anti-slop, git hygiene│
    │                                                               │
    │  ANTI-SPAM      3 PRs/repo/day, 10 total, 200 LOC, 5 files   │
    │  ·············  Rate limits enforced per heartbeat cycle       │
    │                                                               │
    │  DASHBOARD      Real-time Vercel app with Turso DB            │
    │  ·············  Live feed, PR tracker, cost, quality metrics   │
    │                                                               │
    │  MEMORY         Learns repo conventions over time             │
    │  ·············  Maintainer preferences, strategies, blocklists │
    │                                                               │
    │  SAFETY         Never force-push, never push to main          │
    │  ·············  Never commit secrets, content filter defense   │
    │                                                               │
    │  CRON           5 scheduled jobs for discovery + maintenance   │
    │  ·············  Issue scan, PR followup, reports, cleanup      │
    │                                                               │
    └───────────────────────────────────────────────────────────────┘
```

---

## Quality Gates

Every PR passes through 9 gates before submission:

```
    ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
    │  0  │─▶│  1  │─▶│  2  │─▶│  3  │─▶│  4  │─▶│  5  │─▶│  6  │─▶│  7  │─▶│  8  │
    │     │  │     │  │     │  │     │  │     │  │     │  │     │  │     │  │     │
    │BUD- │  │SCOPE│  │CODE │  │TESTS│  │SECU-│  │ANTI-│  │ GIT │  │ PR  │  │INDEP│
    │GET  │  │     │  │QUAL │  │     │  │RITY │  │SLOP │  │HYGI-│  │TEMP-│  │REVW │
    │     │  │     │  │     │  │     │  │     │  │     │  │ENE  │  │LATE │  │     │
    └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘
     daily    <200     linter   all      no        no AI    branch   title    isolated
     spend    LOC      passes   pass     secrets   markers  naming   + why    subagent
     cap      <5 files style    +new     no keys   no junk  commits  issue#   clean ctx
```

| Gate | What It Checks |
|------|----------------|
| **0. Budget** | Daily token spend hasn't exceeded cap |
| **1. Scope** | Changes related to issue only, <200 LOC, <5 files |
| **2. Code Quality** | Linter passes, matches repo style, no debug statements |
| **3. Tests** | All tests pass, new tests added for changes |
| **4. Security** | No secrets, API keys, .env files, or dangerous patterns |
| **5. Anti-Slop** | No unnecessary comments, AI markers, over-engineering, single-use helpers |
| **6. Git Hygiene** | Correct branch naming, conventional commits, clean history |
| **7. PR Template** | Concise title, explains "why", references issue, AI disclosure |
| **8. Independent Review** | Isolated subagent reviews diff with clean context |

---

## Project Structure

```
ClawOSS/
│
├── workspace/                          # OpenClaw workspace
│   ├── AGENTS.md                       # Core behavioral contract
│   ├── SOUL.md                         # Persona and boundaries
│   ├── HEARTBEAT.md                    # 9-step autonomous work loop
│   │
│   ├── skills/                         # ── 15 Skills ──────────────
│   │   ├── oss-discover/               #   Find issues to work on
│   │   ├── oss-implement/              #   Reproduce-first TDD workflow
│   │   ├── oss-review/                 #   7-gate quality check
│   │   ├── oss-submit/                 #   Create PRs with AI disclosure
│   │   ├── oss-followup/               #   Respond to review feedback
│   │   ├── oss-triage/                 #   Assess issue feasibility
│   │   ├── repo-analyzer/              #   Detect tech stack and style
│   │   ├── context-manager/            #   Manage context window
│   │   ├── dashboard-reporter/         #   Send metrics to dashboard
│   │   ├── safety-checker/             #   Final pre-submit gate
│   │   ├── systematic-debugging/       #   (superpowers) Root cause analysis
│   │   ├── test-driven-development/    #   (superpowers) Red-Green-Refactor
│   │   ├── verification-before-completion/  # (superpowers) Final checks
│   │   ├── brainstorming/              #   (superpowers) Design exploration
│   │   └── requesting-code-review/     #   (superpowers) Code review workflow
│   │
│   ├── hooks/                          # ── Event Hooks ────────────
│   │   ├── dashboard-reporter/         #   Telemetry after each turn
│   │   ├── audit-logger/               #   Action audit trail
│   │   └── pii-sanitizer/              #   Strip PII from tool results
│   │
│   └── memory/                         #   Persistent agent memory
│
├── config/
│   ├── openclaw.json                   # Gateway config (model, compaction, tools)
│   └── cron-jobs.json                  # 5 scheduled jobs
│
├── plugins/
│   └── pii-sanitizer/                  # Compiled PII sanitizer plugin
│
├── dashboard/                          # Next.js 15 + Turso monitoring app
├── issues/                             # 34 tracked issues (16 fixed)
├── research/                           # Architecture research docs
├── templates/                          # PR, commit, issue templates
└── scripts/                            # Setup, start, stop, health, backup
```

---

## GitHub Identity

```
    ┌──────────────────────────────────────────────────────────┐
    │                                                          │
    │   @BillionClaw                                           │
    │   billionclaw+clawoss@users.noreply.github.com           │
    │                                                          │
    │   Scope ......... public_repo (least privilege)          │
    │   Purpose ....... Exclusively for ClawOSS operations     │
    │   Auth .......... gh auth login (interactive, no PAT)    │
    │   AI Disclosure . Every PR includes AI-generated notice  │
    │                                                          │
    └──────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- [OpenClaw](https://github.com/openclaw/openclaw) installed
- [GitHub CLI](https://cli.github.com) (`gh`) installed
- [Node.js](https://nodejs.org) (v18+)
- A GitHub account for the agent (default: [@BillionClaw](https://github.com/BillionClaw))

### Setup

```bash
# Clone the repository
git clone https://github.com/billion-token-one-task/ClawOSS.git
cd ClawOSS

# Run setup (configures git identity, links workspace, copies config)
npm run setup

# Edit your OpenClaw config with API keys
vim ~/.openclaw/openclaw.json

# Start the agent
npm run start
```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | One-time setup: link workspace, configure git identity, authenticate gh |
| `npm run start` | Register cron jobs and start the OpenClaw gateway |
| `npm run stop` | Graceful shutdown |
| `npm run restart` | Full restart: env, identity, auth, config, clean sessions, start gateway + sync, kick agent |
| `npm run health` | Verify agent is running and healthy |
| `npm run validate` | Validate config files and skill definitions |
| `npm run dashboard:dev` | Run the monitoring dashboard locally |
| `npm run dashboard:build` | Build the dashboard for production |

---

## Skills

### Custom Pipeline Skills

```
    DISCOVER ─── TRIAGE ─── ANALYZE ─── IMPLEMENT ─── REVIEW
        │           │          │            │            │
    oss-discover  oss-triage  repo-      oss-         oss-review
                              analyzer   implement
                                                         │
    FOLLOWUP ─── SUBMIT ─── SAFETY ─── CONTEXT ─── DASHBOARD
        │           │          │           │            │
    oss-followup  oss-submit  safety-   context-    dashboard-
                              checker   manager     reporter
```

| Skill | Description |
|-------|-------------|
| **oss-discover** | Search GitHub for contribution opportunities, score and rank candidates |
| **oss-implement** | Reproduce-first workflow: failing test, minimal fix, verify, evidence-based PR |
| **oss-review** | 7-gate quality check with isolated subagent for independent review |
| **oss-submit** | Submit PRs via fork with AI disclosure notice |
| **oss-followup** | Respond to review feedback (max 3 revision rounds) |
| **oss-triage** | Assess issue feasibility, complexity, and success probability |
| **repo-analyzer** | Detect tech stack, code style, test framework, CI system |
| **context-manager** | Manage context window, flush state before compaction |
| **dashboard-reporter** | Send heartbeat and event telemetry to Vercel dashboard |
| **safety-checker** | Final gate: budget, diff size, secrets, spam limits, independent review |

### Superpowers (from obra/superpowers)

| Skill | Description |
|-------|-------------|
| **systematic-debugging** | Structured root cause analysis before proposing fixes |
| **test-driven-development** | Red-Green-Refactor cycle for implementation |
| **verification-before-completion** | Final checks before claiming work is done |
| **brainstorming** | Collaborative design exploration before implementation |
| **requesting-code-review** | Structured approach to requesting and incorporating reviews |

---

## Event Hooks

Hooks run automatically on OpenClaw events (unlike skills, which are invoked by the agent):

```
    Tool Result ──► pii-sanitizer ──► Sanitized Result ──► Session
                        │
                  ┌─────┴─────┐
                  │  Replace @ │
                  │  Strip PII │
                  │  Redact IP │
                  └───────────┘

    Agent Turn  ──► dashboard-reporter ──► POST /api/ingest ──► Turso DB
                        │
                  ┌─────┴─────┐
                  │ Heartbeat  │
                  │ Metrics    │
                  │ Messages   │
                  └───────────┘

    Any Action  ──► audit-logger ──► POST /api/ingest/logs ──► Turso DB
```

| Hook | Events | Description |
|------|--------|-------------|
| **pii-sanitizer** | `tool_result_persist`, `before_message_write` | Strips emails (fullwidth @), phones, IPs, SSNs, credit cards from tool results — prevents OpenRouter 403 loops |
| **dashboard-reporter** | `agent_end`, `after_tool_call` | Posts heartbeats, token metrics, and conversation messages to dashboard |
| **audit-logger** | `command:new`, `agent_end`, `after_tool_call` | Logs all agent actions to dashboard audit trail |

Dashboard hooks are fire-and-forget with 10s timeouts. The PII sanitizer runs synchronously before persistence.

---

## Configuration

### openclaw.json

Key settings in `config/openclaw.json`:

| Setting | Value | Why |
|---------|-------|-----|
| Primary model | `openrouter/z-ai/glm-5` | Switched from K2.5 to work around content filter ($0.72/MTok in, $2.30/MTok out) |
| Fallback models | `[]` (none) | Prevents silent fallback to expensive Anthropic models |
| Heartbeat interval | 10 minutes | Fast autonomous loop cycling; cheap with lightContext |
| Heartbeat model | `openrouter/z-ai/glm-5` | Same model for consistency |
| Heartbeat lightContext | `true` | Minimal context load; HEARTBEAT.md embeds safety rules |
| Compaction mode | `safeguard` | Triggers compaction at context capacity |
| Compaction memory flush | Enabled at 150K tokens | Pre-compaction state preservation |
| Post-compaction sections | Architecture, Safety, Context Rot | Key sections preserved after compaction |
| Tool profile | `coding` | Full filesystem + runtime access |
| Sub-agent concurrency | 5 | Up to 5 parallel sub-agents for different tasks |
| sessions_spawn attachments | `enabled` | Required for passing context to sub-agents |

### Workspace Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Core behavioral contract: safety defaults, work discovery, quality standards, anti-spam |
| `SOUL.md` | Persona: professional, humble, technical. Boundaries: stay in lane, disclose AI |
| `USER.md` | Operator profile and BillionClaw GitHub identity |
| `IDENTITY.md` | Agent name, role, GitHub account |
| `TOOLS.md` | Tool conventions and safety rules for git, gh, node |
| `HEARTBEAT.md` | 9-step autonomous work loop: context health, circuit breakers, stall recovery, PR follow-ups, queue management, triage, sub-agent spawn, result handling, reporting |
| `BOOTSTRAP.md` | First-run initialization sequence (deleted after completion) |
| `MEMORY.md` | Long-term memory: repo conventions, maintainer prefs, strategies |

### Cron Jobs

```
    ┌─────────────────────────────────────────────────────────────────┐
    │  CRON SCHEDULE                                                  │
    │                                                                 │
    │  Every 2h    ░░░░ work-queue-refill   Discover + score issues   │
    │  Every 30m   ░░░░ pr-followup-scan    Check PRs for reviews     │
    │  11pm daily  ░░░░ daily-report        Compile daily metrics     │
    │  Mon 9am     ░░░░ weekly-retrospective Analyze acceptance rates │
    │  Sun 3am     ░░░░ memory-cleanup      Archive stale memory      │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
```

| Job | Schedule | Session | Purpose |
|-----|----------|---------|---------|
| work-queue-refill | Every 2h | Isolated | Discover and score candidate issues, write to staging file |
| pr-followup-scan | Every 30min | Main | Check open PRs for review comments and CI status |
| daily-report | 11pm daily | Isolated | Compile daily metrics and cost-per-merged-PR |
| weekly-retrospective | Monday 9am | Isolated | Analyze acceptance rates, adjust strategy |
| memory-cleanup | Sunday 3am | Isolated | Archive stale memory, prune expired queue items |

---

## Dashboard

**Live:** [clawoss-dashboard.vercel.app](https://clawoss-dashboard.vercel.app)

```
    ┌──────────────────────────────────────────────────────────────────┐
    │  ClawOSS Dashboard                              clawoss.vercel  │
    ├──────┬──────┬──────┬──────┬──────┬──────┬───────────────────────┤
    │ Over │  PR  │Health│Qual- │ Logs │ Live │ Settings              │
    │ view │Track │      │ity   │      │ Feed │                       │
    ├──────┴──────┴──────┴──────┴──────┴──────┴───────────────────────┤
    │                                                                  │
    │  ┌─────────────────────────────────────────────────────────────┐ │
    │  │ Pipeline: ● connected  heartbeats/hr: 6  errors: 0        │ │
    │  │ model: GLM-5  pricing: $0.72/$2.30/M  pii-sanitizer: on   │ │
    │  └─────────────────────────────────────────────────────────────┘ │
    │                                                                  │
    │  LIVE FEED ─────────────────────────────────────────────────     │
    │  ┌─────────────────────┬──────────┬───────────┬──────────┐      │
    │  │ All Sessions        │ # Main   │ ~> Sub: 1 │ ~> Sub: 2│      │
    │  ├─────────────────────┴──────────┴───────────┴──────────┤      │
    │  │ Feed │ Tools │ Errors │ Costs │    │ State │ GW │Stats│      │
    │  ├──────┴───────┴────────┴───────┘    └───────┴────┴─────┤      │
    │  │                                                        │      │
    │  │  12:03  [oss-discover] Found 5 candidate issues        │      │
    │  │  12:04  [oss-triage] apache/mahout#1191 score: 8.5     │      │
    │  │  12:05  [sessions_spawn] Sub-agent for mahout#1191     │      │
    │  │  12:17  [PR created] apache/mahout#1191 +359/-2        │      │
    │  │                                                        │      │
    │  └────────────────────────────────────────────────────────┘      │
    │                                                                  │
    └──────────────────────────────────────────────────────────────────┘
```

### Pages

- **Overview** — Agent status, key metrics, activity timeline, current task, pipeline status bar
- **PR Tracker** — All submitted PRs with status, quality scores, review state, build logs
- **Health** — Token usage, cost tracking, heartbeat status, error rates
- **Quality** — Quality score trends, by-repo breakdown, rejection analysis
- **Logs** — Filterable log stream with infinite scroll
- **Live Feed** — Full-featured conversation monitor:
  - Session tabs: orchestrator + per-sub-agent with green pulse on active sessions
  - View modes: unified timeline, orchestrator only, sub-agents only
  - Main tabs: Feed / Tools / Errors / Costs
  - Sidebar tabs: State / Gateway / Stats
  - Tool call log with duration tracking, success/fail color-coding, search
  - Error log with classified types (403-filter, timeout, ENOENT, rate-limit, etc.)
  - Cost breakdown per session with $/hour rate and GLM-5 pricing
  - Gateway status panel (port, model, sessions, heartbeat, skills)
  - PII sanitizer indicators (header badge, per-message badges, filter counter)
  - Raw JSON toggle per message, pause-on-hover, slow tool highlighting
- **Settings** — Target repos, quality thresholds, notification config

**Tech stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts, Drizzle ORM, Turso, SWR.

### Deploy

```bash
cd dashboard
npx vercel --prod
```

Required environment variables (set in Vercel dashboard):

- `TURSO_DATABASE_URL` — Turso SQLite edge database URL
- `TURSO_AUTH_TOKEN` — Turso auth token
- `GITHUB_TOKEN` — GitHub PAT for PR sync
- `CLAW_AGENT_USERNAME` — Agent's GitHub username (BillionClaw)
- `CLAW_API_KEY` — Shared secret for agent-to-dashboard auth

---

## Operational Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `setup.sh` | `npm run setup` | Configure git identity (BillionClaw), authenticate gh, link workspace, copy config |
| `start.sh` | `npm run start` | Register all 5 cron jobs, start OpenClaw gateway in daemon mode |
| `stop.sh` | `npm run stop` | Graceful gateway shutdown |
| `restart.sh` | `npm run restart` | Full restart: load .env, set identity, auth gh, deploy config, clean sessions, start gateway + dashboard sync, kick agent |
| `health-check.sh` | `npm run health` | Verify gateway running, gh authenticated, workspace linked, cron registered |
| `backup-workspace.sh` | — | Commit agent memory state to git |
| `rotate-logs.sh` | — | Remove log files older than 14 days |
| `dashboard-sync.sh` | — | Sync agent state to dashboard (runs in background) |

---

## Realistic Expectations

ClawOSS is honest about what autonomous AI contribution can achieve today. The primary metric is **merged PRs per day with >70% acceptance rate and <$2/merged PR** — not commits per hour (see `issues/010`).

### Actual vs Expected Throughput

```
    EXPECTED              ACTUAL DAY 1
    ────────              ──────────────
    Week 1-2     1-2      ████████████████████████████████████  17 PRs
    Week 3-4     3-5                                            (on day 1)
    Month 2+     5-10
    Month 3+     10-15

    Day 1 output across 11 repos, 5 languages, 5 concurrent sub-agents
```

### Cost Projections (GLM-5 via OpenRouter)

| Scenario | Daily Cost | Monthly Cost |
|----------|-----------|--------------|
| Moderate (2-3 PRs/day) | $2-5 | $60-150 |
| High (5+ PRs/day) | $5-15 | $150-450 |
| With retries/failures (2x) | $10-25 | $300-750 |

### Merge Rates by Task Type

```
    Documentation / CI / deps   ████████████████████████████░░░░░  40-60%
    Simple bug fixes            ██████████████░░░░░░░░░░░░░░░░░░░  20-30%
    Feature additions           █████████░░░░░░░░░░░░░░░░░░░░░░░░  10-20%
    Complex refactors           ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   5-10%
```

### Timeline

| Milestone | Timeline |
|-----------|----------|
| First PR submitted | Day 1-3 |
| First PR merged | Week 1-2 |
| First code-change PR merged | Week 3-4 |
| Steady state | Month 2-3 |

### What ClawOSS Is NOT

- Not "autonomous development" — it's autonomous **contribution** to specific task types
- Not a replacement for developers — it augments maintainer capacity for mechanical tasks
- Not self-improving without feedback — human review of quality trends is essential
- Not optimized for volume — quality and merge rate over commit count

---

## Safety & Ethics

```
    ┌───────────────────────────────────────────────────────────────────┐
    │                     S A F E T Y   D E F A U L T S                │
    ├───────────────────────────────────────────────────────────────────┤
    │                                                                   │
    │  NEVER push to main/master or default branches                    │
    │  NEVER force-push to any branch                                   │
    │  NEVER commit secrets, credentials, API keys, or .env files       │
    │  NEVER modify CI/CD pipelines without explicit approval           │
    │  NEVER submit PRs without reading CONTRIBUTING.md first           │
    │  NEVER submit more than 3 PRs to the same repo per day           │
    │  NEVER submit PRs larger than 200 lines changed                   │
    │  NEVER modify more than 5 files in a single PR                    │
    │                                                                   │
    │  ALWAYS use public_repo token scope (least privilege)             │
    │  ALWAYS create feature branches (clawoss/<type>/<desc>)           │
    │  ALWAYS run tests before submitting                               │
    │  ALWAYS disclose AI authorship in every PR                        │
    │  ALWAYS close PRs politely on rejection                           │
    │                                                                   │
    └───────────────────────────────────────────────────────────────────┘
```

---

## Known Issues

See the [`issues/`](issues/) directory for detailed tracking (34 issues).

```
    STATUS OVERVIEW
    ═══════════════

    Fixed ··················  ████████████████░░░░░░░░░░░░░░░░░░  16
    Open ···················  █████████░░░░░░░░░░░░░░░░░░░░░░░░░   9
    Implemented ············  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   2
    Other ··················  ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░   7
                                                          Total: 34
```

| # | Issue | Status |
|---|-------|--------|
| 001 | OpenRouter content filter causes 403 loops with PII content | Partially Fixed (see #033) |
| 002 | Stale agent processes hold session locks | Open |
| 003 | Symlinked skills get "outside root" warnings | Open |
| 004 | Sessions can exceed model context window | Open (mitigated) |
| 005 | Model fallback to expensive Anthropic APIs | **Fixed** |
| 006 | Sub-agent attachments disabled by default | **Fixed** |
| 007 | Git email triggers content filter | **Fixed** |
| 008 | Cron jobs need isolated sessions | **Fixed** |
| 009 | Heartbeat cost optimization | **Fixed** |
| 010 | Throughput expectations reframed | Acknowledged |
| 011 | oss-review referenced Haiku/Sonnet | **Fixed** |
| 012 | safety-checker referenced "Sonnet subagent" | **Fixed** |
| 013 | TOOLS.md had 500 LOC limit | **Fixed** |
| 014 | start.sh ignores sessionTarget | Open |
| 015 | Dashboard reporter hardcoded URL | **Fixed** |
| 016 | Dashboard Live Feed undocumented | **Fixed** |
| 017 | Dashboard cost model wrong ID | **Fixed** |
| 018 | .env contains real API keys | Open (CRITICAL) |
| 019 | .env missing dashboard variables | Open |
| 020 | OpenClaw hooks undocumented | **Fixed** |
| 021 | Model switch M2.5 to K2.5 | **Completed** |
| 022 | Cloned repos should be gitignored | **Fixed** |
| 023 | oss-implement exceeded char limit | **Fixed** |
| 024 | Invalid openclaw.json schema | **Fixed** |
| 025 | Gateway restart kills agent turns | Known |
| 026 | Heartbeat stops after diagnostics | **Fixed** |
| 027 | maxConcurrent mismatch (5 vs 1) | **Fixed** |
| 028 | Sub-agent stall recovery | **Implemented** |
| 029 | Heartbeat not executing full loop | In Progress |
| 030 | PII sanitizer plugin | **Implemented** |
| 031 | Work queue trap on 403 | **Mitigated** |
| 032 | Telemetry gap on 403 failures | Open |
| 033 | OpenRouter blocks model's own @ output | Worked around (GLM-5) |
| 034 | Autonomous model switch to GLM-5 | Active |

---

## Contributing

Contributions welcome! Please read the existing workspace files and skills to understand the architecture before submitting changes.

## License

MIT License. See [LICENSE](LICENSE).
