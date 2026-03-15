# ClawOSS

**The best OpenClaw agent configuration for autonomous open-source contribution.**

ClawOSS configures an [OpenClaw](https://github.com/openclaw/openclaw) agent to autonomously discover issues, implement fixes, and submit high-quality pull requests to open-source projects — 24/7, without human intervention.

> **OpenClaw is the engine; ClawOSS is the race car.** We do not modify OpenClaw. We configure it — writing skills, workspace instructions, hooks, and monitoring — to produce the highest quality OSS contributions possible.

## System Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        OpenClaw Gateway                           │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Heartbeat   │  │  Cron Jobs   │  │  Agent (Kimi K2.5)       │ │
│  │  (10min)     │  │  (5 jobs)    │  │  via OpenRouter           │ │
│  │  lightCtx    │  │              │  │  15 Skills (10 custom +   │ │
│  │     5 superpowers)        │ │
│  └──────┬───────┘  └──────┬───────┘  │  9-Gate Quality System   │ │
│         │                 │          │  Memory Persistence      │ │
│         └────────┬────────┘          └────────────┬─────────────┘ │
│                  │                                │               │
└──────────────────┼────────────────────────────────┼───────────────┘
                   │                                │
          ┌────────▼────────┐              ┌────────▼────────┐
          │    GitHub API    │              │  Vercel Dashboard │
          │                  │              │  (Turso DB)       │
          │  - Fork repos    │              │  - Agent status   │
          │  - Create PRs    │              │  - PR tracker     │
          │  - Respond to    │              │  - Quality metrics│
          │    reviews       │              │  - Token/cost     │
          │  - Search issues │              │  - Activity logs  │
          └──────────────────┘              └───────────────────┘
```

## How It Works

ClawOSS uses a **v5 orchestrator + sub-agent architecture**: a persistent main session handles orchestration (heartbeat loop, work queue, PR follow-ups), while implementation tasks are delegated to fresh sub-agent sessions via `sessions_spawn` for zero cross-task context pollution.

The contribution pipeline follows a 9-phase loop driven by a 10-minute heartbeat cycle:

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ 1.       │──▶│ 2.       │──▶│ 3. Repo  │──▶│ 4.       │
│ Discover │   │ Triage   │   │ Analyze  │   │Implement │
└──────────┘   └──────────┘   └──────────┘   └────┬─────┘
                                                   │
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────▼─────┐
│ 8.       │◀──│ 7.       │◀──│ 6. Safety│◀──│ 5. Self  │
│ Follow-up│   │ Submit   │   │ Check    │   │ Review   │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
     │
┌────▼─────┐
│ 9.Context│
│ Manage   │
└──────────┘
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

## Features

- **Kimi K2.5 via OpenRouter** — Frontier-tier coding at competitive pricing ($0.45/MTok input, $2.20/MTok output)
- **Orchestrator + Sub-Agent Architecture** — Main session orchestrates, sub-agents implement in fresh contexts
- **15 Skills** — 10 custom pipeline skills + 5 OpenClaw superpowers (debugging, TDD, brainstorming, code review, verification)
- **7-Gate Quality System** — Scope, code quality, tests, security, anti-slop, git hygiene, PR template
- **Independent Review** — Isolated subagent reviews diffs with clean context (no implementation bias)
- **Anti-Spam Protections** — 3 PRs/repo/day, 10 total/day, 200 LOC max, 5 files max
- **Vercel Dashboard** — Real-time monitoring with Turso persistent database ([live](https://dashboard-plum-one-37.vercel.app))
- **5 Cron Jobs** — Issue discovery (2h), PR follow-up (30min), daily report, weekly retrospective, memory cleanup
- **Memory System** — Learns repo conventions, maintainer preferences, and strategies over time
- **Safety-First** — Never force-push, never push to main, never commit secrets, content filter protections
- **Verified Autonomous Loop** — Heartbeat + cron + sub-agent pipeline tested end-to-end

## Architecture

```
ClawOSS/
├── workspace/                  # OpenClaw workspace (symlinked to ~/.openclaw/workspace)
│   ├── AGENTS.md               # Core behavioral contract
│   ├── SOUL.md                 # Persona and boundaries
│   ├── HEARTBEAT.md            # Periodic work checklist
│   ├── skills/                 # 10 custom skills
│   │   ├── oss-discover/       # Find issues to work on
│   │   ├── oss-implement/      # Write code and tests
│   │   ├── oss-review/         # 7-gate self-review
│   │   ├── oss-submit/         # Create PRs with disclosure
│   │   ├── oss-followup/       # Respond to reviews
│   │   ├── oss-triage/         # Assess issue feasibility
│   │   ├── repo-analyzer/      # Understand repo conventions
│   │   ├── context-manager/    # Manage context window
│   │   ├── dashboard-reporter/ # Send metrics to dashboard
│   │   ├── safety-checker/     # Final pre-submit gate
│   │   ├── systematic-debugging/     # (superpowers) Root cause analysis
│   │   ├── test-driven-development/  # (superpowers) Red-Green-Refactor
│   │   ├── verification-before-completion/ # (superpowers) Final checks
│   │   ├── brainstorming/            # (superpowers) Design exploration
│   │   └── requesting-code-review/   # (superpowers) Code review workflow
│   ├── hooks/                  # OpenClaw event hooks (automatic)
│   │   ├── dashboard-reporter/ # Posts telemetry after each agent turn
│   │   └── audit-logger/       # Logs all actions to dashboard audit trail
│   └── memory/                 # Persistent agent memory
├── config/
│   ├── openclaw.json           # Gateway configuration (Kimi K2.5 via OpenRouter)
│   └── cron-jobs.json          # Scheduled job definitions (5 jobs)
├── dashboard/                  # Next.js 15 Vercel monitoring app (Turso DB)
├── issues/                     # Known issues and limitations tracker
├── research/                   # Architecture research and analysis docs
├── templates/                  # PR, commit, and issue templates
└── scripts/                    # Operational scripts
```

## GitHub Identity

ClawOSS operates under a dedicated GitHub account:

| Field | Value |
|-------|-------|
| **Account** | [@BillionClaw](https://github.com/BillionClaw) |
| **Email** | billionclaw+clawoss@users.noreply.github.com |
| **Token Scope** | `public_repo` (least privilege) |
| **Purpose** | Exclusively reserved for ClawOSS autonomous operations |

All PRs, commits, and issue interactions use this identity. The noreply email format avoids triggering OpenRouter's content filter (see `issues/007`). The account is authenticated interactively via `gh auth login` during setup — no tokens are stored in files.

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
| `npm run health` | Verify agent is running and healthy |
| `npm run validate` | Validate config files and skill definitions |
| `npm run dashboard:dev` | Run the monitoring dashboard locally |
| `npm run dashboard:build` | Build the dashboard for production |

## Custom Skills

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

### Superpowers Skills (OpenClaw built-in)

| Skill | Description |
|-------|-------------|
| **systematic-debugging** | Structured root cause analysis before proposing fixes |
| **test-driven-development** | Red-Green-Refactor cycle for implementation |
| **verification-before-completion** | Final checks before claiming work is done |
| **brainstorming** | Collaborative design exploration before implementation |
| **requesting-code-review** | Structured approach to requesting and incorporating reviews |

## Event Hooks

Hooks run automatically on OpenClaw events (unlike skills, which are invoked by the agent):

| Hook | Events | Description |
|------|--------|-------------|
| **dashboard-reporter** | `agent_end`, `after_tool_call` | Posts heartbeats, token metrics, and conversation messages to the dashboard after each agent turn |
| **audit-logger** | `command:new`, `agent_end`, `after_tool_call` | Logs all agent actions to the dashboard audit trail for debugging |

Both hooks are fire-and-forget with 10s timeouts — they never block agent work.

## Quality Gates

Every PR passes 7 gates before submission (plus 2 safety gates):

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

## Configuration

### openclaw.json

Key settings in `config/openclaw.json`:

| Setting | Value | Why |
|---------|-------|-----|
| Primary model | `openrouter/moonshotai/kimi-k2.5` | Frontier coding via OpenRouter ($0.45/MTok in, $2.20/MTok out) |
| Fallback models | `[]` (none) | Prevents silent fallback to expensive Anthropic models |
| Heartbeat interval | 10 minutes | Fast autonomous loop cycling; cheap with lightContext |
| Heartbeat model | `openrouter/moonshotai/kimi-k2.5` | Same model for consistency ($0.45/MTok input) |
| Heartbeat lightContext | `true` | Minimal context load; HEARTBEAT.md embeds safety rules |
| Compaction mode | `safeguard` | Triggers compaction at context capacity |
| Compaction memory flush | Enabled at 150K tokens | Pre-compaction state preservation |
| Post-compaction sections | Architecture, Safety, Context Rot | Key sections preserved after compaction |
| Tool profile | `coding` | Full filesystem + runtime access |
| Sub-agent concurrency | 1 | Serialized execution, one implementation at a time |
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

| Job | Schedule | Session | Purpose |
|-----|----------|---------|---------|
| work-queue-refill | Every 2h | Isolated | Discover and score candidate issues, write to staging file |
| pr-followup-scan | Every 30min | Main | Check open PRs for review comments and CI status |
| daily-report | 11pm daily | Isolated | Compile daily metrics and cost-per-merged-PR |
| weekly-retrospective | Monday 9am | Isolated | Analyze acceptance rates, adjust strategy |
| memory-cleanup | Sunday 3am | Isolated | Archive stale memory, prune expired queue items |

## Dashboard

**Live:** [dashboard-plum-one-37.vercel.app](https://dashboard-plum-one-37.vercel.app)

The Next.js 15 Vercel dashboard provides real-time monitoring backed by a Turso (SQLite edge) database (`clawoss-cmlkevin.aws-us-east-1.turso.io`):

- **Overview** — Agent status, key metrics, activity timeline, current task
- **PR Tracker** — All submitted PRs with status, quality scores, review state
- **Health** — Token usage, cost tracking, heartbeat status, error rates
- **Quality** — Quality score trends, by-repo breakdown, rejection analysis
- **Logs** — Filterable log stream with infinite scroll
- **Live Feed** — Real-time conversation stream with session picker and auto-scroll
- **Settings** — Target repos, quality thresholds, notification config

Tech stack: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts, Drizzle ORM, Turso, SWR.

Deploy to Vercel:

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

## Operational Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `setup.sh` | `npm run setup` | Configure git identity (BillionClaw), authenticate gh, link workspace, copy config |
| `start.sh` | `npm run start` | Register all 5 cron jobs, start OpenClaw gateway in daemon mode |
| `stop.sh` | `npm run stop` | Graceful gateway shutdown |
| `health-check.sh` | `npm run health` | Verify gateway running, gh authenticated, workspace linked, cron registered |
| `backup-workspace.sh` | — | Commit agent memory state to git |
| `rotate-logs.sh` | — | Remove log files older than 14 days |

## Realistic Expectations

ClawOSS is honest about what autonomous AI contribution can achieve today. The primary metric is **merged PRs per day with >70% acceptance rate and <$2/merged PR** — not commits per hour (see `issues/010`).

### Expected Throughput

| Phase | Timeline | Target |
|-------|----------|--------|
| Calibration | Week 1-2 | 1-2 merged PRs/day, tuning acceptance rate |
| Ramp | Week 3-4 | 3-5 merged PRs/day on curated repos |
| Steady state | Month 2+ | 5-10 merged PRs/day, >70% acceptance rate |
| Aspirational | Month 3+ | 10-15 merged PRs/day with multi-repo pipelining |

### Cost Projections (Kimi K2.5 via OpenRouter)

| Scenario | Daily Cost | Monthly Cost |
|----------|-----------|--------------|
| Moderate (2-3 PRs/day) | $2-5 | $60-150 |
| High (5+ PRs/day) | $5-15 | $150-450 |
| With retries/failures (2x) | $10-25 | $300-750 |

### Merge Rates by Task Type

| Task Type | Merge Rate |
|-----------|-----------|
| Documentation / CI / deps | 40-60% |
| Simple bug fixes | 20-30% |
| Feature additions | 10-20% |
| Complex refactors | 5-10% |

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

## Safety & Ethics

ClawOSS is designed to be a **good citizen** of the open-source ecosystem:

- **AI Disclosure** — Every PR includes a notice that it was AI-generated
- **Anti-Spam** — Hard limits prevent flooding repos with low-quality PRs
- **Respect** — Reads CONTRIBUTING.md, follows repo conventions, stays in lane
- **Graceful** — Closes PRs politely on rejection, never argues with maintainers
- **Least Privilege** — Uses `public_repo` token scope, sandboxed execution
- **Transparent** — All agent actions are logged and visible on the dashboard

## Known Issues

See the [`issues/`](issues/) directory for detailed tracking. Summary:

| # | Issue | Status |
|---|-------|--------|
| 001 | OpenRouter content filter causes 403 loops with PII content | **Mitigated** (safety rules) |
| 002 | Stale agent processes hold session locks | Open |
| 003 | Symlinked skills get "outside root" warnings | Open |
| 004 | Sessions can exceed model context window (262K for K2.5) | Open (mitigated) |
| 005 | Model fallback to expensive Anthropic APIs | **Fixed** (`fallbacks: []`) |
| 006 | Sub-agent attachments disabled by default | **Fixed** (`tools.sessions_spawn.attachments.enabled`) |
| 007 | Git email triggers content filter | **Fixed** (noreply format) |
| 008 | Cron jobs need isolated sessions | **Fixed** (session targeting) |
| 009 | Heartbeat cost optimization | **Fixed** (lightContext + K2.5 + 10min) |
| 010 | Throughput expectations reframed | Acknowledged |
| 011 | oss-review referenced Haiku/Sonnet for review | **Fixed** (model-agnostic wording) |
| 012 | safety-checker referenced "Sonnet subagent" | **Fixed** (model-agnostic wording) |
| 013 | TOOLS.md had 500 LOC limit vs 200 everywhere else | **Fixed** (standardized to 200) |
| 014 | start.sh ignores sessionTarget from cron config | Open |
| 015 | Dashboard reporter uses hardcoded URL fallback | **Fixed** (now uses env var) |
| 016 | Dashboard Live Feed page not documented | Open (documented now) |
| 017 | Dashboard cost model uses wrong model ID key | **Fixed** (updated to K2.5) |
| 018 | .env contains real API keys | Open (CRITICAL) |
| 019 | .env missing DASHBOARD_URL and CLAW_API_KEY | Open |
| 020 | OpenClaw hooks not documented | Open (documented now) |
| 021 | Model switch from M2.5 to Kimi K2.5 | **Completed** (config + dashboard + docs) |
| 022 | 4x-game-agent repo in workspace undocumented | Open |
| 023 | oss-implement skill exceeded 2000 char limit after rewrite | **Fixed** (3605 -> 1895 chars) |
| 024 | Invalid openclaw.json schema — many guessed config keys | **Fixed** (validated via DeepWiki) |
| 025 | Gateway restart interrupts active agent turns (SIGTERM) | Known (minimize restarts) |

## Contributing

Contributions welcome! Please read the existing workspace files and skills to understand the architecture before submitting changes.

## License

MIT License. See [LICENSE](LICENSE).
