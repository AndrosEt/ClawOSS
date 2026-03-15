# ClawOSS Monitoring Dashboard: Design Specification

**Purpose:** Complete design specification for a Next.js 15 Vercel dashboard that provides real-time visibility into the ClawOSS agent's health, PR quality, costs, and operational safety — with a focus on non-gameable metrics, maintainer satisfaction, and an emergency kill switch.

**Tech Stack:** Next.js 15 (App Router), shadcn/ui, Tailwind CSS, Recharts, Vercel Postgres, Vercel KV (Redis), TanStack Table, SWR, NextAuth

**Important:** This dashboard is a standalone Next.js application. The OpenClaw agent is NOT modified — data flows from the agent to the dashboard via OpenClaw's built-in hooks, GitHub webhooks, and API polling. Think of it as external telemetry for an unmodified engine.

---

## 1. Design Principles

### Anti-Slop Dashboard Philosophy

This dashboard is designed around the devil's advocate findings (see `04-devils-advocate.md`). Every metric, chart, and indicator exists to answer one question: **"Is the agent producing genuinely useful contributions, or is it generating slop?"**

**What we measure (non-gameable):**
- Merge rate by task type (the only metric that matters)
- Maintainer feedback sentiment (the human signal)
- Cost per merged PR (efficiency, not volume)
- Quality score trend (composite, weighted toward outcomes)
- Diff size compliance (guardrail, not goal)

**What we deliberately do NOT measure:**
- PR count (incentivizes splitting trivial changes)
- Lines of code (incentivizes verbose solutions)
- Issue close rate (incentivizes cherry-picking easy issues)
- Test count (incentivizes assertion-free test theater)
- "Self-review passed" (meaningless — same-model blind spots)

### UX Principles

1. **Kill switch visible on EVERY page** — top-right header, unmissable
2. **Real-time burn rate on EVERY page** — prevents runaway cost surprises
3. **Agent status on EVERY page** — running/paused/halted always visible
4. **Dark mode default** — monitoring dashboards are watched for extended periods
5. **Mobile-responsive** — check agent health from phone, primary use is desktop
6. **Red/yellow/green color system** — instant visual triage

---

## 2. Page Architecture

### 2.1 Global Layout

```
+----------------------------------------------------------+
| [ClawOSS Logo]   Agent: RUNNING  |  $4.23 today  | [STOP] |
+----------------------------------------------------------+
|        |                                                  |
|  NAV   |                                                  |
|        |                                                  |
| Overview|              PAGE CONTENT                       |
| PRs    |                                                  |
| Quality|                                                  |
| Cost   |                                                  |
| Health |                                                  |
| Settings|                                                 |
|        |                                                  |
| -------|                                                  |
| Trust: |                                                  |
| [FIXES]|                                                  |
|        |                                                  |
+----------------------------------------------------------+
```

**Header (persistent across all pages):**
- Left: ClawOSS logo + project name
- Center-left: Agent status badge (green RUNNING / yellow PAUSED / red HALTED)
- Center-right: Today's spend with daily budget remaining (e.g., "$4.23 / $20.00")
- Right: **KILL SWITCH** — large red button with destructive styling

**Sidebar (persistent, collapsible):**
- Navigation links with icons: Overview, PRs, Quality, Cost, Health, Settings
- Bottom section: Current trust level indicator with graduation progress bar
- Collapse to icon-only on mobile

### 2.2 Overview Page (`/`)

The command center. One-glance health check for the entire system.

```
+------------------------------------------------------------------+
|  [Active Session]                    [Key Metrics - 7 Day]       |
|  Repo: facebook/react               Merge Rate: 34% [+5%]       |
|  Task: Fix #4521 - useEffect        Cost/Merged: $18.40 [-12%]  |
|  Type: bug_fix                       Quality: 82/100 [+3]       |
|  Elapsed: 12m 34s                    Sentiment: Positive [=]     |
|  Tokens: 45.2K in / 8.1K out                                    |
|  Session Cost: $0.87                                             |
|  [Progress Bar: context window 34% used]                         |
+------------------------------------------------------------------+
|                                                                  |
|  [Daily Cost Burn Rate]              [Merge Rate by Type]        |
|  ================================   Docs:     ████████░░ 52%     |
|  Real-time line chart showing        Fixes:    ███░░░░░░░ 28%    |
|  cumulative spend today vs           Features: ██░░░░░░░░ 15%    |
|  budget ceiling ($20 line)                                       |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Recent PR Activity]                                            |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │ Repo          │ Title         │ Type │ Diff │ Status     │    |
|  │ facebook/react│ Fix useEffect │ fix  │ 42   │ ✓ Merged   │    |
|  │ vercel/next   │ Update docs   │ docs │ 18   │ ⏳ Open    │    |
|  │ prisma/prisma │ Add test      │ fix  │ 156  │ ✗ Rejected │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Trust Level]                       [Auto-Halt Status]          |
|  docs_only ──●── fixes ──○── features   All Clear ✓             |
|  Current: FIXES (graduated 2026-03-10)  No halt triggers active  |
|  Next: 5 more merged fix PRs needed     Last halt: 2026-03-08   |
|                                                                  |
+------------------------------------------------------------------+
```

**Components:**
- `ActiveSessionCard` — live session details with context window gauge
- `KeyMetricsRow` — 4 metric cards (merge rate, cost/merged, quality score, sentiment) each with 7-day trend arrows
- `DailyBurnChart` — Recharts `AreaChart` with real-time cumulative spend line and budget ceiling `ReferenceLine`
- `MergeRateByType` — horizontal stacked `BarChart` showing docs/fixes/features merge rates
- `RecentPRTable` — last 10 PRs with status badges, compact DataTable
- `TrustLevelProgress` — stepped progress indicator showing current level and graduation criteria
- `AutoHaltStatus` — green checkmark or red alert showing halt trigger status

### 2.3 PRs Page (`/prs`)

Detailed PR lifecycle tracking and analysis.

```
+------------------------------------------------------------------+
|  [Filters]                                                       |
|  Repo: [All ▼]  Type: [All ▼]  Status: [All ▼]  Date: [7d ▼]  |
+------------------------------------------------------------------+
|                                                                  |
|  [Merge Rate by Task Type]           [Diff Size Distribution]    |
|  ┌────────────────────┐              ┌────────────────────┐      |
|  │  Stacked bar chart │              │  Histogram with    │      |
|  │  showing attempted │              │  200 LOC hard      │      |
|  │  vs merged by type │              │  limit red line    │      |
|  │  over time (weekly)│              │                    │      |
|  └────────────────────┘              └────────────────────┘      |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [PR Table - Full Detail]                                        |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │ Repo     │ Title     │ Type │ Diff │ Cost  │ Status │ Time│   |
|  │ (sort)   │ (search)  │(filt)│(sort)│ (sort)│ (filt) │(sort│   |
|  │          │           │      │      │       │        │     │   |
|  │ Paginated, 25 per page                                   │   |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [PR Lifecycle Timeline]                                         |
|  Selected PR: facebook/react#4521                                |
|  ●─────●─────●─────●─────●                                      |
|  Created  Pushed  CI Pass  Reviewed  Merged                     |
|  12:04    12:05   12:18    14:30     15:02                       |
|                                                                  |
+------------------------------------------------------------------+
```

**PR Table Columns:**

| Column | Type | Notes |
|--------|------|-------|
| Repo | text, filterable | Owner/repo format |
| Title | text, searchable | Truncated with tooltip |
| Task Type | badge, filterable | docs / fix / feature / refactor |
| Diff LOC | number, sortable | Red text if >200 |
| Files Changed | number, sortable | Yellow if >5 |
| Cost | currency, sortable | Total session cost for this PR |
| Status | badge, filterable | draft / open / merged / closed / rejected |
| Submitted | date, sortable | Relative time (e.g., "2h ago") |
| Time to Merge | duration, sortable | Blank if not merged |

### 2.4 Quality Page (`/quality`)

The anti-slop dashboard. Focused entirely on output quality and maintainer satisfaction.

```
+------------------------------------------------------------------+
|                                                                  |
|  [Quality Score Trend]                                           |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │  Line chart: quality score over time (30 days)            │    |
|  │  Y-axis: 0-100, with colored zones                        │    |
|  │  Green zone: 70-100 (healthy)                             │    |
|  │  Yellow zone: 50-70 (concerning)                          │    |
|  │  Red zone: 0-50 (halt recommended)                        │    |
|  │  Reference line at current score                          │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Maintainer Sentiment]              [Rejection Reasons]         |
|  ┌────────────────────┐              ┌────────────────────┐      |
|  │  Stacked area chart│              │  Donut chart:       │      |
|  │  Positive (green)  │              │  - Wrong approach   │      |
|  │  Neutral (gray)    │              │  - Style issues     │      |
|  │  Negative (red)    │              │  - Tests failing    │      |
|  │  over time         │              │  - Too invasive     │      |
|  │                    │              │  - Not needed       │      |
|  │  Auto-halt line    │              │  - Slop detected    │      |
|  └────────────────────┘              └────────────────────┘      |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Auto-Halt History]                                             |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │ Date       │ Trigger          │ Duration │ Resolution     │    |
|  │ 2026-03-08 │ Negative sent.   │ 4h 12m   │ Manual resume │    |
|  │ 2026-03-05 │ Cost runaway     │ 0h 03m   │ Auto-resolved │    |
|  │ 2026-03-01 │ 3x rejections    │ 12h 00m  │ Config change │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Slop Pattern Alerts]                                           |
|  ⚠ 2 PRs this week had unnecessary abstraction patterns         |
|  ⚠ 1 PR exceeded file count limit (7 files changed)             |
|  ✓ No test theater detected                                     |
|  ✓ No cargo-cult patterns detected                              |
|                                                                  |
+------------------------------------------------------------------+
```

**Quality Score Formula:**
```
quality_score = (
  merge_rate_7d       * 0.35 +   // Did maintainers want it?
  sentiment_score     * 0.25 +   // Are maintainers happy?
  ci_pass_rate        * 0.15 +   // Does the code work?
  diff_compliance     * 0.15 +   // Within size limits?
  cost_efficiency     * 0.10     // Reasonable cost per merge?
)
```

Each sub-score is normalized to 0-100. The weights prioritize **human judgment** (merge rate + sentiment = 60%) over mechanical checks (CI + diff size + cost = 40%).

**Sentiment Classification:**
- **Positive:** PR merged, approving review, positive comment keywords (e.g., "great", "thanks", "LGTM", "nice fix")
- **Neutral:** Request for changes without negative tone, clarifying questions
- **Negative:** Rejection with negative keywords (e.g., "unnecessary", "not needed", "please don't", "AI slop", "revert"), PR closed without merge, maintainer explicitly flags as unwanted

**Auto-Halt Triggers:**

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Negative sentiment ratio | >40% of last 10 interactions | Halt + alert |
| Consecutive rejections | 3 in a row | Halt + alert |
| Quality score drop | Below 50 for 24h | Halt + alert |
| Maintainer ban signal | Any "ban", "block", "stop" keyword | Immediate halt |

### 2.5 Cost Page (`/cost`)

Financial tracking and runaway prevention.

```
+------------------------------------------------------------------+
|                                                                  |
|  [Budget Overview]                                               |
|  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        |
|  │ Today    │  │ This Week│  │ This Month│  │ All Time │        |
|  │ $4.23    │  │ $28.50   │  │ $142.30   │  │ $387.60  │        |
|  │ /$20     │  │ /$100    │  │ /$500     │  │          │        |
|  │ [gauge]  │  │ [gauge]  │  │ [gauge]   │  │          │        |
|  └──────────┘  └──────────┘  └──────────┘  └──────────┘        |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Daily Spend Trend]                 [Cost per Merged PR]        |
|  ┌────────────────────┐              ┌────────────────────┐      |
|  │  Bar chart: daily  │              │  Bar chart by type: │      |
|  │  spend over 30 days│              │  Docs: $4.20        │      |
|  │  with budget line  │              │  Fixes: $22.50      │      |
|  │  Color: green under│              │  Features: $67.00   │      |
|  │  yellow near limit │              │  (cost per MERGED PR)│     |
|  │  red over budget   │              │                     │      |
|  └────────────────────┘              └────────────────────┘      |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Session Cost Breakdown]                                        |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │ Session ID │ Repo      │ Task     │ Duration │ Cost │ Outcome│ |
|  │ sess_abc   │ fb/react  │ bug_fix  │ 12m 34s  │$0.87 │ ✓ PR  │ |
|  │ sess_def   │ vercel/nxt│ docs     │ 4m 12s   │$0.23 │ ✓ PR  │ |
|  │ sess_ghi   │ prisma    │ feature  │ 28m 01s  │$4.12 │ ✗ Fail│ |
|  │ sess_jkl   │ fb/react  │ bug_fix  │ 45m 00s  │$8.90 │ ⚠ Halt│ |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Projected Monthly Spend]           [Runaway Detection]         |
|  Based on 7-day trend:               ┌────────────────────┐     |
|  Projected: $380 ± $60               │ Current session:    │     |
|  Budget: $500/mo                     │ $0.87 (12m)         │     |
|  Status: ON TRACK ✓                  │ Burn rate: $4.18/hr │     |
|                                      │ Alert at: $15/sess  │     |
|                                      │ Status: NORMAL ✓    │     |
|                                      └────────────────────┘     |
|                                                                  |
+------------------------------------------------------------------+
```

**Runaway Session Detection:**
```
burn_rate = session_cost / session_duration_hours

Thresholds:
  NORMAL:  burn_rate < $10/hr AND session_cost < $10
  WARNING: burn_rate > $10/hr OR session_cost > $10
  DANGER:  burn_rate > $20/hr OR session_cost > $15
  HALT:    session_cost > $20 (auto-halt triggered)
```

### 2.6 Health Page (`/health`)

Operational monitoring for the agent infrastructure.

```
+------------------------------------------------------------------+
|                                                                  |
|  [Agent Status]                                                  |
|  Status: RUNNING          Uptime: 99.2% (7d)                    |
|  Current Session: sess_abc123       Started: 12m ago             |
|  Last Error: None (3 days ago)                                   |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Context Window]                    [Rate Limits]               |
|  ┌────────────────────┐              ┌────────────────────┐      |
|  │  Gauge: 34% used   │              │ Anthropic API:     │      |
|  │                    │              │ Input:  12K/30K TPM │      |
|  │  ████████░░░░░░░░  │              │ Output: 3K/10K TPM │      |
|  │  348K / 1M tokens  │              │ Requests: 45/60 RPM│      |
|  │                    │              │                    │      |
|  │  Compaction count: 2│              │ GitHub API:        │      |
|  │                    │              │ 4,231 / 5,000 /hr  │      |
|  └────────────────────┘              └────────────────────┘      |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Uptime Chart - 30 Days]                                        |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │  Heatmap-style availability chart (GitHub-style)          │    |
|  │  Green = running, Gray = idle, Red = error/halted         │    |
|  │  Each cell = 1 hour                                       │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Error Log]                                                     |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │ Time       │ Type           │ Message              │ Sess │    |
|  │ 2h ago     │ rate_limit     │ GitHub 429 - retry   │ abc  │    |
|  │ 1d ago     │ context_full   │ Compaction triggered  │ xyz  │    |
|  │ 3d ago     │ stuck_loop     │ 3x same error, halted│ def  │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Stuck Loop Detection]                                          |
|  Status: CLEAR ✓                                                |
|  Last detected: 3 days ago (session def)                         |
|  Trigger: Same tool error repeated 3 times                       |
|  Resolution: Auto-halted, session abandoned                      |
|                                                                  |
+------------------------------------------------------------------+
```

### 2.7 Settings Page (`/settings`)

Configuration management for all operational parameters.

```
+------------------------------------------------------------------+
|                                                                  |
|  [Budget Limits]                     [Quality Gates]             |
|  Daily:   [$20____] /day             Max diff LOC: [200___]      |
|  Weekly:  [$100___] /week            Max files:    [5_____]      |
|  Monthly: [$500___] /month           Max PR attempts/day: [5]    |
|  Per-session: [$20_] /session        CI must pass: [✓]           |
|  [Save]                              [Save]                      |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Trust Level Management]                                        |
|  Current Level: FIXES                                            |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │ Level      │ Criteria to Graduate      │ Status          │    |
|  │ docs_only  │ 10 merged doc PRs         │ ✓ Completed     │    |
|  │ fixes      │ 15 merged fix PRs         │ 8/15 (53%)      │    |
|  │ features   │ Manual approval required  │ Locked          │    |
|  └──────────────────────────────────────────────────────────┘    |
|  Override: [Force level ▼]  ⚠ Use with caution                  |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Auto-Halt Configuration]                                       |
|  Enabled: [✓]                                                    |
|  Negative sentiment threshold:  [40__]% of last [10__] interactions|
|  Consecutive rejection limit:   [3___]                           |
|  Quality score floor:           [50__]                           |
|  Session cost ceiling:          [$20_]                            |
|  Burn rate ceiling:             [$20_]/hr                        |
|  [Save]                                                          |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Target Repositories]                                           |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │ Repository        │ Trust │ PRs │ Merge Rate │ Actions   │    |
|  │ facebook/react     │ fixes │ 12  │ 33%        │ [Edit][X] │    |
|  │ vercel/next.js     │ docs  │ 5   │ 60%        │ [Edit][X] │    |
|  │ prisma/prisma      │ docs  │ 3   │ 67%        │ [Edit][X] │    |
|  └──────────────────────────────────────────────────────────┘    |
|  [+ Add Repository]                                              |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Notifications]                     [Authentication]            |
|  Email alerts: [✓]                   Provider: GitHub OAuth      |
|  Slack webhook: [url________]        Allowed users: [kevin]      |
|  Alert on: [✓] Auto-halt            [Manage Access]             |
|            [✓] Budget warning                                    |
|            [✓] PR merged                                         |
|            [ ] PR submitted                                      |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 3. Data Model

### 3.1 Database Schema (Vercel Postgres)

```sql
-- Agent sessions
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,          -- e.g., "sess_abc123"
  started_at    TIMESTAMPTZ NOT NULL,
  ended_at      TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'running',  -- running, completed, failed, stuck, halted
  target_repo   TEXT NOT NULL,             -- e.g., "facebook/react"
  task_type     TEXT NOT NULL,             -- docs, fix, feature, refactor, deps
  task_ref      TEXT,                      -- GitHub issue URL or description
  tokens_input  BIGINT DEFAULT 0,
  tokens_output BIGINT DEFAULT 0,
  cost_usd      DECIMAL(10,4) DEFAULT 0,
  outcome       TEXT,                      -- pr_created, pr_merged, failed, abandoned, halted
  trust_level   TEXT NOT NULL,             -- docs_only, fixes, features
  error_message TEXT,
  compaction_count INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Pull requests
CREATE TABLE pull_requests (
  id              SERIAL PRIMARY KEY,
  session_id      TEXT REFERENCES sessions(id),
  github_url      TEXT NOT NULL UNIQUE,     -- Full PR URL
  repo            TEXT NOT NULL,
  pr_number       INT NOT NULL,
  title           TEXT NOT NULL,
  task_type       TEXT NOT NULL,
  diff_additions  INT NOT NULL DEFAULT 0,
  diff_deletions  INT NOT NULL DEFAULT 0,
  diff_total      INT GENERATED ALWAYS AS (diff_additions + diff_deletions) STORED,
  files_changed   INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'open',  -- draft, open, merged, closed, rejected
  submitted_at    TIMESTAMPTZ NOT NULL,
  merged_at       TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  cost_usd        DECIMAL(10,4) DEFAULT 0,
  quality_score   INT,                     -- 0-100, calculated after outcome known
  self_review_passed BOOLEAN,
  ci_passed       BOOLEAN,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Maintainer reviews and comments
CREATE TABLE reviews (
  id              SERIAL PRIMARY KEY,
  pr_id           INT REFERENCES pull_requests(id),
  github_user     TEXT NOT NULL,
  review_type     TEXT NOT NULL,            -- approval, changes_requested, comment, rejection
  sentiment       TEXT NOT NULL,            -- positive, neutral, negative
  body            TEXT,
  is_maintainer   BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL
);

-- Quality gate events
CREATE TABLE quality_events (
  id              SERIAL PRIMARY KEY,
  pr_id           INT REFERENCES pull_requests(id),
  session_id      TEXT REFERENCES sessions(id),
  event_type      TEXT NOT NULL,            -- ci_pass, ci_fail, lint_pass, lint_fail,
                                            -- size_violation, slop_detected, self_review_pass,
                                            -- self_review_fail
  severity        TEXT DEFAULT 'info',      -- info, warning, error
  details         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Cost tracking events (granular)
CREATE TABLE cost_events (
  id                  SERIAL PRIMARY KEY,
  session_id          TEXT REFERENCES sessions(id),
  event_type          TEXT NOT NULL,         -- api_call, tool_use
  model               TEXT,                  -- claude-opus-4-6, claude-sonnet-4-6, etc.
  tokens_input        INT DEFAULT 0,
  tokens_output       INT DEFAULT 0,
  cost_usd            DECIMAL(10,4) DEFAULT 0,
  cumulative_session   DECIMAL(10,4) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Agent health snapshots (every 60s during active session)
CREATE TABLE health_snapshots (
  id                          SERIAL PRIMARY KEY,
  session_id                  TEXT REFERENCES sessions(id),
  context_utilization_pct     DECIMAL(5,2),
  anthropic_input_tpm_used    INT,
  anthropic_input_tpm_limit   INT,
  anthropic_output_tpm_used   INT,
  anthropic_output_tpm_limit  INT,
  github_requests_used        INT,
  github_requests_limit       INT,
  agent_status                TEXT NOT NULL,  -- healthy, degraded, stuck, halted
  error_message               TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-halt events
CREATE TABLE halt_events (
  id              SERIAL PRIMARY KEY,
  trigger_type    TEXT NOT NULL,             -- negative_sentiment, consecutive_rejections,
                                             -- quality_floor, cost_runaway, manual, stuck_loop
  trigger_details JSONB,
  halted_at       TIMESTAMPTZ NOT NULL,
  resumed_at      TIMESTAMPTZ,
  resumed_by      TEXT,                      -- manual, auto, config_change
  duration_seconds INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Trust level tracking per repo
CREATE TABLE trust_levels (
  id              SERIAL PRIMARY KEY,
  repo            TEXT NOT NULL UNIQUE,
  current_level   TEXT NOT NULL DEFAULT 'docs_only',  -- docs_only, fixes, features
  docs_merged     INT DEFAULT 0,
  fixes_merged    INT DEFAULT 0,
  features_merged INT DEFAULT 0,
  graduated_at    TIMESTAMPTZ,              -- When current level was reached
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Settings (key-value with typed values)
CREATE TABLE settings (
  key             TEXT PRIMARY KEY,
  value           JSONB NOT NULL,
  description     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX idx_sessions_repo ON sessions(target_repo);
CREATE INDEX idx_prs_repo ON pull_requests(repo);
CREATE INDEX idx_prs_status ON pull_requests(status);
CREATE INDEX idx_prs_submitted ON pull_requests(submitted_at DESC);
CREATE INDEX idx_reviews_pr ON reviews(pr_id);
CREATE INDEX idx_reviews_sentiment ON reviews(sentiment);
CREATE INDEX idx_cost_events_session ON cost_events(session_id);
CREATE INDEX idx_health_session ON health_snapshots(session_id);
CREATE INDEX idx_health_created ON health_snapshots(created_at DESC);
```

### 3.2 Vercel KV (Redis) — Real-Time State

```
kill_switch:active        = "true" | "false"
kill_switch:activated_at  = ISO timestamp
kill_switch:activated_by  = user ID
kill_switch:reason        = text

agent:status              = "running" | "paused" | "halted"
agent:current_session     = session ID
agent:last_heartbeat      = ISO timestamp

session:{id}:cost         = cumulative cost (updated every API call)
session:{id}:tokens_in    = cumulative input tokens
session:{id}:tokens_out   = cumulative output tokens
session:{id}:burn_rate    = current $/hour rate

budget:daily:spent        = today's cumulative spend (reset at midnight UTC)
budget:weekly:spent       = this week's cumulative spend
budget:monthly:spent      = this month's cumulative spend
```

KV is used for data that must be read in real-time by both the dashboard (for display) and the agent hooks (for decision-making). The kill switch state must have sub-second read latency.

---

## 4. API Routes

### 4.1 Route Definitions

All routes use Next.js 15 App Router route handlers.

```
app/api/
├── events/
│   └── route.ts              POST   — Webhook receiver for agent events
├── sessions/
│   └── route.ts              GET    — List sessions with filters
├── prs/
│   └── route.ts              GET    — List PRs with filters
├── quality/
│   └── route.ts              GET    — Quality metrics aggregation
├── cost/
│   └── route.ts              GET    — Cost metrics by period
├── cost/burn-rate/
│   └── route.ts              GET    — Real-time burn rate (reads KV)
├── health/
│   └── route.ts              GET    — Current agent health snapshot
├── health/history/
│   └── route.ts              GET    — Health snapshot history
├── kill-switch/
│   └── route.ts              GET    — Current kill switch state
│                              POST   — Activate/deactivate kill switch
├── settings/
│   └── route.ts              GET    — Read all settings
│                              PUT    — Update settings
├── trust/
│   └── route.ts              GET    — Trust levels for all repos
│                              PUT    — Update trust level
└── webhooks/
    └── github/
        └── route.ts          POST   — GitHub webhook receiver
```

### 4.2 Key API Contracts

**POST /api/events** — Agent event ingestion (called by OpenClaw hooks)
```typescript
// Request body
type AgentEvent = {
  type: 'session_start' | 'session_end' | 'cost_tick' | 'pr_created' |
        'pr_updated' | 'tool_call' | 'error' | 'health_snapshot';
  session_id: string;
  timestamp: string;  // ISO 8601
  data: Record<string, unknown>;
  // For cost_tick: { tokens_input, tokens_output, cost_usd, model }
  // For pr_created: { github_url, repo, pr_number, title, task_type, diff_stats }
  // For health_snapshot: { context_pct, rate_limits, status }
  // For error: { error_type, message, is_stuck_loop }
};

// Response
{ received: true, kill_switch: boolean }
// Agent hook checks kill_switch in response — if true, halts immediately
```

**POST /api/kill-switch** — Emergency stop
```typescript
// Request
{ active: boolean; reason?: string }

// Response
{ active: boolean; activated_at?: string; activated_by?: string }

// Side effects:
// 1. Writes to Vercel KV immediately
// 2. If activating: records halt_event in Postgres
// 3. Agent's next hook check reads KV and halts
```

**GET /api/quality** — Quality metrics aggregation
```typescript
// Query params: ?period=7d|30d|90d

// Response
{
  quality_score: number;         // Current composite score 0-100
  quality_trend: DataPoint[];    // { date, score } over period
  merge_rate: {
    overall: number;             // e.g., 0.34
    by_type: {
      docs: number;
      fixes: number;
      features: number;
    };
  };
  sentiment: {
    positive: number;            // Count in period
    neutral: number;
    negative: number;
    trend: DataPoint[];          // { date, positive, neutral, negative }
  };
  rejection_reasons: {
    reason: string;
    count: number;
  }[];
  auto_halt_events: HaltEvent[];
  slop_alerts: SlopAlert[];
}
```

**GET /api/cost** — Cost aggregation
```typescript
// Query params: ?period=1d|7d|30d

// Response
{
  total_spend: number;
  budget_remaining: {
    daily: { spent: number; limit: number };
    weekly: { spent: number; limit: number };
    monthly: { spent: number; limit: number };
  };
  daily_trend: { date: string; amount: number }[];
  cost_per_merged_pr: {
    overall: number;
    by_type: { docs: number; fixes: number; features: number };
  };
  sessions: SessionCostSummary[];
  projected_monthly: { low: number; mid: number; high: number };
  current_burn_rate: {
    session_cost: number;
    rate_per_hour: number;
    status: 'normal' | 'warning' | 'danger';
  };
}
```

### 4.3 Vercel Cron Jobs

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/github-sync",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/budget-reset",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/quality-score",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/health-check",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

| Cron | Schedule | Purpose |
|------|----------|---------|
| github-sync | Every 15 min | Sync PR status, reviews, comments from GitHub API |
| budget-reset | Daily midnight UTC | Reset daily budget counter in KV |
| quality-score | Every 6 hours | Recalculate quality scores for all PRs |
| health-check | Every 5 min | Check agent heartbeat, detect stale sessions |

---

## 5. Data Flow Architecture

### 5.1 Agent -> Dashboard Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                      OpenClaw Agent                         │
│                                                             │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Session  │───>│  Hooks   │───>│  HTTP    │──────────┐   │
│  │ Manager  │    │ (pre/   │    │  POST    │          │   │
│  │          │    │  post)   │    │          │          │   │
│  └─────────┘    └──────────┘    └──────────┘          │   │
│       │              │                                 │   │
│       │         ┌────┴─────┐                          │   │
│       │         │ Check KV │ <── Kill switch check    │   │
│       │         │ kill_sw  │     before every action  │   │
│       │         └──────────┘                          │   │
└───────│───────────────────────────────────────────────│───┘
        │                                               │
        │                                               │
        v                                               v
┌───────────────┐                          ┌──────────────────┐
│  GitHub API   │                          │  Dashboard API   │
│               │<──── Webhooks ──────────>│  /api/events     │
│  PRs, Reviews │                          │  /api/webhooks   │
│  Comments     │                          │                  │
└───────────────┘                          └────────┬─────────┘
                                                    │
                                           ┌────────┴─────────┐
                                           │                  │
                                    ┌──────▼──┐        ┌──────▼──┐
                                    │ Vercel  │        │ Vercel  │
                                    │ Postgres│        │   KV    │
                                    │ (durable│        │ (real-  │
                                    │  data)  │        │  time)  │
                                    └─────────┘        └─────────┘
                                           │                  │
                                    ┌──────┴──────────────────┴──┐
                                    │                            │
                                    │    Dashboard Frontend      │
                                    │    (Next.js RSC + Client)  │
                                    │                            │
                                    │  Server Components: data   │
                                    │  Client Components: charts │
                                    │  SWR polling: real-time    │
                                    │                            │
                                    └────────────────────────────┘
```

### 5.2 Hook Integration

Since we configure but don't modify OpenClaw, data collection happens through hooks. The ClawOSS agent configuration includes hook scripts that POST events to the dashboard:

```bash
# hooks/post-tool-call.sh — Runs after every tool call
#!/bin/bash
# Report cost tick to dashboard
curl -s -X POST "$CLAWOSS_DASHBOARD_URL/api/events" \
  -H "Authorization: Bearer $CLAWOSS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"cost_tick\",
    \"session_id\": \"$SESSION_ID\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"tokens_input\": $TOKENS_IN,
      \"tokens_output\": $TOKENS_OUT,
      \"cost_usd\": $COST,
      \"model\": \"$MODEL\"
    }
  }"

# Check kill switch in response
RESPONSE=$(curl -s "$CLAWOSS_DASHBOARD_URL/api/kill-switch" \
  -H "Authorization: Bearer $CLAWOSS_API_KEY")
KILL=$(echo "$RESPONSE" | jq -r '.active')
if [ "$KILL" = "true" ]; then
  echo "KILL SWITCH ACTIVE — halting agent"
  exit 1
fi
```

```bash
# hooks/session-start.sh
#!/bin/bash
curl -s -X POST "$CLAWOSS_DASHBOARD_URL/api/events" \
  -H "Authorization: Bearer $CLAWOSS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"session_start\",
    \"session_id\": \"$SESSION_ID\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"data\": {
      \"target_repo\": \"$TARGET_REPO\",
      \"task_type\": \"$TASK_TYPE\",
      \"task_ref\": \"$TASK_REF\",
      \"trust_level\": \"$TRUST_LEVEL\"
    }
  }"
```

### 5.3 Real-Time Updates (Client)

The dashboard uses SWR polling for Vercel compatibility:

```typescript
// hooks/useRealtimeData.ts
'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useAgentStatus() {
  return useSWR('/api/health', fetcher, {
    refreshInterval: 5000,  // Poll every 5 seconds
  });
}

export function useBurnRate() {
  return useSWR('/api/cost/burn-rate', fetcher, {
    refreshInterval: 10000, // Poll every 10 seconds
  });
}

export function useKillSwitch() {
  return useSWR('/api/kill-switch', fetcher, {
    refreshInterval: 2000,  // Poll every 2 seconds (safety-critical)
  });
}
```

---

## 6. Component Hierarchy

### 6.1 Full Component Tree

```
app/
├── layout.tsx                          # RootLayout: providers, sidebar, header
│   ├── components/layout/
│   │   ├── AppShell.tsx                # SidebarProvider + SidebarInset wrapper
│   │   ├── AppSidebar.tsx              # shadcn Sidebar with nav items + trust indicator
│   │   ├── AppHeader.tsx               # Header bar: status, spend, kill switch
│   │   ├── KillSwitchButton.tsx        # Red emergency stop (client component)
│   │   ├── AgentStatusBadge.tsx        # Green/yellow/red status indicator
│   │   └── DailySpendIndicator.tsx     # Spend counter in header
│   │
├── page.tsx                            # OverviewPage (server component)
│   ├── components/overview/
│   │   ├── ActiveSessionCard.tsx       # Live session info (client - polls)
│   │   ├── KeyMetricsRow.tsx           # 4x MetricCard with trends
│   │   ├── DailyBurnChart.tsx          # Recharts AreaChart (client)
│   │   ├── MergeRateByTypeChart.tsx    # Recharts BarChart
│   │   ├── RecentPRTable.tsx           # Compact DataTable, last 10 PRs
│   │   ├── TrustLevelProgress.tsx      # Stepped progress indicator
│   │   └── AutoHaltStatusCard.tsx      # Green check or red alert
│   │
├── prs/page.tsx                        # PRsPage
│   ├── components/prs/
│   │   ├── PRFilters.tsx               # Filter bar (repo, type, status, date)
│   │   ├── MergeRateTrendChart.tsx     # Grouped bar chart over time
│   │   ├── DiffSizeHistogram.tsx       # Histogram with 200 LOC line
│   │   ├── PRDataTable.tsx             # Full sortable/filterable/paginated table
│   │   └── PRLifecycleTimeline.tsx     # Horizontal timeline for selected PR
│   │
├── quality/page.tsx                    # QualityPage
│   ├── components/quality/
│   │   ├── QualityScoreTrend.tsx       # AreaChart with colored zones
│   │   ├── SentimentChart.tsx          # Stacked area chart
│   │   ├── RejectionReasonsDonut.tsx   # PieChart donut
│   │   ├── AutoHaltHistoryTable.tsx    # DataTable of halt events
│   │   └── SlopAlertCards.tsx          # Alert cards for detected patterns
│   │
├── cost/page.tsx                       # CostPage
│   ├── components/cost/
│   │   ├── BudgetGauges.tsx            # 3x radial gauges (daily/weekly/monthly)
│   │   ├── DailySpendChart.tsx         # BarChart with conditional coloring
│   │   ├── CostPerMergedChart.tsx      # BarChart by task type
│   │   ├── SessionCostTable.tsx        # DataTable of sessions
│   │   ├── ProjectedSpendCard.tsx      # Text card with projection
│   │   └── RunawayDetectorCard.tsx     # Live burn rate monitor (client)
│   │
├── health/page.tsx                     # HealthPage
│   ├── components/health/
│   │   ├── AgentStatusDetail.tsx       # Detailed status card
│   │   ├── ContextWindowGauge.tsx      # Gauge with compaction count
│   │   ├── RateLimitGauges.tsx         # Dual gauge (Anthropic + GitHub)
│   │   ├── UptimeHeatmap.tsx           # GitHub-style 30-day heatmap
│   │   ├── ErrorLogTable.tsx           # DataTable of errors
│   │   └── StuckLoopCard.tsx           # Loop detection status
│   │
├── settings/page.tsx                   # SettingsPage
│   ├── components/settings/
│   │   ├── BudgetSettingsForm.tsx      # Budget limit inputs
│   │   ├── QualityGateForm.tsx         # Quality gate threshold inputs
│   │   ├── TrustLevelManager.tsx       # Trust table with override
│   │   ├── AutoHaltConfigForm.tsx      # Halt threshold inputs
│   │   ├── RepoManagementTable.tsx     # Target repos CRUD
│   │   ├── NotificationForm.tsx        # Notification preferences
│   │   └── AuthSettingsForm.tsx        # Access management
│   │
├── components/shared/                  # Reusable primitives
│   ├── MetricCard.tsx                  # Card with value, label, trend arrow
│   ├── TrendIndicator.tsx              # Up/down arrow with % change
│   ├── StatusBadge.tsx                 # Colored pill badge
│   ├── DateRangePicker.tsx             # Date range selector
│   ├── EmptyState.tsx                  # "No data" placeholder
│   └── LoadingState.tsx                # Skeleton loading states
│
├── lib/
│   ├── db.ts                           # Vercel Postgres client
│   ├── kv.ts                           # Vercel KV client
│   ├── queries/                        # Database query functions
│   │   ├── sessions.ts
│   │   ├── prs.ts
│   │   ├── quality.ts
│   │   ├── cost.ts
│   │   ├── health.ts
│   │   └── settings.ts
│   ├── calculations/
│   │   ├── quality-score.ts            # Quality score computation
│   │   ├── sentiment.ts               # Sentiment classification
│   │   ├── burn-rate.ts               # Runaway detection logic
│   │   └── trust.ts                   # Trust level graduation logic
│   └── types.ts                        # Shared TypeScript types
│
└── hooks/
    ├── useRealtimeData.ts              # SWR hooks for polling
    └── useKillSwitch.ts                # Kill switch state + mutation
```

### 6.2 Server vs Client Component Strategy

| Component Type | Rendering | Why |
|---|---|---|
| Page layouts | Server | Static structure, data fetching |
| Data tables | Server (initial) + Client (interaction) | Initial load fast, sort/filter client-side |
| Charts | Client | Recharts requires browser DOM |
| Metric cards | Server | Static data display |
| Kill switch | Client | Must be interactive + poll state |
| Burn rate | Client | Must poll for real-time updates |
| Forms | Client | User interaction required |
| Status badges | Server (initial) + Client (update) | Show immediately, update via polling |

---

## 7. Kill Switch Design (Deep Dive)

The kill switch is the single most important UI element. It must be:
- **Impossible to miss** — always visible in the header
- **Impossible to accidentally trigger** — requires confirmation
- **Instant in effect** — sub-second propagation to agent
- **Clearly stateful** — obvious whether active or inactive

### 7.1 Visual Design

**Inactive state (agent running):**
```
┌─────────────────────┐
│  ■ STOP AGENT       │   <- Red background, white text
│                     │      Subtle pulse animation
└─────────────────────┘
```

**Confirmation dialog (after click):**
```
┌──────────────────────────────────────┐
│  ⚠ Emergency Stop                   │
│                                      │
│  This will immediately halt the      │
│  ClawOSS agent. Any in-progress      │
│  session will be abandoned.          │
│                                      │
│  Reason (optional):                  │
│  [_________________________________]│
│                                      │
│  [Cancel]          [CONFIRM STOP]    │
└──────────────────────────────────────┘
```

**Active state (agent halted):**
```
┌─────────────────────┐
│  ▶ RESUME AGENT     │   <- Green background, white text
│  Halted 2h ago      │      No animation (calm state)
└─────────────────────┘
```

### 7.2 Implementation Flow

```
User clicks STOP
    │
    ▼
Confirmation dialog appears (shadcn AlertDialog)
    │
    ▼ (confirmed)
    │
POST /api/kill-switch { active: true, reason: "..." }
    │
    ├──> Write to Vercel KV: kill_switch:active = "true"
    │    (sub-millisecond write)
    │
    ├──> Insert halt_event in Postgres
    │    (async, non-blocking)
    │
    ├──> Send notification (Slack/email)
    │    (async, non-blocking)
    │
    └──> Return { active: true } to frontend
         │
         ▼
    Dashboard updates to HALTED state
    All pages show halted indicator

Meanwhile, agent's hook:
    │
    Agent makes any action
    │
    ▼
    Hook fires → reads kill_switch from /api/events response
    │
    ▼
    kill_switch = true → agent exits immediately
```

---

## 8. Trust Level System

### 8.1 Graduation Criteria

```
Level 1: DOCS_ONLY
├── Allowed tasks: documentation, README, comments, typo fixes
├── Graduate to FIXES when: 10 merged doc PRs with >50% merge rate
└── Expected timeline: Week 1-2

Level 2: FIXES
├── Allowed tasks: Level 1 + bug fixes, lint fixes, dep updates, test additions
├── Graduate to FEATURES when: 15 merged fix PRs with >25% merge rate
│   AND quality score >70 for 14 consecutive days
│   AND zero negative sentiment events in last 14 days
└── Expected timeline: Week 3-8

Level 3: FEATURES
├── Allowed tasks: Level 2 + small feature additions, refactors
├── Requirements: Manual human approval to enter this level
├── Additional gates: Max 100 LOC diff (stricter than global 200)
└── Expected timeline: Month 3+
```

### 8.2 Dashboard Indicator

The sidebar shows a stepped progress bar:

```
Trust Level
┌──────────────────────┐
│ ● DOCS    Completed  │  (dimmed green)
│ ● FIXES   8/15 PRs   │  (bright, active)
│ ○ FEATURES Locked    │  (gray, locked icon)
│                      │
│ [████████░░░░] 53%   │  (progress to next level)
└──────────────────────┘
```

---

## 9. Deployment Architecture

### 9.1 Vercel Project Structure

```
dashboard/
├── app/                    # Next.js App Router pages and API routes
├── components/             # React components
├── lib/                    # Utilities, DB clients, calculations
├── hooks/                  # Client-side React hooks
├── public/                 # Static assets
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json             # Cron job configuration
└── .env.local              # Local environment variables
```

### 9.2 Environment Variables

```
# Vercel Postgres
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=

# Vercel KV
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=

# Authentication
AUTH_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# Agent communication
CLAWOSS_API_KEY=            # Shared secret for agent -> dashboard auth
CLAWOSS_WEBHOOK_SECRET=     # GitHub webhook secret

# Notifications
SLACK_WEBHOOK_URL=
```

### 9.3 Dependencies

```json
{
  "dependencies": {
    "next": "^15.1",
    "react": "^19.0",
    "react-dom": "^19.0",
    "@vercel/postgres": "^0.10",
    "@vercel/kv": "^3.0",
    "recharts": "^3.0",
    "@tanstack/react-table": "^8.0",
    "swr": "^2.0",
    "next-auth": "^5.0",
    "zod": "^3.0",
    "date-fns": "^4.0",
    "lucide-react": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest"
  },
  "devDependencies": {
    "typescript": "^5.0",
    "tailwindcss": "^4.0",
    "@tailwindcss/postcss": "latest",
    "shadcn": "latest"
  }
}
```

### 9.4 shadcn/ui Components Used

```bash
npx shadcn@latest add button card input label select separator
npx shadcn@latest add table badge progress alert alert-dialog
npx shadcn@latest add dialog dropdown-menu tooltip tabs
npx shadcn@latest add sidebar chart switch slider
npx shadcn@latest add skeleton avatar sheet
```

---

## 10. Metric Definitions (Reference)

### Non-Gameable Metrics (Primary)

| Metric | Formula | Why It Matters |
|--------|---------|----------------|
| **Merge Rate** | merged_prs / attempted_prs (7d rolling) | The only metric that directly measures if maintainers want our contributions |
| **Cost per Merged PR** | total_spend / merged_count (by type) | Efficiency — are we burning money on failed attempts? |
| **Quality Score** | Weighted composite (see Section 2.4) | Holistic health check combining human signals and mechanical checks |
| **Sentiment Score** | positive_reviews / total_reviews (10-interaction window) | Direct signal from maintainers — are they happy or annoyed? |
| **Diff Compliance** | prs_under_200_loc / total_prs | Guardrail metric — are we staying within safe boundaries? |

### Operational Metrics (Secondary)

| Metric | Formula | Why It Matters |
|--------|---------|----------------|
| **Burn Rate** | session_cost / session_hours | Detect runaway sessions before they get expensive |
| **Context Utilization** | tokens_used / context_limit | Predict compaction events and potential quality degradation |
| **Uptime** | running_hours / total_hours (7d) | Is the agent actually operating? |
| **Error Rate** | error_sessions / total_sessions | Detect systemic issues |
| **Time to Merge** | merged_at - submitted_at (median) | How long maintainers take to review (we can't control this, but can track) |

### Explicitly Excluded Metrics

| Metric | Why Excluded |
|--------|-------------|
| PR count | Incentivizes splitting trivial changes into many PRs |
| Lines of code | Incentivizes verbose solutions |
| Issues closed | Incentivizes cherry-picking easy issues |
| Test count | Incentivizes writing trivial assertion-free tests |
| Commit count | Meaningless noise |
| "Self-review passed" | Same-model blind spots make this metric worthless |

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1)
- Next.js 15 project setup with shadcn/ui + Tailwind
- Database schema deployment (Vercel Postgres)
- KV setup for real-time state
- API routes: /api/events, /api/kill-switch, /api/health
- Kill switch implementation (UI + backend + KV)
- Global layout with sidebar, header, agent status
- Overview page with placeholder data

### Phase 2: Core Pages (Week 2)
- PR page with DataTable + merge rate chart + diff histogram
- Cost page with budget gauges + daily trend + session table
- Quality page with score trend + sentiment tracker
- Health page with context gauge + rate limits + error log
- GitHub webhook integration for PR status updates
- Cron jobs for data sync

### Phase 3: Intelligence (Week 3)
- Quality score calculation engine
- Sentiment classification (keyword-based, upgradeable to LLM later)
- Auto-halt trigger system
- Trust level graduation logic
- Runaway session detection
- Slop pattern detection alerts

### Phase 4: Polish (Week 4)
- Settings page with full configuration management
- Notification system (Slack + email)
- Authentication (GitHub OAuth via NextAuth)
- Mobile responsive refinements
- Empty states and loading skeletons
- Error boundaries and fallback UI

---

## Sources

- [Next.js 15 App Router Documentation](https://nextjs.org/docs/app)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Recharts Documentation](https://recharts.org/)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv)
- [TanStack Table](https://tanstack.com/table)
- Devil's advocate analysis: `04-devils-advocate.md`
