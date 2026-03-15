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

An [OpenClaw](https://github.com/openclaw/openclaw) agent configuration that autonomously discovers issues, implements fixes, and submits pull requests to open-source projects — 24/7, without human intervention.

> **OpenClaw is the engine; ClawOSS is the race car.** We do not modify OpenClaw. We configure it with skills, workspace instructions, hooks, and monitoring.

---

## Gateway Architecture

```
    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    ░                                                                    ░
    ░   ╔══════════════════════════════════════════════════════════════╗  ░
    ░   ║              O P E N C L A W   G A T E W A Y               ║  ░
    ░   ║                     port 18789                              ║  ░
    ░   ╠══════════════════════════════════════════════════════════════╣  ░
    ░   ║                                                              ║  ░
    ░   ║   ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐  ║  ░
    ░   ║   │  HEARTBEAT  │  │   5 CRON    │  │    AGENT CONFIG    │  ║  ░
    ░   ║   │             │  │    JOBS     │  │                    │  ║  ░
    ░   ║   │  10m cycle  │  │             │  │  model: k2p5      │  ║  ░
    ░   ║   │  lightCtx   │  │  2h  disc   │  │  tools: coding    │  ║  ░
    ░   ║   │  9 steps    │  │  30m follow │  │  skills: 15       │  ║  ░
    ░   ║   │  self-wake  │  │  24h report │  │  hooks: 3         │  ║  ░
    ░   ║   │             │  │  7d  retro  │  │  maxConc: 5       │  ║  ░
    ░   ║   └──────┬──────┘  │  7d  clean  │  │  fallbacks: []    │  ║  ░
    ░   ║          │         └──────┬──────┘  └─────────┬──────────┘  ║  ░
    ░   ║          │                │                    │             ║  ░
    ░   ║   ┌──────┴────────────────┴────────────────────┴──────────┐  ║  ░
    ░   ║   │                                                        │  ║  ░
    ░   ║   │                  M A I N   S E S S I O N               │  ║  ░
    ░   ║   │                                                        │  ║  ░
    ░   ║   │   Orchestrator only. Never implements code directly.   │  ║  ░
    ░   ║   │   Manages: heartbeat, work queue, PR follow-ups.      │  ║  ░
    ░   ║   │                                                        │  ║  ░
    ░   ║   └──┬──────────┬──────────┬──────────┬──────────┬────────┘  ║  ░
    ░   ║      │          │          │          │          │            ║  ░
    ░   ╠══════╪══════════╪══════════╪══════════╪══════════╪════════════╣  ░
    ░   ║      │          │          │          │          │            ║  ░
    ░   ║   ┌──┴───┐   ┌──┴───┐  ┌──┴───┐  ┌──┴───┐  ┌──┴───┐       ║  ░
    ░   ║   │SUB 1 │   │SUB 2 │  │SUB 3 │  │SUB 4 │  │SUB 5 │       ║  ░
    ░   ║   │      │   │      │  │      │  │      │  │      │       ║  ░
    ░   ║   │/tmp/ │   │/tmp/ │  │/tmp/ │  │/tmp/ │  │/tmp/ │       ║  ░
    ░   ║   │clone │   │clone │  │clone │  │clone │  │clone │       ║  ░
    ░   ║   │test  │   │test  │  │test  │  │test  │  │test  │       ║  ░
    ░   ║   │fix   │   │fix   │  │fix   │  │fix   │  │fix   │       ║  ░
    ░   ║   │PR    │   │PR    │  │PR    │  │PR    │  │PR    │       ║  ░
    ░   ║   │clean │   │clean │  │clean │  │clean │  │clean │       ║  ░
    ░   ║   └──────┘   └──────┘  └──────┘  └──────┘  └──────┘       ║  ░
    ░   ║    fresh       fresh    fresh      fresh     fresh          ║  ░
    ░   ║    context     context  context    context   context        ║  ░
    ░   ║                                                              ║  ░
    ░   ╚══════════════════════════════════════════════════════════════╝  ░
    ░                                                                    ░
    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

Each sub-agent runs in an isolated `/tmp/clawoss-<issue>-<timestamp>/` directory. After PR submit or abandon, the directory is deleted. The orchestrator sweeps stale dirs (>60min) every cycle.

---

## Heartbeat Protocol

The heartbeat fires every 10 minutes with `lightContext: true`. It executes 9 steps in strict order. HEARTBEAT_OK is only valid when all slots are full or no work exists.

```
    ╔═══════════════════════════════════════════════════════════════════╗
    ║                  H E A R T B E A T   L O O P                     ║
    ║                     every 10 minutes                              ║
    ╠═══════════════════════════════════════════════════════════════════╣
    ║                                                                   ║
    ║   STEP 0a ─── CONTEXT HEALTH                                     ║
    ║   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  70%       ║
    ║   │                                                               ║
    ║   │  >70%  STOP. Flush state to memory. Run /compact.            ║
    ║   │  >50%  Proceed, but compact before next cycle.               ║
    ║   │  <50%  Proceed normally.                                     ║
    ║   │                                                               ║
    ║   STEP 0b ─── CIRCUIT BREAKERS                                   ║
    ║   │                                                               ║
    ║   │  consecutive_wakes >= 50 ──► HEARTBEAT_OK (cooldown)         ║
    ║   │  errors_this_hour >= 2  ──► HEARTBEAT_OK (backoff)           ║
    ║   │                                                               ║
    ║   STEP 1 ─── STALL RECOVERY                                     ║
    ║   │                                                               ║
    ║   │  Session stale >5min? Kill + re-queue (max 2 retries)        ║
    ║   │  Session stale >30min? Ignore (dead weight)                  ║
    ║   │                                                               ║
    ║   STEP 2 ─── PR FOLLOW-UPS                    ◄── highest prio  ║
    ║   │                                                               ║
    ║   │  gh pr list --author @me --state open                        ║
    ║   │  New review? ──► oss-followup                                ║
    ║   │  CI failing? ──► fix and push                                ║
    ║   │  Merged?     ──► update pipeline-state                       ║
    ║   │  Stale >7d?  ──► close politely                              ║
    ║   │                                                               ║
    ║   STEP 3 ─── MERGE STAGING + PICK WORK                          ║
    ║   │                                                               ║
    ║   │  Merge staging files ──► work-queue.md                       ║
    ║   │  Count active sub-agents                                     ║
    ║   │  Active >= 5?  ──► skip to step 6                            ║
    ║   │  Active < 5?   ──► pick task, filter:                        ║
    ║   │     a. Not in pr-ledger.md (no duplicate PRs)                ║
    ║   │     b. Repo < 3 PRs today (anti-spam)                        ║
    ║   │     c. Prefer diverse repos across slots                     ║
    ║   │  Queue < 5?    ──► run oss-discover (broad)                  ║
    ║   │                                                               ║
    ║   STEP 4 ─── TRIAGE                           ◄── <3 min        ║
    ║   │                                                               ║
    ║   │  oss-triage: open? unassigned? complexity?                   ║
    ║   │  Quality gate: clear criteria, well-scoped, >10 stars        ║
    ║   │  repo-analyzer: CONTRIBUTING.md, anti-AI policy check        ║
    ║   │  web_search: upstream context, CVEs, related fixes           ║
    ║   │                                                               ║
    ║   STEP 5 ─── SPAWN SUB-AGENT                                    ║
    ║   │                                                               ║
    ║   │  sessions_spawn with attachments:                            ║
    ║   │     repo-conventions.md + issue-details.md                   ║
    ║   │  Sub-agent follows reproduce-first workflow                  ║
    ║   │  Workdir: /tmp/clawoss-<issue>-<timestamp>/                  ║
    ║   │  Result: memory/subagent-result-<repo>-<issue>.md            ║
    ║   │  Reply: ANNOUNCE_SKIP (bypass content filter)                ║
    ║   │  LOOP BACK to step 3 until 5 slots filled                   ║
    ║   │                                                               ║
    ║   STEP 6 ─── HANDLE RESULTS                                     ║
    ║   │                                                               ║
    ║   │  Read subagent-result-*.md files                             ║
    ║   │  Success + PR URL? ──► update pipeline-state                 ║
    ║   │  Success, no URL?  ──► re-queue (retry once)                 ║
    ║   │  Failure? ──► log reason, increment error counter            ║
    ║   │  Disk cleanup: rm stale /tmp/clawoss-* dirs (>60min)         ║
    ║   │                                                               ║
    ║   STEP 7 ─── REPORT + LOOP                                      ║
    ║   │                                                               ║
    ║   │  dashboard-reporter: log cycle outcome                       ║
    ║   │  Update wake-state.md counters                               ║
    ║   │  Active < 5? ──► go back to step 3                          ║
    ║   │  All full?   ──► HEARTBEAT_OK                                ║
    ║   │                                                               ║
    ║   └──► self-wake: openclaw system event "cycle-complete"         ║
    ║                                                                   ║
    ╚═══════════════════════════════════════════════════════════════════╝
```

---

## Skill Invocation Chain

Fifteen skills wire together into two pipelines: discovery (cron-driven) and implementation (sub-agent-driven). The orchestrator invokes discovery skills directly; implementation skills run inside sub-agents.

```
    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    ░                                                                    ░
    ░                  D I S C O V E R Y   P I P E L I N E               ░
    ░                   (orchestrator, every 2h cron)                     ░
    ░                                                                    ░
    ░   ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐     ░
    ░   │ oss-discover │───►│  oss-triage  │───►│  repo-analyzer   │     ░
    ░   │              │    │              │    │                  │     ░
    ░   │ gh search    │    │ open?        │    │ CONTRIBUTING.md  │     ░
    ░   │ score >=5    │    │ unassigned?  │    │ tech stack       │     ░
    ░   │ stars >10    │    │ complexity?  │    │ test framework   │     ░
    ░   │ multi-lang   │    │ clear scope? │    │ anti-AI policy?  │     ░
    ░   │ max 3/repo   │    │ >10 stars?   │    │ cache in repos/  │     ░
    ░   └──────────────┘    └──────────────┘    └──────────────────┘     ░
    ░         │                    │                     │                ░
    ░         ▼                    ▼                     ▼                ░
    ░   work-queue-          skip or          memory/repos/              ░
    ░   staging.md           defer            <repo>.md                  ░
    ░                                                                    ░
    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

    ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
    ▒                                                                    ▒
    ▒              I M P L E M E N T A T I O N   P I P E L I N E         ▒
    ▒                (sub-agent, fresh isolated context)                  ▒
    ▒                                                                    ▒
    ▒   ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐   ▒
    ▒   │oss-implement  │──►│  oss-review   │──►│  safety-checker   │   ▒
    ▒   │               │   │               │   │                   │   ▒
    ▒   │ 1. understand │   │ 7-gate check: │   │ 8 final checks:  │   ▒
    ▒   │ 2. REPRODUCE  │   │  scope        │   │  budget           │   ▒
    ▒   │ 3. implement  │   │  code quality │   │  diff <200 LOC    │   ▒
    ▒   │ 4. VERIFY     │   │  tests pass   │   │  secret scan      │   ▒
    ▒   │ 5. review     │   │  security     │   │  branch name      │   ▒
    ▒   │ 6. submit     │   │  anti-slop    │   │  anti-spam limits │   ▒
    ▒   │               │   │  git hygiene  │   │  no force-push    │   ▒
    ▒   │ abandon if:   │   │  PR template  │   │  CI builds        │   ▒
    ▒   │  no repro 10m │   │               │   │  independent rev  │   ▒
    ▒   │  2 fix fails  │   │ + isolated    │   │                   │   ▒
    ▒   │  3+ gate fail │   │   subagent    │   │ abort on any fail │   ▒
    ▒   └───────────────┘   │   reviewer    │   └────────┬──────────┘   ▒
    ▒                       └───────────────┘            │              ▒
    ▒                                                     ▼              ▒
    ▒                                            ┌───────────────────┐   ▒
    ▒                                            │   oss-submit      │   ▒
    ▒                                            │                   │   ▒
    ▒                                            │ fork or direct    │   ▒
    ▒                                            │ gh pr create      │   ▒
    ▒                                            │ AI disclosure     │   ▒
    ▒                                            │ Fixes #N          │   ▒
    ▒                                            │ before/after      │   ▒
    ▒                                            │ evidence          │   ▒
    ▒                                            └────────┬──────────┘   ▒
    ▒                                                     │              ▒
    ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│▒▒▒▒▒▒▒▒▒▒▒▒▒
                                                          │
    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓▓▓▓▓
    ▓                                                     │              ▓
    ▓                F O L L O W - U P   L O O P          │              ▓
    ▓                (orchestrator, every 30m cron)        │              ▓
    ▓                                                     ▼              ▓
    ▓   ┌───────────────┐                        ┌───────────────────┐   ▓
    ▓   │ oss-followup  │◄───────────────────────│ dashboard-reporter│   ▓
    ▓   │               │                        │                   │   ▓
    ▓   │ read reviews  │  log cycle, metrics,   │ POST /api/ingest  │   ▓
    ▓   │ categorize    │  tokens, costs, repos   │ heartbeat + state │   ▓
    ▓   │ fix or reply  │                        │ conversation msgs │   ▓
    ▓   │ max 3 rounds  │                        │ sub-agent relay   │   ▓
    ▓   │ then close    │                        │                   │   ▓
    ▓   └───────────────┘                        └───────────────────┘   ▓
    ▓                                                                    ▓
    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

    Superpowers (cross-cutting, any pipeline):
      systematic-debugging     test-driven-development
      verification-before-completion   brainstorming
      requesting-code-review   context-manager
```

---

## PII Sanitizer Protocol

The bidirectional PII sanitizer prevents OpenRouter's content filter from blocking sessions. Implemented as a compiled plugin (`plugins/pii-sanitizer/index.js`) that registers three event hooks.

```
    ════════════════════  INBOUND (tool results → session)  ════════════

       GitHub API          File Read          Exec Output
           │                   │                   │
           ▼                   ▼                   ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │                                                                  │
    │   EVENT: tool_result_persist                                    │
    │   EVENT: before_message_write                                   │
    │   MODE:  sync (blocking — mutates before persistence)           │
    │                                                                  │
    │   deepSanitize(value):                                          │
    │     string  →  replace(/@/g, '\uFF20')     @ → ＠ (fullwidth)   │
    │     array   →  map(deepSanitize)                                │
    │     object  →  keys.forEach(deepSanitize)                       │
    │                                                                  │
    │   Catches:                                                      │
    │     tool results (file reads, gh output, exec stdout)           │
    │     sub-agent announce messages (before_message_write)          │
    │     any message written to session history                      │
    │                                                                  │
    └──────────────────────────────────────────────────────────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
       Session history now contains ＠ (U+FF20) instead of @
       OpenRouter sees ＠ → no PII match → no 403 block


    ═══════════════════  OUTBOUND (model output → disk)  ═══════════════

       Model generates code with ＠ (because context has ＠)
           │
           ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │                                                                  │
    │   EVENT: before_tool_call                                       │
    │   MODE:  sync (blocking — mutates params before execution)      │
    │                                                                  │
    │   TOOL FILTER (only these 5 tools):                             │
    │     write │ edit │ exec │ apply_patch │ process                 │
    │                                                                  │
    │   deepDesanitize(params):                                       │
    │     replace(FULLWIDTH_AT, '@')                                  │
    │                                                                  │
    │   ＠pytest.fixture  →  @pytest.fixture                          │
    │   ＠Override        →  @Override                                │
    │   user＠example.com →  user@example.com                         │
    │                                                                  │
    └──────────────────────────────────────────────────────────────────┘
           │
           ▼
       Files on disk always have real @ symbols
       Session history always has ＠ (safe for OpenRouter)
```

---

## Sub-Agent Spawn Protocol

Each implementation task runs in a completely fresh context. The orchestrator passes context via file attachments since sub-agents cannot access memory tools.

```
    ORCHESTRATOR                           SUB-AGENT (fresh session)
    ────────────                           ─────────────────────────
         │
         │  1. Read memory/repos/<repo>.md
         │  2. Read memory/issue-details.md
         │  3. Prepare attachments
         │
         ├──── sessions_spawn ──────────────────────►│
         │     task: "Fix <repo>#<issue>"             │
         │     attachments:                           │
         │       - repo-conventions.md                │
         │       - issue-details.md                   │
         │     label: "<repo>#<issue>"                │
         │                                            │
         │                                            │  WORKDIR=/tmp/clawoss-<n>-<ts>
         │                                            │  mkdir -p $WORKDIR && cd $WORKDIR
         │                                            │
         │                               ┌────────────┤
         │                               │ 1. Clone   │
         │                               │ 2. Branch  │  clawoss/<type>/<desc>
         │                               │ 3. REPRODUCE│ (failing test)
         │                               │ 4. FIX     │  (minimal change)
         │                               │ 5. VERIFY  │  (tests pass)
         │                               │ 6. REVIEW  │  (7-gate check)
         │                               │ 7. SUBMIT  │  (PR + evidence)
         │                               │ 8. CLEANUP │  rm -rf $WORKDIR
         │                               └────────────┤
         │                                            │
         │   Write result file:                       │
         │   memory/subagent-result-<repo>-<issue>.md │
         │     - Status: success/failure              │
         │     - PR URL                               │
         │     - Files changed                        │
         │     - Test results (before/after)           │
         │                                            │
         │◄────────── ANNOUNCE_SKIP ──────────────────│
         │     (bypasses announce model call,          │
         │      avoids content filter on response)     │
         │                                            ╳ session ends
         │
         │  Read result file
         │  Validate PR URL present (else re-queue once)
         │  Update pipeline-state.md
         │  Remove from work-queue.md
         │  Delete result file
         │
```

---

## Restart Protocol

The 13-step boot sequence (`scripts/restart.sh`) takes ClawOSS from cold start to fully autonomous operation. Config files use `__PLACEHOLDER__` tokens that are substituted at deploy time via `sed`.

```
    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │   $ npm run restart                                             │
    │                                                                 │
    │   ░░░░░░░░░░░  PHASE 1: ENVIRONMENT  ░░░░░░░░░░░░░░░░░░░░░░   │
    │                                                                 │
    │    1. Load .env ─────────── source $PROJECT_DIR/.env            │
    │                             KIMI_API_KEY, GITHUB_TOKEN,         │
    │                             DASHBOARD_URL, CLAW_API_KEY         │
    │                                                                 │
    │    2. Git identity ──────── git config user.name $GITHUB_USER   │
    │                             git config user.email $GITHUB_EMAIL │
    │                                                                 │
    │    3. GitHub CLI auth ───── echo $TOKEN | gh auth login         │
    │                                                                 │
    │   ▒▒▒▒▒▒▒▒▒▒▒  PHASE 2: CONFIG DEPLOY  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   │
    │                                                                 │
    │    4. Link workspace ────── ln -sf workspace ~/.openclaw/       │
    │                                                                 │
    │    5. Deploy config ─────── sed template substitution:          │
    │                                                                 │
    │       config/openclaw.json         ~/.openclaw/openclaw.json    │
    │       ┌─────────────────┐          ┌─────────────────────────┐  │
    │       │__WORKSPACE_PATH__│  ──sed──►│/Users/.../workspace     │  │
    │       │__PROJECT_DIR__  │          │/Users/.../clawOSS       │  │
    │       │__HOME_DIR__     │          │/Users/kevinlin          │  │
    │       └─────────────────┘          └─────────────────────────┘  │
    │                                                                 │
    │       Then: python3 injects env vars into deployed JSON         │
    │                                                                 │
    │   ▓▓▓▓▓▓▓▓▓▓▓  PHASE 3: CLEAN + BOOT  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │
    │                                                                 │
    │    6. Clean sessions ────── rm ~/.openclaw/sessions/*.jsonl     │
    │    7. Reset wake state ──── consecutive_wakes: 0                │
    │    8. Clean stale dirs ──── find /tmp -name 'clawoss-*' >60m   │
    │    9. Stop gateway ──────── openclaw gateway stop               │
    │   10. Start gateway ─────── openclaw gateway install            │
    │   11. Dashboard sync ────── nohup dashboard-sync.sh &           │
    │   12. Install ledger sync── launchctl load pr-ledger-sync.plist │
    │   13. Kick agent ────────── openclaw system event "Go."         │
    │                                                                 │
    │   ═══════════════════════════════════════════════════════════    │
    │                                                                 │
    │   Output:                                                       │
    │     Model: kimi-coding/k2p5 (Kimi Code direct API)             │
    │     Dashboard: clawoss-dashboard.vercel.app                     │
    │     Agent runs independently — no Claude Code session needed    │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
```

---

## Compaction + Memory Protocol

Context grows over time. The compaction system preserves critical state across context window resets.

```
    ┌───────────────────────────────────────────────────────────────┐
    │                  CONTEXT WINDOW (262K tokens)                  │
    │                                                               │
    │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░  │
    │   ├── used ──────────────────────────┤── available ────────┤  │
    │                                                               │
    │   At 50%: flag for next-cycle compaction                     │
    │   At 70%: STOP. Flush and compact NOW.                       │
    │   At 80%: context-manager skill auto-triggers                │
    │                                                               │
    └───────────────────────┬───────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   FLUSH STATE   │
                   │                 │
                   │  wake-state.md  │  consecutive_wakes, errors,
                   │  pipeline.md   │  active PRs, stats
                   │  work-queue.md │  pending tasks, scores
                   │  repos/*.md    │  learned conventions
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │   COMPACTION    │
                   │                 │
                   │  mode: safeguard│
                   │  reserve: 30K   │  tokens kept for new work
                   │  recent: 20K   │  recent turns preserved
                   │  maxHistory: 60%│  of context for history
                   │  flush: 150K   │  soft threshold for memory
                   │                 │
                   │  preserved:     │
                   │   - Architecture│  orchestrator + sub-agent
                   │   - Safety      │  all NEVER/ALWAYS rules
                   │   - Context Rot │  memory-as-truth protocol
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │   RESTORE       │
                   │                 │
                   │  Re-read:       │
                   │   wake-state.md │
                   │   pipeline.md   │
                   │   work-queue.md │
                   │   AGENTS.md     │
                   │   SOUL.md       │
                   │                 │
                   │  Resume work    │
                   └─────────────────┘
```

---

## Quality Gate Pipeline

Every PR passes through 9 sequential gates. Failure at any gate aborts submission. Gates are split across two skills: `oss-review` (gates 1-7) and `safety-checker` (gates 0, 8).

```
    Issue ──► Clone ──► Implement ──► Self-Review ──► Safety ──► Submit
                                           │              │
                                     ┌─────┘        ┌─────┘
                                     ▼              ▼

    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │   ░░░░░░░   ░░░░░░░   ▒▒▒▒▒▒▒   ▒▒▒▒▒▒▒   ▓▓▓▓▓▓▓           │
    │   GATE 0    GATE 1    GATE 2    GATE 3    GATE 4              │
    │   BUDGET    SCOPE     CODE      TESTS     SECURITY            │
    │                                                                 │
    │   token     <200 LOC  linter    all pass  no sk-*             │
    │   cap ok    <5 files  style ok  +new test no ghp_*            │
    │             on-issue  no debug  right     no .env             │
    │                       no junk   reason    no keys             │
    │                                           no -----BEGIN       │
    │                                                                 │
    │   ▓▓▓▓▓▓▓   ▓▓▓▓▓▓▓   ▓▓▓▓▓▓▓   ▓▓▓▓▓▓▓                    │
    │   GATE 5    GATE 6    GATE 7    GATE 8                        │
    │   ANTI-SLOP GIT HYG   PR TMPL   INDEP REVIEW                 │
    │                                                                 │
    │   no "I"    clawoss/  title     isolated subagent             │
    │   no AI     conv.     + why     sees ONLY diff + issue        │
    │   no bloat  commits   issue #   never sees impl journey       │
    │   no over-  linear    AI disc   checks: correctness,          │
    │   engineer  history   evidence  slop, bugs, style             │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
```

---

## Anti-Spam Rate Limiter

Rate limits are enforced by the orchestrator (step 3 filters), `safety-checker` (gate 4), and `oss-submit`. State is tracked in `wake-state.md` and `pr-ledger.md`.

```
    ┌─────────────────────────────────────────────────────────────────┐
    │               R A T E   L I M I T   M A T R I X                │
    ╠═════════════════════╦═══════════╦════════════════════════════════╣
    │ Constraint          ║ Limit     ║ Enforced by                    │
    ╠═════════════════════╬═══════════╬════════════════════════════════╣
    │ PRs per repo/day    ║    3      ║ heartbeat step 3b              │
    │ PRs total/day       ║   10      ║ safety-checker gate 4          │
    │ Same-repo gap       ║   30 min  ║ safety-checker gate 4          │
    │ Max lines changed   ║  200 LOC  ║ oss-review gate 1              │
    │ Max files changed   ║    5      ║ oss-review gate 1              │
    │ Follow-up rounds    ║    3      ║ oss-followup                   │
    │ Active PRs          ║    5      ║ heartbeat step 3               │
    │ Stall retries       ║    2      ║ heartbeat step 1               │
    │ Fix attempts        ║    2      ║ oss-implement step 4           │
    │ Gate failures       ║    3      ║ oss-implement step 5           │
    │ Consecutive wakes   ║   50      ║ heartbeat step 0b              │
    │ Errors per hour     ║    2      ║ heartbeat step 0b              │
    ╚═════════════════════╩═══════════╩════════════════════════════════╝

         pr-ledger.md (dedup guard)
              │
              │ "Never submit two PRs for the same issue"
              │  Auto-synced every 60s via launchd
              │  Pulled from GitHub API by pr-ledger-sync.sh
              │
              ▼
         wake-state.md (per-cycle counters)
              │
              │  consecutive_wakes: N
              │  errors_this_hour: N
              │  prs_today_by_repo: { "repo": count }
              │
              ▼
         pipeline-state.md (global tracking)
              │
              │  submitted: N   merged: N
              │  rejected: N    abandoned: N
              │
              ▼
         work-queue.md (drain target)
```

---

## Cron Schedule

Five scheduled jobs handle discovery, follow-up, reporting, and maintenance outside the heartbeat loop.

```
    ┌───────────── minute (0-59)
    │ ┌─────────── hour (0-23)
    │ │ ┌───────── day of month (1-31)
    │ │ │ ┌─────── month (1-12)
    │ │ │ │ ┌───── day of week (0-6)
    │ │ │ │ │
    │ │ │ │ │

    0 */2 * * *   work-queue-refill      ISOLATED session
    ├─────────────────────────────────────────────────────
    │  Search GitHub across all languages
    │  Score candidates (stars >10, unassigned, <6mo)
    │  Write top 10 to staging file (race-condition safe)
    │  Max 3 issues per repo per cycle

    */30 * * * *  pr-followup-scan       MAIN session
    ├─────────────────────────────────────────────────────
    │  gh pr list --author @me --state open
    │  Detect review comments, CI failures
    │  Write urgent items to followup-staging.md

    0 23 * * *    daily-report           ISOLATED session
    ├─────────────────────────────────────────────────────
    │  PRs submitted / merged / rejected
    │  Cost estimate + cost-per-merged-PR
    │  Send to dashboard-reporter

    0 9 * * 1     weekly-retrospective   ISOLATED session
    ├─────────────────────────────────────────────────────
    │  Acceptance rate per repo
    │  Rejection analysis + strategy adjustment
    │  Prune stale queue items

    0 3 * * 0     memory-cleanup         ISOLATED session
    ├─────────────────────────────────────────────────────
    │  Archive important patterns to MEMORY.md
    │  Remove daily logs >14 days
    │  Prune closed PRs from pipeline-state.md

    + launchd (not cron):
    every 60s     pr-ledger-sync         shell script
    ├─────────────────────────────────────────────────────
    │  gh search prs --author BillionClaw --state all
    │  Write to memory/pr-ledger.md
    │  Managed by com.clawoss.pr-ledger-sync.plist
```

Isolated sessions prevent cron jobs from polluting the orchestrator's context.

---

## Event Hook + Telemetry Data Flow

Three hooks fire automatically on OpenClaw events. The dashboard-reporter tracks sub-agent lifecycle and relays their conversations to the dashboard.

```
    ┌─────────────────────────────────────────────────────────────────┐
    │                    EVENT BUS (OpenClaw Gateway)                  │
    └───┬────────────────────┬───────────────────────┬────────────────┘
        │                    │                       │
        ▼                    ▼                       ▼
    ┌────────────┐   ┌──────────────┐   ┌──────────────────┐
    │ PII        │   │ DASHBOARD    │   │ AUDIT            │
    │ SANITIZER  │   │ REPORTER     │   │ LOGGER           │
    ├────────────┤   ├──────────────┤   ├──────────────────┤
    │ SYNC       │   │ ASYNC        │   │ ASYNC            │
    │ (blocking) │   │ (10s timeout)│   │ (10s timeout)    │
    │            │   │              │   │                  │
    │ EVENTS:    │   │ EVENTS:      │   │ EVENTS:          │
    │ tool_result│   │ after_tool   │   │ command:new      │
    │ _persist   │   │ _call        │   │ agent_end        │
    │ before_msg │   │ agent_end    │   │ after_tool_call  │
    │ _write     │   │ user_message │   │                  │
    │ before_tool│   │              │   │                  │
    │ _call      │   │              │   │                  │
    │            │   │              │   │                  │
    │ MUTATES:   │   │ TRACKS:      │   │ LOGS:            │
    │ @ → ＠     │   │ tokens (est) │   │ session start    │
    │ ＠ → @     │   │ tool calls   │   │ tool calls       │
    │ (bidir.)   │   │ repos used   │   │ durations        │
    │            │   │ cost ($)     │   │ errors           │
    │            │   │ sub-agent    │   │ agent end        │
    │            │   │ lifecycle:   │   │                  │
    │            │   │  spawn       │   │                  │
    │            │   │  history     │   │                  │
    │            │   │  relay msgs  │   │                  │
    └────────────┘   └──────┬───────┘   └────────┬─────────┘
                            │                    │
                   ┌────────┴────────────────────┴────────┐
                   │                                       │
                   ▼                                       ▼
    ┌───────────────────────────┐   ┌──────────────────────────┐
    │  /api/ingest/heartbeat    │   │  /api/ingest/logs        │
    │  /api/ingest/metrics      │   │                          │
    │  /api/ingest/conversation │   │  level: info/warn/error  │
    │  /api/ingest/state        │   │  source: hook:audit-log  │
    │                           │   │  tool_name, duration_ms  │
    │  heartbeats, tokens,      │   │  session_key, run_id     │
    │  cost, work queue,        │   │                          │
    │  pipeline state,          │   │                          │
    │  conversation messages    │   │                          │
    └───────────┬───────────────┘   └────────────┬─────────────┘
                │                                │
                └────────────┬───────────────────┘
                             │
                    ┌────────▼────────┐
                    │   T U R S O     │
                    │   (SQLite edge) │
                    │   AWS us-east-1 │
                    │                 │
                    │  heartbeats     │
                    │  PRs            │
                    │  metrics        │
                    │  logs           │
                    │  messages       │
                    │  settings       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  VERCEL         │
                    │  DASHBOARD      │
                    │  (Next.js 15)   │
                    │                 │
                    │  SWR polling:   │
                    │   conv.    2s   │
                    │   state    5s   │
                    │   sessions 5s   │
                    │   conn.  15s    │
                    └─────────────────┘
```

---

## Memory Architecture

The agent maintains persistent state across heartbeat cycles, compactions, and restarts through a file-based memory system.

```
    workspace/memory/
    │
    ├── wake-state.md ──────────── VOLATILE (per-cycle)
    │   consecutive_wakes: N
    │   errors_this_hour: N
    │   prs_today_by_repo: {...}
    │
    ├── work-queue.md ──────────── ACTIVE (drain target)
    │   In Progress: [...tasks with sub-agents]
    │   Completed:   [...PRs with URLs]
    │   Skipped:     [...with reasons]
    │   Abandoned:   [...with reasons]
    │
    ├── pipeline-state.md ──────── TRACKING (all active PRs)
    │   20 active PRs with repo, issue, status, date
    │
    ├── pr-ledger.md ───────────── DEDUP GUARD (auto-synced)
    │   Never submit two PRs for the same issue.
    │   Auto-updated every 60s via launchd (pr-ledger-sync.sh).
    │   30 entries across 22 repos (1 merged, 1 closed, 28 open).
    │
    ├── work-queue-staging.md ──── STAGING (race-condition safe)
    │   Cron writes here; heartbeat merges into work-queue.md.
    │
    ├── followup-staging.md ────── STAGING (PR follow-ups)
    │   pr-followup-scan writes here; heartbeat merges.
    │
    ├── repos/
    │   ├── apache-mahout.md ────── Learned conventions per repo
    │   ├── blocklist.md ────────── Repos that reject AI PRs
    │   └── ...
    │
    ├── subagent-inputs/
    │   └── <repo>_<issue>/
    │       ├── issue-details.md ── Passed as attachment to sub-agent
    │       └── repo-conventions.md
    │
    └── subagent-result-<repo>-<issue>.md  ── Written by sub-agent
        Status, PR URL, files changed, test evidence, errors
        Deleted by orchestrator after processing.
```

---

## Reproduce-First Workflow

Every implementation follows a strict TDD-style protocol. No exceptions.

```
    Issue
      │
      ▼
    ┌──────────────────────────────────────────────────────┐
    │  1. UNDERSTAND                                        │
    │     Read issue, explore source, extract criteria      │
    └──────────────────────────┬───────────────────────────┘
                               │
    ┌──────────────────────────▼───────────────────────────┐
    │  2. REPRODUCE                            ◄── RED     │
    │                                                       │
    │     Run existing tests (baseline)                    │
    │     Write a FAILING test for the bug                 │
    │     Verify it fails for the RIGHT reason             │
    │     Record failure output as evidence                │
    │                                                       │
    │     Cannot reproduce in 10 min? ──► ABANDON          │
    └──────────────────────────┬───────────────────────────┘
                               │
    ┌──────────────────────────▼───────────────────────────┐
    │  3. IMPLEMENT                            ◄── GREEN   │
    │                                                       │
    │     MINIMAL fix to make the failing test pass        │
    │     Match existing code style exactly                │
    │     No "while I'm here" improvements                 │
    └──────────────────────────┬───────────────────────────┘
                               │
    ┌──────────────────────────▼───────────────────────────┐
    │  4. VERIFY                                            │
    │                                                       │
    │     Failing test MUST now pass                        │
    │     Full test suite — no regressions                 │
    │     Record passing output as evidence                │
    │                                                       │
    │     Tests fail after 2 fix attempts? ──► ABANDON     │
    └──────────────────────────┬───────────────────────────┘
                               │
    ┌──────────────────────────▼───────────────────────────┐
    │  5. REVIEW (7-gate check)                             │
    │     Scope? Style? Secrets? Size? Commits? Slop?      │
    │     3+ failures? ──► ABANDON                          │
    └──────────────────────────┬───────────────────────────┘
                               │
    ┌──────────────────────────▼───────────────────────────┐
    │  6. SUBMIT                                            │
    │     PR body: summary, repro steps, before/after      │
    │     evidence, changes list, AI disclosure             │
    │     Push to fork. Do NOT wait for remote CI.          │
    └──────────────────────────────────────────────────────┘
```

---

## Safety Defaults

```
    ╔═══════════════════════════════════════════════════════════════════╗
    ║                     N E V E R                                     ║
    ╠═══════════════════════════════════════════════════════════════════╣
    ║  push to main/master or default branches                         ║
    ║  force-push to any branch                                        ║
    ║  commit secrets, credentials, API keys, or .env files            ║
    ║  modify CI/CD pipelines without explicit approval                ║
    ║  submit PRs without reading CONTRIBUTING.md first                ║
    ║  submit >3 PRs to same repo/day, >10 total/day                  ║
    ║  submit PRs >200 lines changed or >5 files                      ║
    ║  include raw PII (emails, phones) in tool results or memory      ║
    ╠═══════════════════════════════════════════════════════════════════╣
    ║                     A L W A Y S                                   ║
    ╠═══════════════════════════════════════════════════════════════════╣
    ║  use public_repo token scope (least privilege)                   ║
    ║  create feature branches: clawoss/<type>/<description>           ║
    ║  run tests before submitting                                     ║
    ║  disclose AI authorship in every PR                              ║
    ║  close PRs politely on rejection                                 ║
    ║  max 3 follow-up rounds per PR, then disengage                  ║
    ║  sanitize @ → U+FF20 in session history (PII filter)            ║
    ╚═══════════════════════════════════════════════════════════════════╝
```

---

## Configuration Reference

### openclaw.json

| Setting | Value | Purpose |
|---------|-------|---------|
| `agents.defaults.model.primary` | `kimi-coding/k2p5` | Kimi Code direct API (bypasses OpenRouter) |
| `agents.defaults.model.fallbacks` | `[]` | No fallback to Anthropic |
| `agents.defaults.subagents.maxConcurrent` | `5` | Parallel sub-agent limit |
| `agents.defaults.compaction.mode` | `safeguard` | Auto-compact at capacity |
| `agents.defaults.compaction.reserveTokens` | `30000` | Tokens reserved for new work |
| `agents.defaults.compaction.memoryFlush.softThresholdTokens` | `150000` | Flush state before compaction |
| `agents.defaults.compaction.postCompactionSections` | Architecture, Safety, Context Rot | Preserved across compaction |
| `heartbeat.every` | `10m` | Heartbeat interval |
| `heartbeat.lightContext` | `true` | Minimal context load per cycle |
| `tools.sessions_spawn.attachments.enabled` | `true` | Pass files to sub-agents |
| `tools.web.search.provider` | `perplexity` | Web search via Perplexity |
| `tools.loopDetection.enabled` | `true` | Guard against infinite tool loops |
| `gateway.port` | `18789` | Local gateway port |

### Workspace Files

| File | Role |
|------|------|
| `AGENTS.md` | Behavioral contract: safety, quality, anti-spam, content filter rules |
| `SOUL.md` | Persona: professional, humble, technical. Boundaries: stay in lane, disclose AI |
| `HEARTBEAT.md` | 9-step autonomous loop with circuit breakers and stall recovery |
| `USER.md` | Operator profile and BillionClaw GitHub identity |
| `IDENTITY.md` | Agent name: ClawOSS, role: autonomous OSS contributor |
| `TOOLS.md` | Tool conventions: git, gh, node safety rules |
| `BOOTSTRAP.md` | First-run init sequence (deleted after completion) |
| `MEMORY.md` | Long-term memory: repo conventions, strategies, blocklists |

---

## Project Structure

```
ClawOSS/
├── workspace/                    # OpenClaw workspace root
│   ├── AGENTS.md                 #   behavioral contract
│   ├── SOUL.md                   #   persona + boundaries
│   ├── HEARTBEAT.md              #   9-step autonomous loop
│   ├── skills/                   #   15 skills (10 custom + 5 superpowers)
│   │   ├── oss-discover/         oss-implement/     oss-review/
│   │   ├── oss-submit/           oss-followup/      oss-triage/
│   │   ├── repo-analyzer/        context-manager/   dashboard-reporter/
│   │   ├── safety-checker/       systematic-debugging/
│   │   ├── test-driven-development/                 brainstorming/
│   │   └── verification-before-completion/          requesting-code-review/
│   ├── hooks/                    #   3 event hooks
│   │   ├── pii-sanitizer/        #     @ <-> U+FF20 bidirectional
│   │   ├── dashboard-reporter/   #     telemetry + sub-agent relay to Turso
│   │   └── audit-logger/         #     action audit trail
│   └── memory/                   #   persistent agent state
│       ├── wake-state.md         pipeline-state.md   work-queue.md
│       ├── pr-ledger.md          repos/              subagent-inputs/
│       ├── work-queue-staging.md followup-staging.md (cron writes here)
│       └── subagent-result-*.md  (transient, per-task)
├── config/
│   ├── openclaw.json             #   gateway + model + compaction config
│   ├── cron-jobs.json            #   5 scheduled jobs
│   └── com.clawoss.pr-ledger-sync.plist  #  launchd: sync ledger every 60s
├── plugins/
│   └── pii-sanitizer/            #   compiled bidirectional sanitizer
├── dashboard/                    #   Next.js 15 + Turso monitoring
├── scripts/                      #   11 operational scripts
│   ├── setup.sh                 #     one-time workspace + identity setup
│   ├── start.sh                 #     register cron, start gateway
│   ├── stop.sh                  #     graceful shutdown
│   ├── restart.sh               #     13-step full restart (see diagram above)
│   ├── health-check.sh          #     verify gateway, gh, workspace, cron
│   ├── validate-config.mjs      #     29-check config + skills validation
│   ├── pr-ledger-sync.sh        #     sync pr-ledger.md from GitHub API
│   ├── pr-ledger-sync-wrapper.sh#     wrapper for launchd (env setup)
│   ├── dashboard-sync.sh        #     sync dashboard data
│   ├── backup-workspace.sh      #     commit memory state to git
│   └── rotate-logs.sh           #     remove logs >14 days
├── issues/                       #   34 tracked issues
├── research/                     #   8 architecture research docs
└── templates/                    #   PR, commit, issue templates
```

---

## Quick Start

```bash
git clone https://github.com/billion-token-one-task/ClawOSS.git
cd ClawOSS
cp .env.example .env             # add API keys
npm run setup                    # link workspace, install plugins, deploy config
npm run restart                  # full boot: gateway + sync + agent kick
```

| Command | Description |
|---------|-------------|
| `npm run setup` | One-time: link workspace, git identity, gh auth, plugin install |
| `npm run start` | Register cron jobs, start gateway |
| `npm run stop` | Graceful shutdown (leaves gateway for other agents) |
| `npm run restart` | Full 13-step restart (see Restart Protocol above) |
| `npm run health` | Verify gateway, gh auth, workspace, cron |
| `npm run validate` | Validate configs + skills (29 checks) |
| `npm run dashboard:dev` | Dashboard locally |
| `npm run dashboard:build` | Dashboard for production |

---

## Known Issues

See [`issues/`](issues/) for detailed tracking (34 issues).

---

## License

MIT. See [LICENSE](LICENSE).
