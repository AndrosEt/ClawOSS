# Changelog

All notable changes to the ClawOSS project documented chronologically.

## 2026-03-16 — Initial Build Session

### Phase 1: Project Scaffold and Workspace

- **Initialize project scaffold** — `package.json`, `.gitignore`, `LICENSE` (MIT)
- **Create OpenClaw workspace files** — `AGENTS.md` (behavioral contract), `SOUL.md` (persona), `USER.md` (operator profile), `IDENTITY.md`, `TOOLS.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`
- **Create gateway configuration** — `config/openclaw.json` (initially with Claude Sonnet), `config/cron-jobs.json` (5 cron jobs)
- **Create templates** — `templates/pr-template.md`, `templates/commit-conventions.md`, `templates/issue-response-template.md`

### Phase 2: Custom Skills

- **Create all 10 skills** — `oss-discover`, `oss-implement`, `oss-review`, `oss-submit`, `oss-followup`, `oss-triage`, `repo-analyzer`, `context-manager`, `dashboard-reporter`, `safety-checker`
- All skills include YAML frontmatter with name and description
- All skills under the 2000-character limit for prompt space

### Phase 3: Operational Scripts

- **`scripts/setup.sh`** — Configure git identity (BillionClaw), authenticate gh, link workspace, copy config, register agent, symlink skills
- **`scripts/start.sh`** — Register cron jobs, start OpenClaw gateway
- **`scripts/stop.sh`** — Graceful gateway shutdown
- **`scripts/health-check.sh`** — Verify gateway, gh auth, workspace, cron status
- **`scripts/backup-workspace.sh`** — Commit memory state to git
- **`scripts/rotate-logs.sh`** — Remove logs older than 14 days
- **`scripts/validate-config.mjs`** — Validate JSON configs, workspace files, skills, scripts

### Phase 4: GitHub Identity

- **Configure BillionClaw** as exclusive GitHub identity
- Apply identity across all workspace files and scripts
- Switch to interactive `gh auth login` (removed PAT-from-file pattern)
- Set git email to `billionclaw+clawoss@users.noreply.github.com` (noreply format to avoid content filter)

### Phase 5: Quality Refinements (Devil's Advocate)

- Apply quality gate refinements from `research/04-devils-advocate.md`
- Add anti-slop instructions to AGENTS.md
- Strengthen safety defaults and anti-spam protections

### Phase 6: Model Switch to Minimax M2.5

- **Switch primary model** from `claude-sonnet-4-6` to `openrouter/minimax/minimax-m2.5`
- 80.2% SWE-bench Verified at 11x cheaper input tokens
- Update all config files and scripts for OpenRouter routing
- **Disable model fallback** (`fallbacks: []`) to prevent silent Anthropic cost spikes
- Fix OpenRouter content filter issues (email/phone replacement with `[EMAIL]`/`[PHONE]`)

### Phase 7: Dashboard

- **Initialize Next.js 15 dashboard** with shadcn/ui, Tailwind CSS, Recharts
- **Set up Turso database** with Drizzle ORM schema (heartbeats, PRs, metrics, logs tables)
- **Create API routes** — ingest (heartbeat, metrics, logs), GitHub sync, PR queries, metrics, settings
- **Create SWR data hooks** for real-time dashboard updates
- **Build 6 dashboard pages** — Overview, PRs, Health, Quality, Logs, Settings
- **Deploy to Vercel** at `dashboard-plum-one-37.vercel.app`

### Phase 8: Throughput Architecture v5

- **Research and design** throughput architecture (`research/06-throughput-architecture.md`, `research/07-throughput-critique.md`)
- **Reframe metrics** from "commits/hour" to "merged PRs/day with >70% acceptance rate"
- **Implement orchestrator + sub-agent pattern** — main session orchestrates, sub-agents implement in fresh contexts
- **Rewrite HEARTBEAT.md** — 6-step autonomous work loop with circuit breakers, staging files, sub-agent spawning
- **Rewrite AGENTS.md** — orchestrator + sub-agent architecture documentation
- **Redesign cron jobs** — more frequent scanning (30min PR, 2h discovery), isolated sessions for all non-main jobs
- **Create memory file templates** — `wake-state.md`, `pipeline-state.md`, `work-queue.md`
- **Reduce heartbeat interval** to 10 minutes with `lightContext: true`
- **Verify autonomous loop** — heartbeat + cron + sub-agent pipeline confirmed working end-to-end

### Phase 9: Bug Fixes

- **Fix sessions_spawn attachments** — enable `tools.sessions_spawn.attachments.enabled: true` for sub-agent context passing
- **Fix model fallback** — set `fallbacks: []` to prevent expensive Anthropic API calls
- **Fix content filter** — switch to noreply email format
- **Fix cron session targeting** — use isolated sessions for non-orchestrator jobs
- **Fix skill path resolution** — add symlink creation in setup.sh
- **Sync repo config with live config** — apply all throughput optimizations discovered during live testing

### Phase 10: Documentation

- **Comprehensive README** with architecture diagrams, 9-phase loop, configuration tables
- **Update README** to reflect actual implementation (M2.5, 10min heartbeat, v5 architecture, dashboard URL)
- **CI/CD workflows** — validation and dashboard deployment GitHub Actions
- **Create issues directory** — 10 issue files covering all known bugs, limitations, and fixes
- **Post-Implementation Notes** added to implementation plan documenting all deviations
- **This CHANGELOG**

### Phase 11: Post-Build Fixes (ongoing)

- **Content filter 403 loop prevention** — Added safety rules to AGENTS.md, HEARTBEAT.md, and oss-discover to prevent PII content from poisoning sessions (commit `6a84563`)
- **Stale model references fixed** — Removed Haiku/Sonnet references from oss-review and safety-checker skills
- **TOOLS.md line limit fixed** — Changed from 500 to 200 to match all other files
- **Dashboard Live Feed documented** — Added `/live` page to README
- **Dashboard URL updated** — Deployed at `dashboard-plum-one-37.vercel.app`
- **20 issues tracked** — 10 fixed, 10 open (1 critical: .env secrets)
- **OpenClaw hooks documented** — Added dashboard-reporter and audit-logger hooks to README (issue #020)

### Phase 12: Model Switch to Kimi K2.5

- **Switch primary model** from `openrouter/minimax/minimax-m2.5` to `openrouter/moonshotai/kimi-k2.5`
- Moonshot Kimi K2.5: 76.8% SWE-bench Verified, $0.45/MTok input, $2.20/MTok output, 262K context
- Updated all 4 model references in `config/openclaw.json` (defaults.model, subagents, agent, heartbeat)
- Context window increased from 196K to 262K tokens — reduces overflow risk (issue #004)
- Native multimodal and agentic tool-calling capabilities
- **4x-game-agent fork added** — `BillionClaw/4x-game-agent` (fork of `sonpiaz/4x-game-agent`) placed in `workspace/` as first contribution target
- **oss-implement rewritten** — Reproduce-first TDD workflow (reproduce bug -> failing test -> minimal fix -> verify -> evidence PR)
- **5 superpowers skills added** — systematic-debugging, test-driven-development, verification-before-completion, brainstorming, requesting-code-review
- **HEARTBEAT.md refined** — Context check split into 0a (Context Health) and 0b (Circuit Breakers)
- **oss-implement char limit fix** — Condensed from 3605 to 1895 chars (under 2000 limit)
- **Dashboard URL updated** — Canonical URL is `dashboard-plum-one-37.vercel.app` (Turso DB at `clawoss-cmlkevin.aws-us-east-1.turso.io`)
- **All dashboard URL references updated** — README, hooks, skill, .env.example, issues
- **Stall recovery added** — HEARTBEAT.md step 1 detects stuck sub-agents, kills and re-queues
- **Agent ALIVE** — Discovered 15 issues, spawned first sub-agent for `Nexal-AI/voicecrew#10`
- **25 issues tracked** — 14 fixed, 1 mitigated, 8 open, 1 known, 1 informational

### Research Documents Created

| Document | Content |
|----------|---------|
| `research/01-extension-points.md` | OpenClaw extension and modification potentials |
| `research/02-repo-knowledge.md` | Deep dive into OpenClaw repo via DeepWiki |
| `research/03-technical-architecture.md` | Full technical architecture design |
| `research/04-devils-advocate.md` | Quality risks, limitations, throughput reality check |
| `research/05-dashboard-design.md` | Vercel monitoring dashboard design |
| `research/06-throughput-architecture.md` | v5 throughput architecture with orchestrator pattern |
| `research/07-throughput-critique.md` | Throughput critique — why commits/hour is wrong |
| `research/08-openclaw-complete-reference.md` | Complete OpenClaw configuration reference |
