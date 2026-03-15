# ClawOSS

**The best OpenClaw agent configuration for autonomous open-source contribution.**

ClawOSS configures an [OpenClaw](https://github.com/openclaw/openclaw) agent to autonomously discover issues, implement fixes, and submit high-quality pull requests to open-source projects — 24/7, without human intervention.

> **OpenClaw is the engine; ClawOSS is the race car.** We do not modify OpenClaw. We configure it — writing skills, workspace instructions, hooks, and monitoring — to produce the highest quality OSS contributions possible.

## How It Works

```
Heartbeat (every 60min)
  |
  v
Check active PRs ──> Follow up on reviews
  |
  v
Discover new work ──> Triage & prioritize
  |
  v
Analyze repo ──> Implement fix ──> Self-review (7 gates)
  |                                      |
  v                                      v
Safety check ──> Submit PR ──> Report to dashboard
```

ClawOSS operates through a continuous loop driven by OpenClaw's heartbeat system and cron jobs:

1. **Discover** — Search GitHub for `good-first-issue`, `help-wanted`, and `bug` labels
2. **Analyze** — Clone repo, read CONTRIBUTING.md, detect tech stack and conventions
3. **Implement** — Create branch, write code matching repo style, add tests
4. **Self-Review** — 7-gate quality check with isolated subagent review
5. **Submit** — Push to fork, create PR with AI disclosure
6. **Follow Up** — Respond to review feedback (max 3 rounds)
7. **Report** — Send metrics to the Vercel monitoring dashboard

## Features

- **10 Custom Skills** — Purpose-built for the OSS contribution pipeline
- **7-Gate Quality System** — Scope, code quality, tests, security, anti-slop, git hygiene, PR template
- **Independent Review** — Isolated subagent reviews diffs with clean context (no implementation bias)
- **Anti-Spam Protections** — 3 PRs/repo/day, 10 total/day, 200 LOC max, 5 files max
- **Vercel Dashboard** — Real-time monitoring of agent status, PRs, quality metrics, costs
- **5 Cron Jobs** — Daily discovery, PR follow-up, daily report, weekly retrospective, memory cleanup
- **Memory System** — Learns repo conventions, maintainer preferences, and strategies over time
- **Safety-First** — Never force-push, never push to main, never commit secrets, sandboxed execution

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
│   │   └── safety-checker/     # Final pre-submit gate
│   └── memory/                 # Persistent agent memory
├── config/
│   ├── openclaw.json           # Gateway configuration
│   └── cron-jobs.json          # Scheduled job definitions
├── dashboard/                  # Next.js 15 Vercel monitoring app
├── templates/                  # PR, commit, and issue templates
└── scripts/                    # Operational scripts
```

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
| **oss-implement** | Implement changes: branch, code, tests, lint — matching repo style |
| **oss-review** | 7-gate quality check with isolated subagent for independent review |
| **oss-submit** | Submit PRs via fork with AI disclosure notice |
| **oss-followup** | Respond to review feedback (max 3 revision rounds) |
| **oss-triage** | Assess issue feasibility, complexity, and success probability |
| **repo-analyzer** | Detect tech stack, code style, test framework, CI system |
| **context-manager** | Manage context window, flush state before compaction |
| **dashboard-reporter** | Send heartbeat and event telemetry to Vercel dashboard |
| **safety-checker** | Final gate: budget, diff size, secrets, spam limits, independent review |

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
| Primary model | `claude-sonnet-4-6` | Best cost-to-quality ratio for routine work |
| Fallback model | `claude-haiku-4-5` | Rate limit fallback |
| Heartbeat interval | 60 minutes | Balance responsiveness with cost |
| Heartbeat model | `claude-haiku-4-5` | Cheap routine checks |
| Compaction target | 500K tokens | Preserve context across long sessions |
| Tool profile | `coding` | Full filesystem + runtime access |
| Sandbox | Enabled | Protect host from arbitrary repo code |
| Session reset | Daily at 4am | Fresh context each day |

### Cron Jobs

| Job | Schedule | Model | Purpose |
|-----|----------|-------|---------|
| daily-discovery | 8am daily | Sonnet | Comprehensive issue search |
| pr-followup-check | Every 4h | Main session | Check review comments and CI |
| daily-report | 11pm daily | Haiku | Compile daily metrics |
| weekly-retrospective | Monday 9am | Opus | Analyze patterns, update strategy |
| memory-cleanup | Sunday 3am | Haiku | Archive old memory files |

## Dashboard

The Vercel dashboard provides real-time monitoring:

- **Overview** — Agent status, key metrics, activity timeline, current task
- **PR Tracker** — All submitted PRs with status, quality scores, review state
- **Health** — Token usage, cost tracking, heartbeat status, error rates
- **Quality** — Quality score trends, by-repo breakdown, rejection analysis
- **Logs** — Filterable log stream with infinite scroll
- **Settings** — Target repos, quality thresholds, notification config

Deploy to Vercel:

```bash
cd dashboard
npx vercel --prod
```

Required environment variables (set in Vercel dashboard):

- `TURSO_DATABASE_URL` — Turso SQLite database URL
- `TURSO_AUTH_TOKEN` — Turso auth token
- `GITHUB_TOKEN` — GitHub PAT for PR sync
- `CLAW_AGENT_USERNAME` — Agent's GitHub username (BillionClaw)
- `CLAW_API_KEY` — Shared secret for agent-to-dashboard auth

## Realistic Expectations

ClawOSS is honest about what autonomous AI contribution can achieve today.

### Expected Throughput

- **5-15 merged PRs per month** in steady state
- **$200-500/month** in API costs
- **20-30% overall merge rate** (higher for docs, lower for code changes)

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

## Safety & Ethics

ClawOSS is designed to be a **good citizen** of the open-source ecosystem:

- **AI Disclosure** — Every PR includes a notice that it was AI-generated
- **Anti-Spam** — Hard limits prevent flooding repos with low-quality PRs
- **Respect** — Reads CONTRIBUTING.md, follows repo conventions, stays in lane
- **Graceful** — Closes PRs politely on rejection, never argues with maintainers
- **Least Privilege** — Uses `public_repo` token scope, sandboxed execution
- **Transparent** — All agent actions are logged and visible on the dashboard

## Contributing

Contributions welcome! Please read the existing workspace files and skills to understand the architecture before submitting changes.

## License

MIT License. See [LICENSE](LICENSE).
