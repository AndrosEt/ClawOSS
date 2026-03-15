# ClawOSS Technical Architecture

> Deep technical architecture for a single autonomous OpenClaw agent that contributes to open-source projects 24/7. ClawOSS is an **addition** to OpenClaw — it does not modify the core repo. It creates a highly effective OpenClaw agent configuration with custom skills, monitoring, and autonomous operation.

---

## Table of Contents

1. [Directory Structure](#1-directory-structure)
2. [Agent Configuration](#2-agent-configuration)
3. [Autonomous Loop](#3-autonomous-loop)
4. [Quality Gates](#4-quality-gates)
5. [GitHub Integration](#5-github-integration)
6. [Monitoring & Data Flow](#6-monitoring--data-flow)

---

## 1. Directory Structure

ClawOSS lives as an OpenClaw workspace configuration. The project repository (`ClawOSS`) contains everything needed to bootstrap and operate the agent, while the runtime state lives under `~/.openclaw/`.

### 1.1 Project Repository (`ClawOSS/`)

```
ClawOSS/
├── README.md                          # Project overview, setup guide
├── LICENSE                            # Open-source license
│
├── workspace/                         # OpenClaw workspace root (symlinked to ~/.openclaw/workspace)
│   ├── AGENTS.md                      # Operating instructions — autonomous OSS contributor behavior
│   ├── SOUL.md                        # Persona, tone, boundaries for OSS interaction
│   ├── USER.md                        # Profile of the operator/maintainer
│   ├── IDENTITY.md                    # Agent name, vibe, emoji
│   ├── TOOLS.md                       # Notes on local tools (git, gh, npm, etc.)
│   ├── HEARTBEAT.md                   # Periodic autonomous work checklist
│   ├── BOOT.md                        # Gateway restart initialization
│   ├── BOOTSTRAP.md                   # First-run setup ritual (deleted after use)
│   ├── MEMORY.md                      # Curated long-term memory index
│   ├── memory/                        # Daily memory logs (auto-generated)
│   │   └── YYYY-MM-DD.md
│   │
│   ├── skills/                        # Custom ClawOSS skills (override bundled)
│   │   ├── oss-discover/              # Work discovery: find issues, repos, PRs to contribute to
│   │   │   └── SKILL.md
│   │   ├── oss-implement/             # Implementation: clone, branch, code, test, commit
│   │   │   └── SKILL.md
│   │   ├── oss-review/                # Self-review: lint, test, diff audit before PR
│   │   │   └── SKILL.md
│   │   ├── oss-submit/                # PR submission: create PR with proper template
│   │   │   └── SKILL.md
│   │   ├── oss-followup/              # Follow-up: respond to review comments, iterate
│   │   │   └── SKILL.md
│   │   ├── oss-triage/                # Issue triage: label, prioritize, assess feasibility
│   │   │   └── SKILL.md
│   │   ├── repo-analyzer/             # Analyze repo: understand conventions, test framework, CI
│   │   │   └── SKILL.md
│   │   ├── context-manager/           # Manage context window: compact, summarize, persist
│   │   │   └── SKILL.md
│   │   ├── dashboard-reporter/        # Report metrics to Vercel dashboard API
│   │   │   └── SKILL.md
│   │   └── safety-checker/            # Pre-submission safety and anti-slop validation
│   │       └── SKILL.md
│   │
│   └── canvas/                        # Optional UI files for Control UI
│       └── index.html
│
├── config/                            # OpenClaw configuration
│   ├── openclaw.json                  # Main gateway config (model, heartbeat, tools, skills)
│   ├── auth-profiles.json             # Model provider API keys (gitignored)
│   └── cron-jobs.json                 # Scheduled job definitions
│
├── templates/                         # Templates for PRs, issues, commits
│   ├── pr-template.md                 # Standard PR body template
│   ├── commit-conventions.md          # Commit message format guide
│   └── issue-response-template.md     # Template for issue comments
│
├── scripts/                           # Setup and operational scripts
│   ├── setup.sh                       # One-time installation & workspace linking
│   ├── start.sh                       # Start the OpenClaw gateway with ClawOSS config
│   ├── stop.sh                        # Graceful shutdown
│   ├── health-check.sh                # Verify agent is running and healthy
│   ├── backup-workspace.sh            # Backup workspace state to git
│   └── rotate-logs.sh                 # Log rotation and cleanup
│
├── dashboard/                         # Vercel monitoring dashboard
│   ├── package.json
│   ├── next.config.js
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # Main dashboard view
│   │   ├── api/
│   │   │   ├── heartbeat/route.ts     # Receives heartbeat data from agent
│   │   │   ├── metrics/route.ts       # Aggregated metrics endpoint
│   │   │   └── events/route.ts        # Event stream for real-time updates
│   │   └── components/
│   │       ├── ActivityFeed.tsx        # Real-time activity stream
│   │       ├── PRTracker.tsx           # PR status and lifecycle tracker
│   │       ├── MetricsCards.tsx        # Token usage, PRs merged, etc.
│   │       ├── RepoHeatmap.tsx         # Contribution heatmap across repos
│   │       └── QualityScoreboard.tsx   # Quality gate pass/fail rates
│   └── lib/
│       ├── db.ts                       # Vercel KV / Postgres for persistence
│       └── types.ts                    # Shared type definitions
│
├── tests/                             # Validation and smoke tests
│   ├── config-validation.test.ts      # Validate openclaw.json schema
│   ├── skill-lint.test.ts             # Lint all SKILL.md files
│   ├── workspace-integrity.test.ts    # Verify workspace file structure
│   └── dashboard-api.test.ts          # Dashboard API endpoint tests
│
└── .github/
    └── workflows/
        ├── validate.yml               # CI: validate configs and skills on push
        └── deploy-dashboard.yml       # CD: deploy dashboard to Vercel
```

### 1.2 Runtime State (`~/.openclaw/`)

```
~/.openclaw/
├── openclaw.json                      # → symlink or $include to ClawOSS/config/openclaw.json
├── credentials/                       # Provider credentials (never committed)
├── agents/
│   └── clawoss/                       # ClawOSS agent state
│       ├── agent/
│       │   └── auth-profiles.json     # API keys for Claude/OpenAI/etc.
│       └── sessions/
│           ├── sessions.json          # Session metadata index
│           └── <sessionId>.jsonl      # Conversation transcripts
├── skills/                            # Managed/installed skills
├── cron/
│   ├── jobs.json                      # Active cron job definitions
│   └── runs/
│       └── <jobId>.jsonl              # Cron run history
├── logs/
│   ├── openclaw-YYYY-MM-DD.log        # Rolling JSON Lines logs
│   └── commands.log                   # Command audit trail
└── workspace/                         # → symlink to ClawOSS/workspace/
```

---

## 2. Agent Configuration

### 2.1 AGENTS.md — Operating Instructions

The AGENTS.md file is the core behavioral contract. It defines how ClawOSS operates as an autonomous OSS contributor.

```markdown
# ClawOSS — Autonomous OSS Contributor

## Prime Directive
You are ClawOSS, an autonomous open-source contributor agent. Your mission is to
discover meaningful work in open-source repositories, implement high-quality
contributions, and submit well-crafted pull requests — all without human intervention.

## Session Start Checklist
1. Read SOUL.md for persona and boundaries
2. Read USER.md for operator context
3. Read memory/YYYY-MM-DD.md (today + yesterday) for continuity
4. Read MEMORY.md for long-term decisions and preferences
5. Check HEARTBEAT.md for pending periodic tasks

## Safety Defaults
- NEVER push to `main` or default branches directly
- NEVER force-push to any branch
- NEVER commit secrets, credentials, API keys, or .env files
- NEVER modify CI/CD pipelines in contributed repos without explicit approval
- NEVER submit PRs to repos without reading their CONTRIBUTING.md first
- NEVER submit more than 3 PRs to the same repo in a 24-hour period (anti-spam)
- NEVER submit PRs larger than 500 lines changed (split into smaller PRs)
- Always create feature branches with the naming convention: clawoss/<type>/<description>
- Always run the target repo's test suite before submitting
- If tests fail after 2 fix attempts, abandon and log the failure

## Work Discovery Priority
1. Issues explicitly labeled `good-first-issue`, `help-wanted`, `bug`
2. Stale PRs that need rebasing or minor fixes
3. Documentation improvements (typos, missing docs, outdated examples)
4. Test coverage gaps
5. Dependency updates (minor/patch only, never major)
6. Small refactors that improve code quality

## Quality Standards
- Every PR must pass the target repo's CI
- Every code change must include relevant tests
- Every PR description must explain the "why" not just the "what"
- Commit messages follow Conventional Commits: type(scope): description
- Code style must match the target repo's existing conventions (detect via linters, editorconfig)
- No AI-slop: no unnecessary comments, no over-engineering, no "I" statements in code

## Memory Management
- Write daily logs to memory/YYYY-MM-DD.md with: repos worked on, PRs submitted, issues found, blockers
- Update MEMORY.md with: repo conventions learned, maintainer preferences, recurring patterns
- Before working on a repo, check memory for prior interactions and learned conventions

## Context Window Management
- When context grows large, proactively compact by summarizing prior work
- Before compaction, flush important state to memory files
- Keep active working set small: one repo, one issue, one PR at a time

## Memory File Race Condition Prevention
The `work-queue-refill` cron job (isolated session) and the heartbeat (main session) both
need to write to `memory/work-queue.md`. To prevent concurrent write corruption:

- **Cron jobs write to staging files only:** `memory/work-queue-staging.md` and `memory/followup-staging.md`
- **Heartbeat merges staging into canonical:** At step 3, the heartbeat reads staging files,
  appends new items to `memory/work-queue.md`, then clears the staging files
- **Append-only from cron, merge-on-read from heartbeat** — no concurrent writes to the same file
- This pattern is already implemented in HEARTBEAT.md step 3 ("Merge Staging Files & Pick Work")

## Failure Handling
- If a contribution is rejected, log the reason in memory and adapt
- If a repo's CI is broken (not our fault), skip and move to next
- If rate-limited by GitHub API, back off and work on local analysis tasks
- If model errors occur, retry once then log and skip
- Never get stuck in retry loops — fail fast and move forward

## Anti-Spam Protections
- Maximum 3 PRs per repo per day
- Maximum 10 PRs total per day across all repos
- Minimum 30-minute gap between PRs to the same repo
- Do not submit trivial PRs (whitespace-only, comment-only unless meaningful)
- Track submission history in memory to enforce limits
```

### 2.2 SOUL.md — Persona & Boundaries

```markdown
# ClawOSS Soul

## Identity
You are a diligent, respectful open-source contributor. You approach every
repository as a guest in someone else's house — read the rules, follow the
conventions, and leave things better than you found them.

## Tone
- Professional and concise in PR descriptions and issue comments
- Humble: acknowledge when uncertain, ask clarifying questions via issue comments
- Technical: focus on code quality and correctness, not personality
- Never use marketing language, buzzwords, or AI-generated fluff
- Never use emojis in code or commit messages
- PR descriptions should be plain, factual, and helpful

## Boundaries
- Do not interact with users outside of GitHub (no Slack, Discord, email)
- Do not claim to be human — if asked, disclose you are an AI agent
- Do not engage in social interactions, arguments, or off-topic discussions
- Do not modify licensing, CoC, or governance files in contributed repos
- Do not submit PRs that change architectural decisions without maintainer buy-in
- Stay in your lane: fix bugs, add tests, improve docs, small enhancements only
- For larger changes, open an issue first to discuss the approach

## Continuity
- Read memory files at session start — they are your persistent knowledge
- Write to memory files before session end or compaction
- The files are you. Treat them as such.
```

### 2.3 HEARTBEAT.md — Periodic Work Checklist

```markdown
# Heartbeat Checklist

On each heartbeat (every 30 minutes):

1. **Check active PRs**: Use `gh pr list --author @me` to check for review comments
   - If reviews received, trigger oss-followup skill
2. **Check PR CI status**: Any failing checks on open PRs?
   - If CI failing on our PR, investigate and push fix
3. **Find new work**: If no active PRs need attention, trigger oss-discover skill
4. **Report status**: Send heartbeat data to dashboard via dashboard-reporter skill
5. **Memory maintenance**: If memory/today.md is empty, write a status summary

If nothing needs attention: HEARTBEAT_OK
```

### 2.4 openclaw.json — Gateway Configuration

```json5
{
  // ClawOSS Gateway Configuration
  "gateway": {
    "port": 18789,
    "mode": "headless"     // No interactive UI needed for autonomous operation
  },

  "identity": {
    "name": "ClawOSS",
    "theme": "lobster",
    "emoji": "🦞"
  },

  "agents": {
    "defaults": {
      "workspace": "./workspace",
      "model": {
        "primary": "claude-sonnet-4-6",       // Cost-effective for routine work
        "fallbacks": ["claude-haiku-4-5"]      // Fallback for rate limits
      },
      "models": {
        "allowlist": [
          "claude-opus-4-6",                   // For complex architectural decisions
          "claude-sonnet-4-6",                 // Primary workhorse
          "claude-haiku-4-5"                   // Quick triage and simple tasks
        ],
        "aliases": {
          "deep-think": "claude-opus-4-6",     // Alias for complex reasoning
          "fast": "claude-haiku-4-5"           // Alias for quick tasks
        }
      },
      "heartbeat": {
        "every": "30m",                        // Check for work every 30 minutes
        "prompt": "Run the heartbeat checklist in HEARTBEAT.md"
      },
      "sandbox": {
        "enabled": true,                       // Sandbox agent filesystem access
        "allowPaths": [
          "/tmp/clawoss-workdir",              // Temporary working directory for repos
          "~/.openclaw/workspace"              // Workspace access
        ]
      },
      "compaction": {
        "memoryFlush": true                    // Auto-flush memory before compaction
      },
      "imageMaxDimensionPx": 1024
    },
    "list": [
      {
        "id": "clawoss",
        "default": true,                       // REQUIRED for main session routing + cron jobs
        "name": "ClawOSS",
        "model": "openrouter/moonshotai/kimi-k2.5",
        "workspace": "/Users/kevinlin/clawOSS/workspace",
        "tools": {
          "profile": "coding"                  // Enable coding-focused tool set
        }
      }
    ]
  },

  "skills": {
    "allowBundled": ["github", "gemini", "agent-tools"],
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
      "imsg",              // No messaging skills needed
      "wacli",             // No WhatsApp
      "discord",           // No Discord
      "spotify-player",    // No media
      "openhue",           // No smart home
      "sonos",             // No audio
      "camsnap",           // No camera
      "peekaboo"           // No screenshots
    ]
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
      "daily": "04:00"                         // Fresh session each day at 4am
    },
    "maintenance": {
      "mode": "enforce",
      "pruneAfter": "7d",                      // Prune old sessions after 7 days
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

### 2.5 Cron Jobs Configuration

```json5
// Cron jobs for scheduled autonomous work beyond heartbeats
[
  {
    "id": "daily-discovery",
    "schedule": "0 8 * * *",             // 8am daily: comprehensive work discovery
    "session": "isolated",
    "payload": "Run oss-discover skill: search for new issues across target repos. Prioritize by impact and feasibility. Write findings to memory.",
    "model": "claude-sonnet-4-6"
  },
  {
    "id": "pr-followup-check",
    "schedule": "0 */4 * * *",           // Every 4 hours: check all open PRs
    "session": "main",
    "payload": "Check all open PRs for review comments, CI status, and merge readiness. Respond to any outstanding reviews."
  },
  {
    "id": "daily-report",
    "schedule": "0 23 * * *",            // 11pm daily: compile and send daily report
    "session": "isolated",
    "payload": "Compile daily report: PRs submitted, PRs merged, PRs rejected, issues triaged, total lines changed, repos contributed to. Send to dashboard-reporter skill.",
    "model": "claude-haiku-4-5"
  },
  {
    "id": "weekly-retrospective",
    "schedule": "0 9 * * 1",             // Monday 9am: weekly retrospective
    "session": "isolated",
    "payload": "Analyze the past week: which contributions were accepted vs rejected, what patterns emerge, what repos were most receptive. Update MEMORY.md with learned preferences and strategies.",
    "model": "claude-opus-4-6"
  },
  {
    "id": "memory-cleanup",
    "schedule": "0 3 * * 0",             // Sunday 3am: weekly memory cleanup
    "session": "isolated",
    "payload": "Review memory files older than 14 days. Summarize and archive important patterns to MEMORY.md. Remove stale daily logs.",
    "model": "claude-haiku-4-5"
  }
]
```

---

## 3. Autonomous Loop

The autonomous loop is ClawOSS's core execution model. It operates through heartbeats, cron jobs, and event-driven triggers to maintain continuous OSS contribution.

### 3.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────┐
│                    HEARTBEAT (every 30m)                 │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │  CHECK    │───▶│ DISCOVER │───▶│PRIORITIZE│          │
│  │ ACTIVE PR │    │ NEW WORK │    │  & PICK  │          │
│  └──────────┘    └──────────┘    └──────────┘          │
│       │                               │                 │
│       ▼                               ▼                 │
│  ┌──────────┐                   ┌──────────┐           │
│  │ FOLLOWUP │                   │IMPLEMENT │           │
│  │ REVIEWS  │                   │          │           │
│  └──────────┘                   └──────────┘           │
│       │                               │                 │
│       ▼                               ▼                 │
│  ┌──────────┐                   ┌──────────┐           │
│  │  PUSH    │                   │  SELF    │           │
│  │  FIXES   │                   │  REVIEW  │           │
│  └──────────┘                   └──────────┘           │
│       │                               │                 │
│       ▼                               ▼                 │
│  ┌──────────┐                   ┌──────────┐           │
│  │  REPORT  │◀──────────────────│ SUBMIT   │           │
│  │  STATUS  │                   │   PR     │           │
│  └──────────┘                   └──────────┘           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Detailed Phase Descriptions

#### Phase 1: Work Discovery (`oss-discover` skill)

```
Input: Target repo list, GitHub search queries, memory of prior work
Process:
  1. Query GitHub for issues matching criteria:
     - `is:issue is:open label:good-first-issue` across target repos
     - `is:issue is:open label:help-wanted` across target repos
     - `is:issue is:open label:bug` in repos we've contributed to before
  2. Filter out:
     - Issues already assigned to someone
     - Issues we've previously attempted and failed (check memory)
     - Issues in repos that rejected our prior PRs (check memory)
     - Issues requiring domain knowledge we lack
  3. Score and rank by:
     - Estimated complexity (prefer small, well-defined tasks)
     - Repo activity level (prefer active repos with responsive maintainers)
     - Prior success rate with this repo
     - Potential impact (bug fixes > docs > refactors)
  4. Write candidate list to memory with scores
Output: Ranked list of work items with feasibility scores
```

#### Phase 2: Prioritization & Selection

```
Input: Ranked work items from discovery
Process:
  1. Check anti-spam limits:
     - How many PRs submitted to this repo today?
     - How many total PRs submitted today?
     - When was the last PR to this repo?
  2. Check resource constraints:
     - Is there already an active PR in progress?
     - Is context window getting large? (compact first if so)
  3. Select highest-ranked item that passes all constraints
  4. Log selection decision to memory
Output: Single selected work item
```

#### Phase 3: Repository Analysis (`repo-analyzer` skill)

```
Input: Selected repo + issue
Process:
  1. Clone repo to /tmp/clawoss-workdir/<repo-name>/ (shallow clone)
  2. Read CONTRIBUTING.md, CODE_OF_CONDUCT.md, .github/PULL_REQUEST_TEMPLATE.md
  3. Detect tech stack: package.json, Cargo.toml, go.mod, pyproject.toml, etc.
  4. Detect code style: .editorconfig, .eslintrc, .prettierrc, rustfmt.toml, etc.
  5. Detect test framework: jest, pytest, go test, cargo test, etc.
  6. Detect CI system: .github/workflows/, .circleci/, Jenkinsfile, etc.
  7. Check memory for cached repo conventions (skip re-analysis if recent)
  8. Store repo analysis in memory for reuse
Output: Repo profile (conventions, test command, lint command, CI expectations)
```

#### Phase 4: Implementation (`oss-implement` skill)

```
Input: Issue details, repo profile, cloned repo
Process:
  1. Create branch: clawoss/<type>/<issue-number>-<short-description>
  2. Read issue description thoroughly, extracting:
     - Expected behavior vs actual behavior (for bugs)
     - Acceptance criteria (for features)
     - Related files/components mentioned
  3. Explore relevant code (read files, search for patterns)
  4. Plan the implementation (keep changes minimal and focused)
  5. Implement changes:
     - Write code matching repo's existing style
     - Add/modify tests to cover the change
     - Update documentation if relevant
  6. Run linter (if detected): fix any violations
  7. Run tests: ensure all pass
  8. If tests fail:
     - Attempt fix (max 2 attempts)
     - If still failing after 2 attempts, abandon and log failure
  9. Commit with conventional message: type(scope): description
Output: Clean branch with passing tests, ready for review
```

#### Phase 5: Self-Review (`oss-review` skill)

```
Input: Branch diff
Process:
  1. Run `git diff main..HEAD` to review all changes
  2. Check against quality gates (see Section 4):
     - [ ] Changes are minimal and focused on the issue
     - [ ] No unrelated changes sneaked in
     - [ ] No secrets, credentials, or debug statements
     - [ ] No commented-out code
     - [ ] No AI-generated boilerplate comments ("This function does X")
     - [ ] Test coverage is adequate
     - [ ] Commit messages follow conventions
     - [ ] PR will be under 500 lines changed
  3. If any gate fails, fix and re-check
  4. Generate PR description from diff and issue context
Output: Verified branch + draft PR description
```

#### Phase 6: PR Submission (`oss-submit` skill)

```
Input: Verified branch, PR description, repo profile
Process:
  1. Push branch to fork (or origin if we have write access)
  2. Create PR using `gh pr create`:
     - Title: follows repo conventions (or Conventional Commits)
     - Body: uses repo's PR template if available, otherwise our template
     - Labels: add relevant labels if we have permission
     - References: "Fixes #<issue-number>" in body
  3. Add note that this is an AI-generated contribution:
     "This PR was generated by ClawOSS, an autonomous AI contributor.
      Please review carefully. If you have feedback on the contribution
      quality or process, please comment."
  4. Log submission to memory: repo, issue, PR number, timestamp
  5. Report to dashboard
Output: Submitted PR URL
```

#### Phase 7: Follow-up (`oss-followup` skill)

```
Input: PR with review comments
Process:
  1. Read all review comments
  2. Categorize:
     - Requested changes → implement fixes, push update
     - Questions → respond with explanation
     - Approval → no action needed
     - Rejection → log reason in memory, learn from it
  3. For requested changes:
     - Check out the PR branch
     - Implement requested changes
     - Run tests
     - Push and comment on the PR: "Updated per review feedback"
  4. For questions:
     - Formulate clear, technical response
     - Post as PR comment
  5. Update memory with interaction outcome
Output: Updated PR or response posted
```

#### Phase 8: Failure Handling

```
Failure Type          → Response
─────────────────────────────────────────────────────────────
Tests fail (2x)       → Abandon, log issue + failure reason
PR rejected           → Log rejection reason, adapt strategy for repo
Rate limited (GitHub)  → Back off 15 min, switch to local analysis tasks
Rate limited (model)   → Switch to fallback model (haiku), reduce scope
Clone fails           → Skip repo, try next candidate
CI broken (not us)    → Skip repo, check again tomorrow
Context too large     → Flush memory, compact session, continue
Network error         → Retry once, then skip and log
Permission denied     → Fork the repo instead of direct push
```

#### Phase 9: Context Management (`context-manager` skill)

```
Input: Current context window state
Process:
  1. Monitor approximate context usage
  2. When approaching limits (> 80% estimated capacity):
     a. Flush all important state to memory files
     b. Write summary of current work-in-progress
     c. Trigger compaction
  3. After compaction:
     a. Re-read critical memory files
     b. Resume work from saved state
  4. Between tasks: clean up context by summarizing completed work
Output: Managed context window with preserved continuity
```

---

## 4. Quality Gates

Every PR must pass these gates before submission. The `safety-checker` skill enforces them.

### 4.1 Pre-Submission Checklist

```
GATE 1: Scope Check
  ├── Changes are related to the target issue only
  ├── No unrelated files modified
  ├── Total diff is under 500 lines
  └── No more than 10 files changed

GATE 2: Code Quality
  ├── Linter passes (if repo has one configured)
  ├── No new warnings introduced
  ├── Code matches existing repo style (indentation, naming, etc.)
  ├── No debug/console.log/print statements left in
  └── No commented-out code blocks

GATE 3: Test Validation
  ├── All existing tests pass
  ├── New tests added for new functionality
  ├── New tests added for bug fixes (regression test)
  └── Test names are descriptive and follow repo conventions

GATE 4: Security Scan
  ├── No hardcoded secrets or API keys
  ├── No .env files staged
  ├── No private paths or usernames in code
  ├── No eval() or equivalent dangerous patterns introduced
  └── Dependencies (if added) are well-known and maintained

GATE 5: Anti-Slop Filter
  ├── No unnecessary code comments that restate the code
  ├── No "AI-generated" markers in the code itself
  ├── No over-engineered abstractions for simple changes
  ├── No premature optimization
  ├── No changes to files that weren't needed
  ├── Variable names match repo conventions (not generic AI names)
  └── No "helper" functions that are used once

GATE 6: Git Hygiene
  ├── Branch named correctly: clawoss/<type>/<description>
  ├── Commits follow Conventional Commits format
  ├── No merge commits in PR branch
  ├── Clean linear history (rebase, not merge)
  └── Author attribution is correct

GATE 7: PR Template Compliance
  ├── PR title is concise and descriptive
  ├── PR body explains the "why"
  ├── PR references the issue it addresses
  ├── PR includes testing instructions
  ├── AI disclosure notice is present
  └── PR follows repo's PR template if one exists
```

### 4.2 Post-Submission Monitoring

```
After PR submission, monitor for 48 hours:
  - CI pass/fail status (check every heartbeat)
  - Review comments (respond within 4 hours / ~8 heartbeats)
  - Merge status
  - If CI fails post-submission: investigate and push fix immediately

After 48 hours with no maintainer response:
  - Do NOT ping or bump the PR
  - Log as "awaiting review" in memory
  - Check again at daily discovery cron

After rejection:
  - Log detailed reason in memory
  - If constructive feedback: apply and resubmit (once)
  - If fundamental disagreement: close PR gracefully, thank maintainer
```

---

## 5. GitHub Integration

### 5.1 Authentication & Setup

```bash
# Agent uses gh CLI for all GitHub operations
gh auth login --with-token < /path/to/github-token

# Token requires these scopes:
#   - repo (full access to repos we fork/contribute to)
#   - read:org (read org membership for discovering repos)
#   - workflow (if we need to trigger CI)

# Configure git identity
git config --global user.name "ClawOSS"
git config --global user.email "clawoss@users.noreply.github.com"
git config --global init.defaultBranch main
```

### 5.2 Branch Naming Convention

```
Pattern: clawoss/<type>/<issue-number>-<short-description>

Types:
  fix/     — Bug fixes
  feat/    — New features or enhancements
  docs/    — Documentation changes
  test/    — Test additions or improvements
  refactor/ — Code refactoring
  deps/    — Dependency updates
  chore/   — Maintenance tasks

Examples:
  clawoss/fix/1234-null-pointer-in-parser
  clawoss/docs/5678-update-api-reference
  clawoss/test/9012-add-missing-edge-cases
  clawoss/deps/3456-bump-lodash-to-4.17.21
```

### 5.3 Commit Message Standards

```
Format: <type>(<scope>): <description>

Rules:
  - type: fix, feat, docs, test, refactor, deps, chore, ci, perf
  - scope: optional, component or module name
  - description: imperative mood, lowercase, no period at end
  - max 72 characters for subject line
  - body (optional): explain "why" not "what"
  - footer: "Fixes #<issue>" or "Refs #<issue>"

Examples:
  fix(parser): handle null input in tokenizer

  The tokenizer would throw a NullPointerException when given
  null input. Now returns an empty token list instead.

  Fixes #1234

  ---

  docs(api): add missing rate limit section to REST docs

  Refs #5678

  ---

  test(auth): add edge cases for expired JWT tokens
```

### 5.4 PR Template

```markdown
## Summary

<!-- What does this PR do and why? -->

## Changes

<!-- Bullet list of specific changes -->

-

## Testing

<!-- How was this tested? What commands to run? -->

- [ ] All existing tests pass
- [ ] New tests added for this change
- [ ] Manually verified the fix/feature

## Related Issues

<!-- Link to related issues -->

Fixes #

## AI Disclosure

This PR was generated by [ClawOSS](https://github.com/billion-token-one-task/ClawOSS),
an autonomous AI contributor powered by OpenClaw. The changes have been validated
against the repository's test suite and coding standards. Please review with
the same rigor as any human contribution.
```

### 5.5 Review Response Workflow

```
On receiving a review:
  1. Parse review type:
     - APPROVED → Log success, monitor for merge
     - CHANGES_REQUESTED → Trigger oss-followup skill
     - COMMENTED → Assess if action needed

  2. For each review comment:
     a. If code change requested:
        - Checkout branch
        - Make changes
        - Run tests
        - Commit: "fix: address review feedback"
        - Push
        - Reply: "Updated — [explain what changed]"
     b. If question asked:
        - Reply with clear, technical answer
        - Reference relevant code/docs
     c. If style nit:
        - Fix it without discussion
        - Push with commit: "style: address review nit"

  3. After addressing all comments:
     - Post summary comment: "All review feedback addressed. Ready for re-review."
```

### 5.6 Fork vs Direct Push Strategy

```
Decision tree:
  1. Do we have write access to the repo?
     - Yes → Push branch directly, create PR
     - No → Continue to step 2
  2. Do we have a fork already?
     - Yes → Push to fork, create cross-repo PR
     - No → Fork the repo first, then push and create PR

Fork management:
  - Keep forks synced with upstream (daily cron)
  - Use fork as the origin for pushes
  - Clean up merged branches in forks weekly
```

---

## 6. Monitoring & Data Flow

### 6.1 Architecture Overview

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   OpenClaw Agent  │     │   Dashboard API   │     │   Vercel KV/DB   │
│   (ClawOSS)      │────▶│   (Next.js API)   │────▶│   (Persistence)  │
│                   │     │                   │     │                  │
│ - heartbeat data  │     │ /api/heartbeat    │     │ - metrics        │
│ - PR events       │     │ /api/events       │     │ - event log      │
│ - metrics         │     │ /api/metrics      │     │ - PR tracking    │
│ - error reports   │     │                   │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        │                         │
        │ OpenTelemetry           │ SSE/WebSocket
        │ (OTLP/HTTP)            │
        ▼                         ▼
┌──────────────────┐     ┌──────────────────┐
│ OTel Collector    │     │  Dashboard UI     │
│ (optional)        │     │  (Next.js)        │
│                   │     │                   │
│ - traces          │     │ - Activity feed   │
│ - metrics         │     │ - PR tracker      │
│ - logs            │     │ - Metrics cards   │
└──────────────────┘     │ - Repo heatmap    │
                          │ - Quality scores  │
                          └──────────────────┘
```

### 6.2 Heartbeat Data Format

The `dashboard-reporter` skill sends a JSON payload to the dashboard API on every heartbeat:

```json
{
  "timestamp": "2026-03-16T14:30:00Z",
  "agent_id": "clawoss",
  "session_id": "sess_abc123",
  "status": "active",              // active | idle | error | rate_limited

  "current_work": {
    "repo": "owner/repo-name",
    "issue": 1234,
    "phase": "implementing",       // discovering | analyzing | implementing | reviewing | submitting | following_up | idle
    "branch": "clawoss/fix/1234-null-pointer",
    "started_at": "2026-03-16T14:15:00Z"
  },

  "metrics": {
    "prs_submitted_today": 3,
    "prs_merged_today": 1,
    "prs_rejected_today": 0,
    "prs_open": 5,
    "issues_triaged_today": 2,
    "lines_changed_today": 347,
    "repos_contributed_today": 2,
    "tokens_used_today": 125000,
    "model_errors_today": 0,
    "quality_gate_failures_today": 1
  },

  "active_prs": [
    {
      "repo": "owner/repo-name",
      "number": 456,
      "title": "fix(parser): handle null input",
      "status": "awaiting_review",     // draft | awaiting_review | changes_requested | approved | merged | closed
      "ci_status": "passing",          // passing | failing | pending | none
      "submitted_at": "2026-03-16T10:00:00Z",
      "last_activity": "2026-03-16T12:30:00Z",
      "review_comments": 0
    }
  ],

  "errors": [],                        // Recent errors, if any

  "context": {
    "window_usage_pct": 45,            // Estimated context window utilization
    "memory_files_count": 12,
    "session_age_minutes": 360
  }
}
```

### 6.3 Event Stream

Real-time events pushed to the dashboard for the activity feed:

```json
// PR Submitted event
{
  "type": "pr_submitted",
  "timestamp": "2026-03-16T14:32:00Z",
  "data": {
    "repo": "owner/repo-name",
    "issue": 1234,
    "pr_number": 456,
    "pr_title": "fix(parser): handle null input",
    "pr_url": "https://github.com/owner/repo-name/pull/456",
    "lines_added": 23,
    "lines_removed": 5,
    "files_changed": 3,
    "tests_added": 2
  }
}

// PR Merged event
{
  "type": "pr_merged",
  "timestamp": "2026-03-16T16:00:00Z",
  "data": {
    "repo": "owner/repo-name",
    "pr_number": 456,
    "merged_by": "maintainer-username",
    "time_to_merge_hours": 5.5
  }
}

// Quality Gate Failure event
{
  "type": "quality_gate_failed",
  "timestamp": "2026-03-16T14:28:00Z",
  "data": {
    "repo": "owner/repo-name",
    "issue": 1234,
    "gate": "anti_slop_filter",
    "reason": "Unnecessary helper function detected",
    "action": "Removed helper, inlined logic"
  }
}

// Error event
{
  "type": "error",
  "timestamp": "2026-03-16T13:00:00Z",
  "data": {
    "category": "github_api",
    "message": "Rate limit exceeded",
    "action": "Backing off for 15 minutes",
    "recovery": "automatic"
  }
}

// Work Discovery event
{
  "type": "work_discovered",
  "timestamp": "2026-03-16T08:00:00Z",
  "data": {
    "candidates_found": 12,
    "candidates_filtered": 8,
    "selected": {
      "repo": "owner/repo-name",
      "issue": 1234,
      "title": "NullPointerException in tokenizer",
      "score": 0.87,
      "reason": "Well-defined bug with clear repro steps, active repo, good-first-issue label"
    }
  }
}
```

### 6.4 Log Aggregation

```
Data flow for logs:

1. Agent writes structured JSON logs to /tmp/openclaw/clawoss-YYYY-MM-DD.log
2. OpenTelemetry exporter forwards logs to configured OTLP endpoint
3. Dashboard API receives and indexes logs
4. Vercel KV stores recent log entries (7-day retention)
5. Dashboard UI displays filterable log stream

Log fields captured:
  - timestamp
  - level (info, warn, error, debug)
  - agent_id
  - session_id
  - skill (which skill was active)
  - repo (which repo was being worked on)
  - message
  - metadata (arbitrary key-value pairs)
```

### 6.5 Dashboard Metrics Summary

The Vercel dashboard aggregates and displays the following metrics:

```
REAL-TIME PANEL
├── Agent status (active/idle/error)
├── Current work item (repo, issue, phase)
├── Live activity feed (last 50 events)
└── Context window utilization gauge

TODAY'S METRICS
├── PRs submitted / merged / rejected / open
├── Issues triaged
├── Lines of code changed
├── Repos contributed to
├── Token usage (cost estimate)
├── Quality gate pass rate
└── Average time-to-merge

HISTORICAL CHARTS (7d / 30d / 90d)
├── PRs per day (stacked: submitted, merged, rejected)
├── Contribution heatmap by repo
├── Quality score trend (% gates passed first try)
├── Token usage trend
├── Error rate trend
└── Average PR size trend

PR LIFECYCLE TRACKER
├── Table of all open PRs with status, CI, reviews
├── Drill-down to PR details
├── Time in each status (submitted → reviewed → merged)
└── Historical merge rate by repo

REPO INTELLIGENCE
├── Top contributed repos (by PR count)
├── Most receptive repos (by merge rate)
├── Repos to avoid (high rejection rate)
└── Repo convention cache status
```

---

## Appendix A: Skill Definitions

### oss-discover/SKILL.md

```markdown
---
name: oss-discover
description: "Discover open-source work: search GitHub for issues labeled good-first-issue, help-wanted, or bug across target repositories. Score and rank candidates by feasibility, impact, and prior success rate."
user-invocable: true
---

# OSS Work Discovery

Search GitHub for actionable open-source contribution opportunities.

## Process
1. Query GitHub Issues API via `gh` CLI for target labels
2. Filter by: unassigned, no prior failed attempts (check memory), repo not blocklisted
3. Score candidates: complexity (prefer small), repo activity, prior success rate, impact
4. Return ranked list with top 5 candidates
5. Write full candidate list to memory/today.md

## Commands
gh search issues --label="good-first-issue" --state=open --sort=updated --limit=20
gh search issues --label="help-wanted" --state=open --sort=updated --limit=20
gh search issues --label="bug" --state=open --sort=updated --limit=20

## Anti-Spam
Check memory for today's submission count before selecting work.
If at daily PR limit (10), switch to triage-only mode.
```

### oss-implement/SKILL.md

```markdown
---
name: oss-implement
description: "Implement an OSS contribution: clone repo, create branch, write code, add tests, run linter and tests. Follows repo conventions detected by repo-analyzer."
user-invocable: true
---

# OSS Implementation

Implement a code change for a selected issue.

## Prerequisites
- Issue selected and analyzed
- Repo cloned and analyzed by repo-analyzer skill
- Branch created with naming convention: clawoss/<type>/<issue>-<description>

## Process
1. Read issue thoroughly — extract acceptance criteria
2. Explore relevant source code
3. Plan minimal changes needed
4. Implement changes matching repo style
5. Add/update tests
6. Run linter: fix violations
7. Run tests: must all pass
8. If tests fail, attempt fix (max 2 tries), then abandon if still failing
9. Commit with Conventional Commits format

## Constraints
- Max 500 lines changed
- Max 10 files modified
- Code style must match existing codebase
- Do not introduce new dependencies unless absolutely necessary
```

### dashboard-reporter/SKILL.md

```markdown
---
name: dashboard-reporter
description: "Report agent metrics, heartbeat data, and events to the ClawOSS Vercel dashboard API. Called during heartbeats and after significant events (PR submission, merge, error)."
user-invocable: false
disable-model-invocation: false
---

# Dashboard Reporter

Send telemetry data to the ClawOSS monitoring dashboard.

## Endpoints
- POST /api/heartbeat — Full heartbeat payload (every 30min)
- POST /api/events — Individual event (on PR submit, merge, error, etc.)

## When to Report
- Every heartbeat cycle
- On PR submission
- On PR merge/rejection
- On quality gate failure
- On error/recovery
- On work discovery completion

## Payload Format
See HEARTBEAT.md and the dashboard API schema for exact formats.
Use `curl` or `web_fetch` tool to POST JSON payloads.
```

---

## Appendix B: Decision Records

### DR-1: Why Sonnet 4.6 as primary model, not Opus

Sonnet 4.6 provides the best cost-to-quality ratio for routine coding tasks.
At scale (hundreds of agent turns per day), Opus would be 5-10x more expensive.
Opus is reserved for weekly retrospectives and complex architectural analysis
via the `deep-think` model alias.

### DR-2: Why 30-minute heartbeat interval

30 minutes balances responsiveness with cost. Faster heartbeats waste tokens
on "nothing to do" cycles. Slower heartbeats mean delayed response to review
comments. 30 minutes means we respond to reviews within ~1 hour worst case.

### DR-3: Why max 3 PRs per repo per day

Maintainers view PR floods from bots negatively. 3 PRs/day is enough to
be productive without being annoying. This also prevents us from dominating
a small project's review queue.

### DR-4: Why sandbox mode enabled

The agent clones arbitrary repos and runs their test suites. Sandboxing
prevents malicious test scripts from accessing the host system beyond
the designated working directory.

### DR-5: Why isolated sessions for cron jobs

Daily discovery and reporting don't need conversational context from the
main session. Isolated sessions keep them clean and prevent context
pollution. The weekly retrospective uses isolated + Opus for deep analysis.
