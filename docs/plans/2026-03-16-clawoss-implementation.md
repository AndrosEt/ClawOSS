# ClawOSS Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete ClawOSS project — the best possible OpenClaw agent configuration for autonomous OSS development, with custom skills, workspace configs, operational scripts, Vercel monitoring dashboard, documentation, and CI/CD.

**Architecture:** ClawOSS is a standalone repo containing an OpenClaw workspace configuration (AGENTS.md, SOUL.md, skills, hooks), gateway config (openclaw.json), launch/management scripts, a Next.js 15 Vercel dashboard for monitoring, and comprehensive docs. It does NOT modify OpenClaw — it uses OpenClaw's native extension points (skills, heartbeat, cron, hooks, plugins).

**Tech Stack:** OpenClaw (runtime), Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts, Drizzle ORM, Turso (SQLite edge DB), Octokit, SWR, Vercel (hosting + cron)

---

## Chunk 1: Project Scaffold and Workspace Configuration

### Task 1: Initialize project structure and root files

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `.gitignore`
- Create: `package.json` (root workspace)
- Create: `.github/workflows/validate.yml`
- Create: `.github/workflows/deploy-dashboard.yml`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "clawoss",
  "version": "0.1.0",
  "private": true,
  "description": "The best OpenClaw agent configuration for autonomous OSS development",
  "workspaces": ["dashboard"],
  "scripts": {
    "setup": "bash scripts/setup.sh",
    "start": "bash scripts/start.sh",
    "stop": "bash scripts/stop.sh",
    "health": "bash scripts/health-check.sh",
    "dashboard:dev": "cd dashboard && npm run dev",
    "dashboard:build": "cd dashboard && npm run build",
    "validate": "node scripts/validate-config.mjs"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/billion-token-one-task/ClawOSS.git"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```gitignore
node_modules/
.next/
.env
.env.local
.env.production
*.log
.DS_Store
dist/
.turbo/
config/auth-profiles.json
```

- [ ] **Step 3: Create LICENSE (MIT)**

Standard MIT license with "ClawOSS Contributors" as copyright holder.

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore LICENSE
git commit -m "chore: initialize ClawOSS project scaffold"
```

### Task 2: Create OpenClaw workspace configuration files

**Files:**
- Create: `workspace/AGENTS.md`
- Create: `workspace/SOUL.md`
- Create: `workspace/USER.md`
- Create: `workspace/IDENTITY.md`
- Create: `workspace/TOOLS.md`
- Create: `workspace/HEARTBEAT.md`
- Create: `workspace/BOOTSTRAP.md`
- Create: `workspace/MEMORY.md`

- [ ] **Step 1: Create AGENTS.md**

Use the full content from `research/03-technical-architecture.md` Section 2.1 — the complete behavioral contract including: Prime Directive, Session Start Checklist, Safety Defaults (never push to main, never force-push, never commit secrets, max 3 PRs/repo/day, max 500 lines), Work Discovery Priority, Quality Standards, Memory Management, Context Window Management, Failure Handling, Anti-Spam Protections.

- [ ] **Step 2: Create SOUL.md**

Use content from architecture Section 2.2 — Identity (diligent OSS contributor), Tone (professional, humble, technical, no buzzwords, no emojis), Boundaries (no social interaction, always disclose AI, stay in lane), Continuity (read/write memory files).

- [ ] **Step 3: Create USER.md**

```markdown
# Operator Profile

The operator is a developer who has set up ClawOSS to autonomously contribute
to open-source projects. They monitor the agent via the Vercel dashboard and
review its output periodically.

## Preferences
- Quality over quantity — always
- Start small: documentation and simple fixes first
- Earn trust with each repository incrementally
- Report status to the dashboard on every heartbeat
```

- [ ] **Step 4: Create IDENTITY.md**

```markdown
# ClawOSS Identity

- **Name:** ClawOSS
- **Role:** Autonomous open-source contributor
- **Powered by:** OpenClaw
- **GitHub:** @clawoss-bot (or operator's configured bot account)
```

- [ ] **Step 5: Create TOOLS.md**

```markdown
# Tool Conventions

## Required Binaries
- `git` — version control
- `gh` — GitHub CLI (authenticated)
- `node` / `npm` — Node.js runtime
- `curl` — HTTP requests to dashboard API

## Common Commands
- `gh issue list --label="good-first-issue" --state=open` — find issues
- `gh pr create --title "..." --body "..."` — submit PRs
- `gh pr list --author @me` — check own PRs
- `git diff --stat` — verify diff size before submission

## Safety Rules
- Always use `gh pr create`, never `git push` to main
- Always run the target repo's test suite before submitting
- Always check diff size: reject if >500 lines changed
```

- [ ] **Step 6: Create HEARTBEAT.md**

Use content from architecture Section 2.3 — the 5-step heartbeat checklist: check active PRs, check CI status, find new work, report to dashboard, memory maintenance. Include "If nothing needs attention: HEARTBEAT_OK".

- [ ] **Step 7: Create BOOTSTRAP.md**

```markdown
# First-Run Bootstrap

Welcome to ClawOSS! On your first run:

1. Verify GitHub CLI is authenticated: `gh auth status`
2. Verify dashboard URL is reachable: `curl -s $DASHBOARD_URL/api/health`
3. Read AGENTS.md, SOUL.md, and USER.md thoroughly
4. Write initial memory entry to memory/YYYY-MM-DD.md: "ClawOSS initialized"
5. Report first heartbeat to dashboard
6. Begin work discovery with oss-discover skill

This file will be deleted after first run.
```

- [ ] **Step 8: Create MEMORY.md**

```markdown
# ClawOSS Long-Term Memory

## Learned Repository Conventions
<!-- Updated by the agent as it learns repo-specific patterns -->

## Maintainer Preferences
<!-- Updated when maintainer feedback is received -->

## Strategies That Work
<!-- Updated after successful merges -->

## Strategies That Failed
<!-- Updated after rejections -->
```

- [ ] **Step 9: Create memory/ directory with placeholder**

```bash
mkdir -p workspace/memory
touch workspace/memory/.gitkeep
```

- [ ] **Step 10: Commit**

```bash
git add workspace/
git commit -m "feat: add OpenClaw workspace configuration files"
```

### Task 3: Create openclaw.json gateway configuration

**Files:**
- Create: `config/openclaw.json`
- Create: `config/cron-jobs.json`
- Create: `config/.gitkeep`

- [ ] **Step 1: Create openclaw.json**

Use the full JSON5 config from architecture Section 2.4. Key settings: Sonnet 4.6 primary, Haiku fallback, 30min heartbeat, coding tool profile, sandbox enabled, skill watch enabled, structured logging, session daily reset at 4am, OTel diagnostics to dashboard.

- [ ] **Step 2: Create cron-jobs.json**

Use the 5 cron job definitions from architecture Section 2.5: daily-discovery (8am, Sonnet), pr-followup-check (every 4h, main session), daily-report (11pm, Haiku), weekly-retrospective (Monday 9am, Opus), memory-cleanup (Sunday 3am, Haiku).

- [ ] **Step 3: Commit**

```bash
git add config/
git commit -m "feat: add OpenClaw gateway and cron configuration"
```

### Task 4: Create PR and commit templates

**Files:**
- Create: `templates/pr-template.md`
- Create: `templates/commit-conventions.md`
- Create: `templates/issue-response-template.md`

- [ ] **Step 1: Create pr-template.md**

Use the PR template from architecture Section 5.4 — Summary, Changes, Testing checklist, Related Issues, AI Disclosure notice.

- [ ] **Step 2: Create commit-conventions.md**

Use conventions from architecture Section 5.3 — Conventional Commits format, type list, examples.

- [ ] **Step 3: Create issue-response-template.md**

```markdown
Thank you for reporting this issue. I've identified a potential fix and
submitted PR #{pr_number} to address it.

**Changes:**
{changes_summary}

**Testing:**
{testing_notes}

This contribution was generated by [ClawOSS](https://github.com/billion-token-one-task/ClawOSS),
an autonomous AI contributor. Please review the PR with the same rigor as
any human contribution.
```

- [ ] **Step 4: Commit**

```bash
git add templates/
git commit -m "feat: add PR, commit, and issue response templates"
```

---

## Chunk 2: Custom Skills

### Task 5: Create oss-discover skill

**Files:**
- Create: `workspace/skills/oss-discover/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

Use the skill definition from architecture Appendix A (oss-discover). Frontmatter: name, description, user-invocable: true. Body: process (query GitHub, filter, score, rank), commands (gh search issues), anti-spam checks.

Keep under 2000 characters total (skill prompt limit constraint from devil's advocate).

- [ ] **Step 2: Commit**

```bash
git add workspace/skills/oss-discover/
git commit -m "feat: add oss-discover skill for work discovery"
```

### Task 6: Create oss-implement skill

**Files:**
- Create: `workspace/skills/oss-implement/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

Use definition from architecture Appendix A (oss-implement). Prerequisites, 9-step process (read issue, explore code, plan minimal changes, implement, add tests, lint, test, handle failures, commit), constraints (500 LOC, 10 files, match style).

- [ ] **Step 2: Commit**

```bash
git add workspace/skills/oss-implement/
git commit -m "feat: add oss-implement skill for code implementation"
```

### Task 7: Create oss-review skill (self-review with anti-slop)

**Files:**
- Create: `workspace/skills/oss-review/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

```yaml
---
name: oss-review
description: "Pre-submission self-review: run git diff, check all 7 quality gates (scope, code quality, tests, security, anti-slop, git hygiene, PR template). Fail fast on any gate violation."
user-invocable: true
---
```

Body: Reference the 7-gate checklist from architecture Section 4.1. Emphasize anti-slop filter: no unnecessary comments, no over-engineered abstractions, no AI markers in code, no helper functions used once, variable names match repo conventions.

Include instruction to spawn a review subagent with a different model for independent review (devil's advocate recommendation).

- [ ] **Step 2: Commit**

```bash
git add workspace/skills/oss-review/
git commit -m "feat: add oss-review skill with 7-gate quality check"
```

### Task 8: Create oss-submit skill

**Files:**
- Create: `workspace/skills/oss-submit/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

Process: push branch to fork, create PR with `gh pr create`, use repo's PR template or our template, add AI disclosure notice, log submission to memory, report to dashboard. Include fork vs direct push decision tree from architecture Section 5.6.

- [ ] **Step 2: Commit**

```bash
git add workspace/skills/oss-submit/
git commit -m "feat: add oss-submit skill for PR submission"
```

### Task 9: Create oss-followup skill

**Files:**
- Create: `workspace/skills/oss-followup/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

Process from architecture Section 3.2 Phase 7: read review comments, categorize (changes requested / questions / approval / rejection), implement fixes (max 2 attempts), post responses, update memory. Include the review response workflow from Section 5.5.

- [ ] **Step 2: Commit**

```bash
git add workspace/skills/oss-followup/
git commit -m "feat: add oss-followup skill for PR review responses"
```

### Task 10: Create oss-triage skill

**Files:**
- Create: `workspace/skills/oss-triage/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

```yaml
---
name: oss-triage
description: "Triage GitHub issues: assess feasibility, estimate complexity, check for duplicates, evaluate if issue matches agent capabilities. Used during daily discovery cron."
user-invocable: true
---
```

Process: read issue body, check labels, assess complexity (simple/medium/complex), check memory for similar past issues, estimate success probability, recommend action (attempt / skip / defer).

- [ ] **Step 2: Commit**

```bash
git add workspace/skills/oss-triage/
git commit -m "feat: add oss-triage skill for issue assessment"
```

### Task 11: Create repo-analyzer skill

**Files:**
- Create: `workspace/skills/repo-analyzer/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

Use Phase 3 from architecture Section 3.2: clone repo, read CONTRIBUTING.md/CODE_OF_CONDUCT.md/.github/PULL_REQUEST_TEMPLATE.md, detect tech stack, detect code style, detect test framework, detect CI, check memory cache, store analysis.

- [ ] **Step 2: Commit**

```bash
git add workspace/skills/repo-analyzer/
git commit -m "feat: add repo-analyzer skill for codebase analysis"
```

### Task 12: Create context-manager skill

**Files:**
- Create: `workspace/skills/context-manager/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

Use Phase 9 from architecture Section 3.2: monitor context usage, flush state to memory at 80%, write work-in-progress summary, trigger compaction, re-read memory after compaction, clean up between tasks.

Mark as `disable-model-invocation: true` — only invoked explicitly to save prompt space (devil's advocate constraint).

- [ ] **Step 2: Commit**

```bash
git add workspace/skills/context-manager/
git commit -m "feat: add context-manager skill for context window management"
```

### Task 13: Create dashboard-reporter skill

**Files:**
- Create: `workspace/skills/dashboard-reporter/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

Use the definition from architecture Appendix A (dashboard-reporter). Endpoints, when to report, payload format. Reference the heartbeat JSON schema from architecture Section 6.2 and event stream from Section 6.3.

Mark as `disable-model-invocation: false` — needs to be available for heartbeat calls.

- [ ] **Step 2: Commit**

```bash
git add workspace/skills/dashboard-reporter/
git commit -m "feat: add dashboard-reporter skill for metrics reporting"
```

### Task 14: Create safety-checker skill

**Files:**
- Create: `workspace/skills/safety-checker/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

```yaml
---
name: safety-checker
description: "Final safety gate before PR submission: verify diff size <500 LOC, no secrets, no force-push commands, branch naming correct, anti-spam limits not exceeded. Abort if any check fails."
user-invocable: true
---
```

Checks: diff size (`git diff --stat`), secret scan (grep for API keys, tokens, passwords), branch name format, submission count today (from memory), CI status of target repo. This is the LAST gate before `oss-submit`.

- [ ] **Step 2: Commit**

```bash
git add workspace/skills/safety-checker/
git commit -m "feat: add safety-checker skill as final pre-submission gate"
```

---

## Chunk 3: Operational Scripts

### Task 15: Create setup, start, stop, and health-check scripts

**Files:**
- Create: `scripts/setup.sh`
- Create: `scripts/start.sh`
- Create: `scripts/stop.sh`
- Create: `scripts/health-check.sh`
- Create: `scripts/backup-workspace.sh`
- Create: `scripts/rotate-logs.sh`

- [ ] **Step 1: Create setup.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== ClawOSS Setup ==="

# Check prerequisites
command -v openclaw >/dev/null 2>&1 || { echo "Error: openclaw CLI not found. Install from https://github.com/openclaw/openclaw"; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "Error: gh CLI not found. Install from https://cli.github.com"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node not found"; exit 1; }

# Check gh auth
gh auth status || { echo "Error: gh not authenticated. Run 'gh auth login'"; exit 1; }

# Create workspace symlink
WORKSPACE_DIR="$HOME/.openclaw/workspace"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -L "$WORKSPACE_DIR" ]; then
    echo "Workspace symlink already exists"
elif [ -d "$WORKSPACE_DIR" ]; then
    echo "Warning: $WORKSPACE_DIR exists and is a directory. Backing up..."
    mv "$WORKSPACE_DIR" "${WORKSPACE_DIR}.backup.$(date +%Y%m%d%H%M%S)"
fi

ln -sf "$PROJECT_DIR/workspace" "$WORKSPACE_DIR"
echo "Linked workspace: $WORKSPACE_DIR -> $PROJECT_DIR/workspace"

# Copy config (don't symlink — needs local customization)
mkdir -p "$HOME/.openclaw"
if [ ! -f "$HOME/.openclaw/openclaw.json" ]; then
    cp "$PROJECT_DIR/config/openclaw.json" "$HOME/.openclaw/openclaw.json"
    echo "Copied openclaw.json to $HOME/.openclaw/"
else
    echo "openclaw.json already exists — skipping (check config/openclaw.json for updates)"
fi

# Create working directories
mkdir -p /tmp/clawoss-workdir
mkdir -p "$HOME/.openclaw/logs"

echo ""
echo "=== Setup Complete ==="
echo "Next steps:"
echo "  1. Edit ~/.openclaw/openclaw.json with your API keys"
echo "  2. Run: npm run start"
```

- [ ] **Step 2: Create start.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Starting ClawOSS ==="

# Verify setup
if [ ! -L "$HOME/.openclaw/workspace" ]; then
    echo "Error: workspace not linked. Run 'npm run setup' first."
    exit 1
fi

# Register cron jobs
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Registering cron jobs..."
while IFS= read -r job; do
    name=$(echo "$job" | jq -r '.id')
    schedule=$(echo "$job" | jq -r '.schedule')
    session=$(echo "$job" | jq -r '.session')
    payload=$(echo "$job" | jq -r '.payload')
    model=$(echo "$job" | jq -r '.model // empty')

    model_flag=""
    if [ -n "$model" ]; then
        model_flag="--model $model"
    fi

    openclaw cron add \
        --name "$name" \
        --cron "$schedule" \
        --session "$session" \
        --message "$payload" \
        $model_flag \
        2>/dev/null || echo "  Cron job '$name' may already exist"
done < <(jq -c '.[]' "$PROJECT_DIR/config/cron-jobs.json")

# Start OpenClaw gateway
echo "Starting OpenClaw gateway..."
openclaw start --daemon

echo ""
echo "=== ClawOSS Running ==="
echo "Dashboard: check your Vercel deployment"
echo "Logs: tail -f $HOME/.openclaw/logs/openclaw-$(date +%Y-%m-%d).log"
echo "Stop: npm run stop"
```

- [ ] **Step 3: Create stop.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "=== Stopping ClawOSS ==="
openclaw stop 2>/dev/null || echo "Gateway was not running"
echo "ClawOSS stopped."
```

- [ ] **Step 4: Create health-check.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== ClawOSS Health Check ==="

# Check gateway
if openclaw status 2>/dev/null | grep -q "running"; then
    echo "[OK] Gateway is running"
else
    echo "[FAIL] Gateway is not running"
    exit 1
fi

# Check gh auth
if gh auth status 2>/dev/null; then
    echo "[OK] GitHub CLI authenticated"
else
    echo "[FAIL] GitHub CLI not authenticated"
fi

# Check workspace
if [ -L "$HOME/.openclaw/workspace" ]; then
    echo "[OK] Workspace linked"
else
    echo "[FAIL] Workspace not linked"
fi

# Check cron jobs
CRON_COUNT=$(openclaw cron list 2>/dev/null | wc -l)
echo "[INFO] $CRON_COUNT cron jobs registered"

echo ""
echo "=== Health Check Complete ==="
```

- [ ] **Step 5: Create backup-workspace.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"
git add workspace/memory/ workspace/MEMORY.md
git diff --cached --quiet || git commit -m "chore: backup workspace state $(date +%Y-%m-%d)"
echo "Workspace backed up."
```

- [ ] **Step 6: Create rotate-logs.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
LOG_DIR="$HOME/.openclaw/logs"
DAYS_TO_KEEP=14
find "$LOG_DIR" -name "*.log" -mtime +$DAYS_TO_KEEP -delete 2>/dev/null
echo "Logs older than $DAYS_TO_KEEP days removed."
```

- [ ] **Step 7: Make scripts executable and commit**

```bash
chmod +x scripts/*.sh
git add scripts/
git commit -m "feat: add operational scripts (setup, start, stop, health-check)"
```

---

## Chunk 4: Dashboard — Project Setup and Database

### Task 16: Initialize Next.js dashboard project

**Files:**
- Create: `dashboard/` (via create-next-app)

- [ ] **Step 1: Create Next.js app**

```bash
cd /Users/kevinlin/clawOSS
npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --turbopack
```

- [ ] **Step 2: Install dependencies**

```bash
cd dashboard
npm install @libsql/client drizzle-orm swr recharts @octokit/rest date-fns nanoid next-themes
npm install -D drizzle-kit @types/node
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add badge button card dialog dropdown-menu input select separator sidebar skeleton slider switch table tabs tooltip chart
```

- [ ] **Step 4: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/github/sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

- [ ] **Step 5: Create .env.local.example**

```env
# Database (Turso)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

# GitHub
GITHUB_TOKEN=ghp_xxx
CLAW_AGENT_USERNAME=clawoss-bot

# Agent Communication
CLAW_API_KEY=your-shared-secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 6: Commit**

```bash
cd /Users/kevinlin/clawOSS
git add dashboard/
git commit -m "feat: initialize Next.js 15 dashboard with shadcn/ui"
```

### Task 17: Set up database schema and client

**Files:**
- Create: `dashboard/lib/db.ts`
- Create: `dashboard/lib/schema.ts`
- Create: `dashboard/drizzle.config.ts`

- [ ] **Step 1: Create lib/schema.ts**

Use the full Drizzle schema from dashboard design Section 3 — all 8 tables: heartbeats, pullRequests, prReviews, qualityScores, metricsTokens, agentLogs, commandAudit, settings.

- [ ] **Step 2: Create lib/db.ts**

```typescript
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

- [ ] **Step 3: Create drizzle.config.ts**

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/schema.ts",
  out: "./drizzle/migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
```

- [ ] **Step 4: Generate initial migration**

```bash
cd dashboard
npx drizzle-kit generate
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/schema.ts dashboard/lib/db.ts dashboard/drizzle.config.ts dashboard/drizzle/
git commit -m "feat: add Drizzle ORM schema and Turso database client"
```

### Task 18: Create shared types and utilities

**Files:**
- Create: `dashboard/lib/types.ts`
- Create: `dashboard/lib/utils.ts`
- Create: `dashboard/lib/github.ts`
- Create: `dashboard/lib/quality.ts`
- Create: `dashboard/lib/metrics.ts`

- [ ] **Step 1: Create lib/types.ts**

Define all shared TypeScript types from dashboard design Section 2: AgentStatus, TaskInfo, ActivityItem, PullRequest, PullRequestSummary, PRFilterState, LogEntry, LogFilterState, CommandAuditEntry, DashboardSettings, etc.

- [ ] **Step 2: Create lib/utils.ts**

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
```

- [ ] **Step 3: Create lib/github.ts**

Octokit client setup, `syncPRsFromGitHub()` function that fetches PRs authored by agent username from target repos, upserts into DB, fetches reviews.

- [ ] **Step 4: Create lib/quality.ts**

Quality score computation matching the 7-gate system: scope (10%), code quality (20%), test coverage (20%), security (10%), anti-slop (15%), git hygiene (10%), PR template (15%).

- [ ] **Step 5: Create lib/metrics.ts**

Aggregation helpers: `groupByDay()`, `groupByWeek()`, `calculateMergeRate()`, `calculateCostPerPR()`.

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/
git commit -m "feat: add shared types, utilities, GitHub client, and quality scoring"
```

---

## Chunk 5: Dashboard — API Routes

### Task 19: Create ingest API routes (agent pushes data here)

**Files:**
- Create: `dashboard/app/api/ingest/heartbeat/route.ts`
- Create: `dashboard/app/api/ingest/metrics/route.ts`
- Create: `dashboard/app/api/ingest/logs/route.ts`

- [ ] **Step 1: Create heartbeat ingest route**

POST handler that validates `Authorization: Bearer` header against `CLAW_API_KEY`, inserts into heartbeats table, returns `{ ok: true, id }`.

- [ ] **Step 2: Create metrics ingest route**

POST handler for batch metric ingestion. Validates auth, inserts batch into metricsTokens table.

- [ ] **Step 3: Create logs ingest route**

POST handler for batch log ingestion. Validates auth, inserts batch into agentLogs table.

- [ ] **Step 4: Create shared auth helper**

```typescript
// dashboard/lib/auth-api.ts
export function validateApiKey(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice(7) === process.env.CLAW_API_KEY;
}
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/api/ingest/ dashboard/lib/auth-api.ts
git commit -m "feat: add ingest API routes for heartbeat, metrics, and logs"
```

### Task 20: Create GitHub sync and PR query routes

**Files:**
- Create: `dashboard/app/api/github/sync/route.ts`
- Create: `dashboard/app/api/github/prs/route.ts`
- Create: `dashboard/app/api/github/prs/[id]/route.ts`

- [ ] **Step 1: Create GitHub sync route**

GET handler called by Vercel Cron every 5 minutes. Uses `syncPRsFromGitHub()` from lib/github.ts. Returns `{ synced: number, repos: string[] }`.

- [ ] **Step 2: Create PR list route**

GET handler with query params: status, repo, page, limit, sort, order, minQuality, search. Returns paginated PR list with total count.

- [ ] **Step 3: Create PR detail route**

GET handler for single PR by ID. Returns PR with reviews and quality breakdown.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/api/github/
git commit -m "feat: add GitHub sync cron and PR query API routes"
```

### Task 21: Create metrics and settings query routes

**Files:**
- Create: `dashboard/app/api/metrics/overview/route.ts`
- Create: `dashboard/app/api/metrics/tokens/route.ts`
- Create: `dashboard/app/api/metrics/cost/route.ts`
- Create: `dashboard/app/api/metrics/health/route.ts`
- Create: `dashboard/app/api/metrics/quality/route.ts`
- Create: `dashboard/app/api/logs/route.ts`
- Create: `dashboard/app/api/settings/route.ts`

- [ ] **Step 1: Create overview route**

Returns: agent status (from latest heartbeat), key stats (total PRs, merge rate, tokens today, cost today), recent activity, current task, daily budget usage.

- [ ] **Step 2: Create tokens route**

Returns time series of token usage grouped by day/week/month based on `range` query param.

- [ ] **Step 3: Create cost route**

Returns daily cost and cumulative cost time series.

- [ ] **Step 4: Create health route**

Returns heartbeat status, uptime, error rate, queue depth, active sessions.

- [ ] **Step 5: Create quality route**

Returns quality overview cards, trend data, by-repo breakdown, rejection reasons, distribution, feedback.

- [ ] **Step 6: Create logs route**

Paginated log entries with filters (level, source, date range, search).

- [ ] **Step 7: Create settings route**

GET returns current settings from DB. PUT updates settings.

- [ ] **Step 8: Commit**

```bash
git add dashboard/app/api/metrics/ dashboard/app/api/logs/ dashboard/app/api/settings/
git commit -m "feat: add metrics, logs, and settings query API routes"
```

---

## Chunk 6: Dashboard — SWR Hooks and Layout

### Task 22: Create SWR data hooks

**Files:**
- Create: `dashboard/lib/hooks/use-agent-status.ts`
- Create: `dashboard/lib/hooks/use-metrics.ts`
- Create: `dashboard/lib/hooks/use-prs.ts`
- Create: `dashboard/lib/hooks/use-logs.ts`

- [ ] **Step 1: Create use-agent-status hook**

SWR hook polling `/api/metrics/overview` every 10 seconds. Returns `{ data, isLoading, error }`.

- [ ] **Step 2: Create use-metrics hook**

SWR hooks for tokens (60s), cost (60s), health (30s), quality (120s).

- [ ] **Step 3: Create use-prs hook**

SWR hook for `/api/github/prs` with filter state. 60s refresh.

- [ ] **Step 4: Create use-logs hook**

SWR hook for `/api/logs` with infinite scroll support. 5s refresh.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/hooks/
git commit -m "feat: add SWR data hooks for dashboard pages"
```

### Task 23: Create layout components

**Files:**
- Create: `dashboard/components/layout/app-sidebar.tsx`
- Create: `dashboard/components/layout/header.tsx`
- Create: `dashboard/components/layout/agent-status-indicator.tsx`
- Create: `dashboard/components/layout/theme-toggle.tsx`
- Modify: `dashboard/app/layout.tsx`

- [ ] **Step 1: Create app-sidebar.tsx**

Sidebar with nav items: Overview, PRs, Health, Quality, Logs, Settings. Show agent status indicator at top. Use shadcn Sidebar component.

- [ ] **Step 2: Create header.tsx**

Breadcrumbs, page title, agent status, theme toggle.

- [ ] **Step 3: Create agent-status-indicator.tsx**

Animated dot: green pulse (online), yellow (degraded), red (offline). Shows last heartbeat time.

- [ ] **Step 4: Create theme-toggle.tsx**

Dark/light mode toggle using next-themes.

- [ ] **Step 5: Update app/layout.tsx**

Wrap with ThemeProvider, SidebarProvider, add AppSidebar and Header.

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/layout/ dashboard/app/layout.tsx
git commit -m "feat: add dashboard layout with sidebar and header"
```

---

## Chunk 7: Dashboard — Pages

### Task 24: Create Overview page

**Files:**
- Create: `dashboard/components/overview/agent-status-card.tsx`
- Create: `dashboard/components/overview/metric-cards.tsx`
- Create: `dashboard/components/overview/activity-timeline.tsx`
- Create: `dashboard/components/overview/current-task-card.tsx`
- Create: `dashboard/components/overview/recent-prs-list.tsx`
- Modify: `dashboard/app/page.tsx`

- [ ] **Step 1: Create all 5 overview components**

Match the wireframe from dashboard design Page 1. Agent status card with uptime, metric cards (Total PRs, Merge Rate, Tokens 24h, Cost Today), activity timeline, current task card with progress bar, recent PRs list with quality scores.

- [ ] **Step 2: Wire up page.tsx**

Use `useAgentStatus()` hook, compose overview components in a responsive grid.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/overview/ dashboard/app/page.tsx
git commit -m "feat: add Overview dashboard page"
```

### Task 25: Create PR Dashboard page

**Files:**
- Create: `dashboard/components/prs/pr-filters.tsx`
- Create: `dashboard/components/prs/pr-stats-bar.tsx`
- Create: `dashboard/components/prs/pr-data-table.tsx`
- Create: `dashboard/components/prs/pr-columns.tsx`
- Create: `dashboard/components/prs/pr-detail-dialog.tsx`
- Create: `dashboard/app/prs/page.tsx`

- [ ] **Step 1: Create PR components**

Match wireframe from dashboard design Page 2. Filters bar, stats cards (Total, Open, Merged, Closed, Avg Review Time), data table with columns (title, repo, status, quality, created), detail dialog with quality breakdown and reviews.

- [ ] **Step 2: Wire up prs/page.tsx**

Use `usePRs()` hook with filter state, compose PR components.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/prs/ dashboard/app/prs/
git commit -m "feat: add PR Dashboard page with filters and detail view"
```

### Task 26: Create Health page

**Files:**
- Create: `dashboard/components/health/health-status-cards.tsx`
- Create: `dashboard/components/health/token-usage-chart.tsx`
- Create: `dashboard/components/health/cost-tracking-chart.tsx`
- Create: `dashboard/components/health/api-calls-chart.tsx`
- Create: `dashboard/components/health/context-window-chart.tsx`
- Create: `dashboard/components/health/session-states-table.tsx`
- Create: `dashboard/app/health/page.tsx`

- [ ] **Step 1: Create health components**

Match wireframe from dashboard design Page 3. Status cards (heartbeat, uptime, error rate), token usage chart (Recharts area), cost tracking chart, API calls by type, context window histogram, session states table.

- [ ] **Step 2: Wire up health/page.tsx**

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/health/ dashboard/app/health/
git commit -m "feat: add Agent Health page with charts and monitoring"
```

### Task 27: Create Quality Metrics page

**Files:**
- Create: `dashboard/components/quality/quality-overview-cards.tsx`
- Create: `dashboard/components/quality/quality-trend-chart.tsx`
- Create: `dashboard/components/quality/quality-by-repo-chart.tsx`
- Create: `dashboard/components/quality/review-feedback-list.tsx`
- Create: `dashboard/components/quality/rejection-reasons-chart.tsx`
- Create: `dashboard/components/quality/quality-distribution.tsx`
- Create: `dashboard/app/quality/page.tsx`

- [ ] **Step 1: Create quality components**

Match wireframe from dashboard design Page 4. Overview cards (avg score, 1st pass rate, review score, rejection rate), quality trend line chart, quality by repo bar chart, review feedback list with sentiment, rejection reasons pie chart, quality distribution histogram.

- [ ] **Step 2: Wire up quality/page.tsx**

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/quality/ dashboard/app/quality/
git commit -m "feat: add Quality Metrics page with trend analysis"
```

### Task 28: Create Logs page

**Files:**
- Create: `dashboard/components/logs/log-filters.tsx`
- Create: `dashboard/components/logs/log-stream.tsx`
- Create: `dashboard/components/logs/log-entry.tsx`
- Create: `dashboard/components/logs/log-detail-dialog.tsx`
- Create: `dashboard/components/logs/audit-trail.tsx`
- Create: `dashboard/app/logs/page.tsx`

- [ ] **Step 1: Create log components**

Match wireframe from dashboard design Page 5. Filter bar (level, source, date, search), log stream with infinite scroll, log entry rows with level badges, detail dialog, audit trail table.

- [ ] **Step 2: Wire up logs/page.tsx**

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/logs/ dashboard/app/logs/
git commit -m "feat: add Logs page with real-time log streaming"
```

### Task 29: Create Settings page

**Files:**
- Create: `dashboard/components/settings/general-settings.tsx`
- Create: `dashboard/components/settings/quality-settings.tsx`
- Create: `dashboard/components/settings/notification-settings.tsx`
- Create: `dashboard/components/settings/api-key-settings.tsx`
- Create: `dashboard/app/settings/page.tsx`

- [ ] **Step 1: Create settings components**

Match wireframe from dashboard design Page 6. Tabs (General, Quality, Notifications, API Keys). General: target repos list, pause toggle, heartbeat interval. Quality: min threshold slider, auto-merge toggle. Notifications: Slack webhook config. API Keys: GitHub token, CLAW_API_KEY management.

- [ ] **Step 2: Wire up settings/page.tsx**

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/settings/ dashboard/app/settings/
git commit -m "feat: add Settings page with configuration management"
```

---

## Chunk 8: Documentation, CI/CD, and Final Assembly

### Task 30: Write comprehensive README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Sections: What is ClawOSS (with the engine/race car analogy), Features, Architecture (diagram from architecture doc), Quick Start (setup.sh, configure, start.sh), Dashboard (screenshot placeholder, pages overview), Custom Skills (list of 10 skills with descriptions), Configuration (openclaw.json key settings, workspace files), Operational Scripts, Quality Gates (7-gate system), Realistic Expectations (from devil's advocate: 5-15 PRs/month, $200-500/month), Contributing, License.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add comprehensive README with architecture and setup guide"
```

### Task 31: Create GitHub Actions CI/CD workflows

**Files:**
- Create: `.github/workflows/validate.yml`
- Create: `.github/workflows/deploy-dashboard.yml`

- [ ] **Step 1: Create validate.yml**

On push/PR: validate openclaw.json is valid JSON5, lint all SKILL.md files (check frontmatter), verify workspace file structure, run dashboard build.

- [ ] **Step 2: Create deploy-dashboard.yml**

On push to main (dashboard/ changes): build and deploy dashboard to Vercel using `vercel --prod`.

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add validation and dashboard deployment workflows"
```

### Task 32: Create config validation script

**Files:**
- Create: `scripts/validate-config.mjs`

- [ ] **Step 1: Create validation script**

Validates: openclaw.json parses as JSON5, required workspace files exist, all skills have valid SKILL.md with frontmatter, cron-jobs.json is valid.

- [ ] **Step 2: Commit**

```bash
git add scripts/validate-config.mjs
git commit -m "feat: add configuration validation script"
```

### Task 33: Final assembly and push

- [ ] **Step 1: Verify all files exist**

Run `find . -type f | head -100` and compare against architecture.

- [ ] **Step 2: Run dashboard build**

```bash
cd dashboard && npm run build
```

- [ ] **Step 3: Run config validation**

```bash
node scripts/validate-config.mjs
```

- [ ] **Step 4: Create final commit and push**

```bash
git add -A
git commit -m "feat: ClawOSS v0.1.0 — autonomous OSS contributor agent"
git push origin main
```

---

## Summary

| Chunk | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-4 | Project scaffold + workspace configs |
| 2 | 5-14 | 10 custom skills |
| 3 | 15 | Operational scripts |
| 4 | 16-18 | Dashboard setup + database |
| 5 | 19-21 | Dashboard API routes |
| 6 | 22-23 | SWR hooks + layout |
| 7 | 24-29 | Dashboard pages (6 pages) |
| 8 | 30-33 | Docs, CI/CD, final assembly |

**Parallelization:** Chunks 1-3 (workspace + skills + scripts) are independent of Chunks 4-7 (dashboard). They can be built simultaneously by separate agents. Chunk 8 depends on all others.

**Estimated files:** ~120 files total (10 workspace configs, 10 skills, 6 scripts, ~90 dashboard files, 5 docs/CI files).

---

## Post-Implementation Notes

*Added 2026-03-16 after implementation was complete.*

### Major Deviations from Plan

#### 1. Model Changed: Claude Sonnet -> Minimax M2.5 via OpenRouter

The plan specified `claude-sonnet-4-6` as the primary model with `claude-haiku-4-5` as fallback. During implementation, the throughput architecture research (`research/06-throughput-architecture.md`) identified Minimax M2.5 as a superior choice:
- **80.2% SWE-bench Verified** (matches Claude Sonnet's 79.6%)
- **11x cheaper input tokens, 16x cheaper output tokens**
- Routed via OpenRouter (`openrouter/minimax/minimax-m2.5`)
- Model fallback explicitly disabled (`fallbacks: []`) to prevent silent cost spikes

#### 2. Heartbeat Interval: 60min -> 10min

The plan specified 60-minute heartbeat with Haiku model. Implementation uses:
- **10-minute interval** for faster autonomous loop cycling
- **M2.5 model** (same as primary, already very cheap)
- **`lightContext: true`** to minimize context loading per cycle
- **`session: "main"`** to maintain orchestrator state continuity
- HEARTBEAT.md embeds safety rules since AGENTS.md is not loaded in light mode

#### 3. Architecture: Flat Agent -> Orchestrator + Sub-Agent (v5)

The original plan described a single agent handling all phases. The v5 throughput architecture introduced:
- **Main session as orchestrator**: handles heartbeat loop, work queue management, PR follow-ups, dashboard reporting
- **Sub-agents via `sessions_spawn`**: handle implementation in fresh isolated contexts (zero cross-task pollution)
- **Staging file pattern**: cron jobs write to `*-staging.md` files; orchestrator merges into main work queue to prevent race conditions
- **Circuit breakers**: `wake-state.md` tracks consecutive wakes, hourly errors
- Required enabling `tools.sessions_spawn.attachments.enabled: true`

#### 4. Cron Jobs Redesigned

| Plan | Implementation |
|------|---------------|
| daily-discovery (8am, Sonnet) | work-queue-refill (every 2h, isolated session) |
| pr-followup-check (every 4h, main session) | pr-followup-scan (every 30min, main session) |
| daily-report (11pm, Haiku) | daily-report (11pm, isolated session) |
| weekly-retrospective (Monday 9am, Opus) | weekly-retrospective (Monday 9am, isolated session) |
| memory-cleanup (Sunday 3am, Haiku) | memory-cleanup (Sunday 3am, isolated session) |

Key changes: more frequent discovery and PR scanning, all non-main jobs use isolated sessions, no model-specific routing (all use default M2.5).

#### 5. GitHub Identity Email

Changed from `drsparrowhawk@proton.me` to `billionclaw+clawoss@users.noreply.github.com` to avoid triggering OpenRouter's content filter which replaces email addresses with `[EMAIL]`.

#### 6. Dashboard Deployment

Dashboard deployed to Vercel at `dashboard-plum-one-37.vercel.app`. Database uses Turso (SQLite edge DB at `clawoss-cmlkevin.aws-us-east-1.turso.io`) for persistent data storage. Live Feed page provides real-time conversation streaming from the agent.

#### 7. Second Model Switch: Minimax M2.5 -> Kimi K2.5 via OpenRouter

Post-build, the primary model was switched from Minimax M2.5 to Moonshot Kimi K2.5:
- **76.8% SWE-bench Verified** (vs M2.5's 80.2% — slight regression)
- **$0.45/MTok input, $2.20/MTok output** (vs M2.5's $0.27/$1.10 — more expensive)
- **262K context window** (vs M2.5's 196K — significant improvement)
- Native multimodal and agentic tool-calling capabilities
- All config, dashboard code, hooks, and skills updated to new model ID (`openrouter/moonshotai/kimi-k2.5`)

### Issues Discovered During Implementation

22 issues documented in `issues/` directory:
- 12 open issues (content filter, session locks, skill paths, context overflow, start.sh, .env secrets, workspace docs)
- 10 fixed issues (model fallback, attachments, email filter, cron sessions, heartbeat cost, stale model refs, dashboard cost model)

### Verification Status

- Config validation (`node scripts/validate-config.mjs`): PASSED (29/29)
- Dashboard build: PASSED (deployed to Vercel)
- Autonomous loop: VERIFIED (heartbeat + cron + sub-agent pipeline confirmed working)
- All 10 skills: created and validated (under 2000 char limit)
- All 6 scripts: created and executable
