# OpenClaw Extension Points Research

> Comprehensive analysis of all customization and extension mechanisms available in OpenClaw
> without modifying the core repository. Research date: 2026-03-16.
>
> **Key framing**: OpenClaw is the engine; ClawOSS is the race car built around it. We do NOT
> modify or contribute to OpenClaw itself. We USE OpenClaw as a tool to autonomously contribute
> high-quality PRs to OTHER open source projects. This document catalogs every lever we can pull
> to make that agent setup as effective as possible.

---

## Table of Contents

1. [Skills System](#1-skills-system)
2. [Heartbeat & Monitoring](#2-heartbeat--monitoring)
3. [Hooks & Lifecycle Events](#3-hooks--lifecycle-events)
4. [MCP Integration](#4-mcp-integration)
5. [Plugin SDK](#5-plugin-sdk)
6. [Cron & Scheduled Jobs](#6-cron--scheduled-jobs)
7. [Tools System & Policies](#7-tools-system--policies)
8. [Configuration System](#8-configuration-system)
9. [Autonomous 24/7 Operation](#9-autonomous-247-operation)
10. [GitHub Integration & PR Workflows](#10-github-integration--pr-workflows)
11. [ClawOSS Applicability Matrix](#11-clawoss-applicability-matrix)

---

## 1. Skills System

### Overview

Skills are the primary extension mechanism in OpenClaw. Each skill is a directory containing a
`SKILL.md` file with YAML frontmatter and Markdown instructions. Skills teach the agent how to
use tools, follow workflows, and apply domain expertise.

### File Structure

```
skill-name/
├── SKILL.md              (required - YAML frontmatter + markdown instructions)
└── Bundled Resources     (optional)
    ├── scripts/          - Executable code (Python/Bash/etc.)
    ├── references/       - Documentation loaded into context on demand
    └── assets/           - Templates, icons, fonts, output files
```

### SKILL.md Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Skill name |
| `description` | Yes | One-line description for discovery and matching |
| `homepage` | No | URL for the skill |
| `user-invocable` | No | If `true`, exposed as a `/slash-command` |
| `disable-model-invocation` | No | If `true`, excluded from model prompt (user-only) |
| `command-dispatch` | No | Set to `tool` to bypass model and dispatch directly to a tool |
| `command-tool` | No | Tool name to invoke when `command-dispatch: tool` |
| `command-arg-mode` | No | Forwards raw arguments string to the tool |
| `metadata` | No | Single-line JSON for load-time filtering |

### Metadata Filtering

Skills can declare runtime requirements via `metadata`:

```yaml
metadata: {"always": true}                              # Always include
metadata: {"os": ["darwin", "linux"]}                    # Platform filter
metadata: {"requires": {"bins": ["git", "gh"]}}          # Binary requirements
metadata: {"requires": {"env": ["GITHUB_TOKEN"]}}        # Env var requirements
metadata: {"requires": {"config": ["github.enabled"]}}   # Config requirements
metadata: {"install": [...]}                             # Auto-installer specs
```

### Loading Precedence (highest to lowest)

1. **Workspace skills**: `<workspace>/skills/` (highest precedence, per-agent)
2. **Managed/local skills**: `~/.openclaw/skills/` (shared across workspaces)
3. **Bundled skills**: Shipped with OpenClaw installation
4. **Extra dirs**: Configured via `skills.load.extraDirs` in `openclaw.json` (lowest)
5. **Plugin skills**: Plugins can ship their own skills

Workspace skills can **override** bundled or managed skills by using the same name.

### Execution Flow

1. Agent run starts; OpenClaw reads skill metadata and applies env vars / API keys
   (`skills.entries.<key>.env`, `skills.entries.<key>.apiKey`)
2. System prompt includes compact XML list of available skills (name + description + location)
3. Full skill instructions are NOT included by default -- model reads `SKILL.md` on demand
4. Env vars are scoped to the agent run and restored after

### ClawHub Marketplace

As of February 2026, **13,729+ community skills** are cataloged on ClawHub. Notable coding skills:
- **AutoCodeReviewer**: Scans PRs for issues, style violations (Python, JS, Go)
- **TestGenius**: Generates comprehensive unit tests with edge cases
- **coding-agent**: Built-in skill for autonomous coding workflows

### ClawOSS Implications

- We create custom skills in `<workspace>/skills/` that teach the agent how to discover work
  in external OSS repos, implement fixes/features, self-review, and submit PRs
- Skills for: discovering good-first-issues in target repos, analyzing codebases, implementing
  changes, running tests, creating high-quality PRs, responding to review feedback
- Skills can bundle scripts (Python/Bash) for: repo analysis, quality scoring, PR templates
- The agent uses these skills to contribute to OTHER open source projects -- not to OpenClaw itself
- No core OpenClaw modification needed -- pure directory/file creation in our workspace

---

## 2. Heartbeat & Monitoring

### Overview

The heartbeat system provides periodic agent turns (default: every 30 minutes) in the main
session. The agent reads `HEARTBEAT.md` as a checklist, then either responds with an alert or
`HEARTBEAT_OK` if nothing needs attention.

### Configuration (`agents.defaults.heartbeat` in `openclaw.json`)

| Setting | Description | Default |
|---------|-------------|---------|
| `every` | Frequency (e.g., `"30m"`, `"1h"`, `"0m"` to disable) | `"30m"` |
| `target` | Delivery destination: `"last"`, specific channel, `"none"` | `"last"` |
| `prompt` | Override the default heartbeat prompt | reads HEARTBEAT.md |
| `activeHours` | Restrict heartbeats to a time window | none |
| `model` | Override model (use cheaper model for routine checks) | agent default |
| `includeReasoning` | Send reasoning message for transparency | `false` |
| `lightContext` | Use lightweight bootstrap context | `false` |
| `isolatedSession` | Run in isolated session vs main session | `false` |

### HEARTBEAT.md

- Located in the agent's workspace (e.g., `~/.openclaw/workspace/HEARTBEAT.md`)
- Optional checklist the agent follows during heartbeat runs
- If empty or only headers, heartbeat run is **skipped** to save API calls
- Agent can self-update this file if instructed
- Manually trigger: `openclaw system event --mode now`

### Smart Suppression

- If agent replies with `HEARTBEAT_OK` and content < `ackMaxChars` (default 300), message is suppressed
- Visibility controls: `showOk`, `showAlerts`, `useIndicator` (configurable per-channel)
- If all three flags are false, heartbeat is skipped entirely

### Advantages Over Cron Jobs

- Batches multiple checks in one turn (inbox, calendar, project status)
- Full main-session context awareness
- Conversational continuity (remembers recent interactions)
- Reduced API calls through batching
- Smart suppression avoids noise

### ClawOSS Implications

- Configure heartbeat to monitor: status of PRs we submitted to external repos, CI results
  on our PRs, review comments needing response, new issues in target repos worth tackling
- `HEARTBEAT.md` checklist: scan target repos for new issues, check our submitted PRs for
  review feedback, verify CI passing on our branches, update dashboard with current status
- Route alerts to Vercel dashboard via webhook for real-time visibility
- Use `activeHours` to match maintainer response windows for optimal PR follow-up timing

---

## 3. Hooks & Lifecycle Events

### Overview

OpenClaw provides two hook systems for event-driven automation without modifying core code:
**Internal Hooks** (gateway-level scripts) and **Plugin Hooks** (runtime-registered via Plugin SDK).

### Internal Hooks (Gateway Hooks)

Automatically discovered from directories, managed via CLI.

#### Supported Events

| Category | Event | Description |
|----------|-------|-------------|
| Command | `command` | Any command event |
| Command | `command:new` | `/new` command |
| Command | `command:reset` | `/reset` command |
| Command | `command:stop` | `/stop` command |
| Session | `session:compact:before` | Before history compaction |
| Session | `session:compact:after` | After compaction completes |
| Agent | `agent:bootstrap` | Before workspace bootstrap files injected |
| Gateway | `gateway:startup` | After channels start and hooks loaded |
| Message | `message:received` | Inbound message |
| Message | `message:sent` | Outbound message |

#### Creating Custom Internal Hooks

```
<workspace>/hooks/my-hook/     (per-agent, highest precedence)
~/.openclaw/hooks/my-hook/     (user-installed, shared)

my-hook/
├── HOOK.md         (YAML frontmatter: name, description, events[])
└── handler.ts      (async function receiving event object)
```

Enable with: `openclaw hooks enable <hook-name>`

#### Bundled Hooks

- **session-memory**: Saves session context on `/new` or `/reset`
- **bootstrap-extra-files**: Injects extra bootstrap files
- **command-logger**: Logs all command events
- **boot-md**: Runs `BOOT.md` on Gateway startup

### Plugin Hooks (Runtime-Registered)

Registered via `api.registerHook()` or `api.on()` in plugins.

#### Supported Events

| Category | Event | Description |
|----------|-------|-------------|
| Agent Lifecycle | `before_model_resolve` | Override provider/model before resolution |
| Agent Lifecycle | `before_prompt_build` | Inject system prompt, prepend/append context |
| Agent Lifecycle | `before_agent_start` | Legacy compatibility hook |
| Agent Lifecycle | `agent_end` | Inspect final message list and run metadata |
| Compaction | `before_compaction` | Before compaction with count/token metadata |
| Compaction | `after_compaction` | After compaction with summary metadata |
| Tool Execution | `before_tool_call` | Intercept tool parameters |
| Tool Execution | `after_tool_call` | Intercept tool results |
| Tool Execution | `tool_result_persist` | Transform results before session transcript write |
| Message | `message_received` | Inbound messages |
| Message | `message_sending` | Messages being sent |
| Message | `message_sent` | Outbound messages sent |
| Session | `session_start` | New session begins |
| Session | `session_end` | Session ends |
| Gateway | `gateway_start` | Gateway startup |
| Gateway | `gateway_stop` | Gateway shutdown |

### ContextEngine Plugin Slot (2026.3.7+)

New extension mechanism with full lifecycle hooks:
- `bootstrap`, `ingest`, `assemble`, `compact`, `afterTurn`, `prepareSubagentSpawn`, `onSubagentEnded`
- Slot-based registry with config-driven resolution

### ClawOSS Implications

- Internal hooks for: logging every action the agent takes on external repos, injecting
  target-repo-specific context at bootstrap time
- Plugin hooks for: intercepting tool calls (audit trail of all git/gh commands run against
  external repos), modifying prompts (inject current target repo's conventions and style)
- `before_tool_call` / `after_tool_call` hooks for tracking what the agent does to external
  repos -- essential for dashboard metrics and quality auditing
- `agent_end` hook for capturing run metadata (which repo, what PR, pass/fail) to Vercel dashboard
- `before_prompt_build` for dynamically injecting the current target repo's CONTRIBUTING.md,
  coding style, and test conventions into the agent's context

---

## 4. MCP Integration

### Overview

OpenClaw integrates with MCP (Model Context Protocol) through `mcporter`, a bridge tool that
keeps the core lean. MCP servers can be added/removed dynamically without restarting the gateway.

### Architecture

- **Bridge model**: `mcporter` CLI acts as a flexible bridge (not first-class MCP runtime)
- Supports HTTP or stdio-based MCP servers
- Spawns MCP servers as child processes; routes tool calls through MCP protocol
- Agent discovers tools from MCP servers at startup

### mcporter CLI

```bash
mcporter list                          # List servers and tools
mcporter list <server> --schema        # View tool schemas
mcporter call <server.tool> key=value  # Call a tool
mcporter auth <server | url> [--reset] # Authenticate
mcporter config list|get|add|remove    # Config management
mcporter daemon start|status|stop      # Daemon control
mcporter generate-cli                  # Code generation
```

### Configuration

- Default config file: `./config/mcporter.json` (override with `--config`)
- MCP servers declared in `openclaw.yaml` config
- OpenClaw spawns each server as a child process
- Per-session MCP is NOT supported in ACP bridge (use gateway/agent-level config)
- `acpx` extension DOES support `mcpServers` configuration

### acpx MCP Server Config Format

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "env": { "API_KEY": "..." }
    }
  }
}
```

### Security

- Run MCP servers accessing production systems in separate containers
- Consider Docker sandboxing for individual MCP server processes

### ClawOSS Implications

- Add MCP servers for: enhanced GitHub API access (beyond `gh` CLI), code analysis tools,
  dependency vulnerability scanners, linting services
- Use `mcporter config add` to register servers -- the agent gains new capabilities for
  analyzing and contributing to external repos without any code changes
- MCP servers can provide specialized tools: repo health scoring, issue complexity estimation,
  PR quality assessment against target repo's standards
- Bridge model means zero core OpenClaw modifications needed

---

## 5. Plugin SDK

### Overview

Plugins are small code modules that run in-process with the Gateway. They register capabilities
into a central registry consumed by the rest of OpenClaw.

### Architecture Layers

1. **Manifest + Discovery**: Reads `openclaw.plugin.json` manifest and package metadata
2. **Enablement + Validation**: Determines enabled/disabled/blocked without executing code
3. **Runtime Loading**: Enabled plugins loaded in-process using `jiti`
4. **Surface Consumption**: Registered tools, channels, hooks, routes, etc. exposed

### Creating a Plugin

```
my-plugin/
├── openclaw.plugin.json    (manifest: id, configSchema)
├── package.json
└── src/
    └── index.ts            (exports register(api) function)
```

**Manifest** (`openclaw.plugin.json`):
```json
{
  "id": "my-plugin",
  "configSchema": { ... }
}
```

**Registration** (`src/index.ts`):
```typescript
export function register(api) {
  api.registerTool({ ... });
  api.registerHook({ ... });
  api.on('before_prompt_build', async (ctx) => { ... });
}
```

Install: `openclaw plugins install <npm-package | local-path | directory>`

### Plugin API Methods

| Method | Description |
|--------|-------------|
| `api.registerTool` | Register an agent tool (JSON-schema function for LLM) |
| `api.registerHook` | Register general-purpose hook for specific events |
| `api.on` | Register typed lifecycle hook handler |
| `api.registerHttpRoute` | Expose HTTP endpoints (requires auth settings) |
| `api.registerChannel` | Register a communication channel |
| `api.registerProvider` | Register model provider auth flows |
| `api.registerGatewayMethod` | Register Gateway RPC methods |
| `api.registerCli` | Register top-level CLI commands |
| `api.registerService` | Register background services |
| `api.registerCommand` | Register commands that bypass the LLM |
| `api.registerContextEngine` | Register context engine implementation |
| `api.runtime` | Access core helpers (TTS, STT, etc.) |

### Channel Plugins vs Tool Plugins

- **Channel Plugins**: Register communication channels via `api.registerChannel`. Advertise
  onboarding metadata via `openclaw.channel` in manifest. Examples: Telegram, Discord, Slack.
- **Tool Plugins**: Register agent tools via `api.registerTool`. Tools are JSON-schema functions
  exposed to the LLM. Can be required or optional.

### SDK Subpath Exports

```
openclaw/plugin-sdk/telegram
openclaw/plugin-sdk/discord
openclaw/plugin-sdk/slack
openclaw/plugin-sdk/signal
openclaw/plugin-sdk/imessage
openclaw/plugin-sdk/whatsapp
openclaw/plugin-sdk/line
openclaw/plugin-sdk/msteams
```

### Security Note

Plugins run with the same process-level trust as core code and are **not sandboxed**.

### ClawOSS Implications

- Build a ClawOSS plugin for: streaming metrics to Vercel dashboard, custom quality-gate tools,
  webhook integration with external CI systems
- `api.registerTool` for: target repo analysis, contribution quality scoring, PR readiness checks
- `api.on('agent_end')` for capturing per-run metrics (repo targeted, issue worked, PR submitted,
  quality score) and pushing to Vercel dashboard API
- `api.registerHttpRoute` for dashboard data endpoints (the Vercel frontend queries these)
- `api.registerService` for background service that tracks PR merge rates, review turnaround,
  and contribution acceptance across all target repos

---

## 6. Cron & Scheduled Jobs

### Overview

Built-in Gateway scheduler. Persists jobs across restarts. Wakes the agent at the right time.
Optionally delivers output to a chat or webhook.

### Schedule Types

| Type | Description | Example |
|------|-------------|---------|
| `at` | One-shot, future timestamp | `--at "2026-03-20T09:00:00Z"` |
| `every` | Fixed interval | `--every "2h"` |
| `cron` | Standard cron expression | `--cron "0 7 * * *"` |

### Execution Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Main Session** | Enqueues system event, runs in main session context | Context-aware tasks |
| **Isolated** | Dedicated agent turn in `cron:<jobId>` session, no history carry-over | Background chores |

### Configuration (CLI)

```bash
# One-shot reminder
openclaw cron add \
  --name "Reminder" \
  --at "2026-03-20T09:00:00Z" \
  --session main \
  --system-event "Check PR review status" \
  --wake now \
  --delete-after-run

# Recurring isolated job with delivery
openclaw cron add \
  --name "Morning brief" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize overnight updates." \
  --announce \
  --channel slack \
  --to "channel:C1234567890"
```

### Key Parameters

| Parameter | Description |
|-----------|-------------|
| `--name` | Human-readable name |
| `--session` | `main` or `isolated` |
| `--system-event` | Text for main session system event |
| `--message` | Prompt for isolated agent turn |
| `--wake` | `now` or `next-heartbeat` |
| `--announce` | Deliver summary to target channel |
| `--channel` / `--to` | Delivery channel and recipient |
| `--delete-after-run` | Auto-delete one-shot jobs after success |
| `--light-context` | Lightweight bootstrap for isolated jobs |

### Error Handling

Exponential retry backoff for recurring jobs after consecutive errors:
30s -> 1m -> 5m -> 15m -> 60m. Resets after successful run.

### Storage

Jobs persisted at `~/.openclaw/cron/jobs.json`. Survives restarts and reboots.

### ClawOSS Implications

- Schedule recurring work cycles: "Every 4 hours, scan target repos for new issues to work on"
- Isolated jobs for: discovering new issues across target repos, checking PR merge status,
  responding to review feedback on submitted PRs, running quality audits on pending contributions
- Main session jobs for: context-aware follow-ups ("the maintainer commented on our PR, respond")
- Deliver daily summaries to dashboard: PRs submitted, PRs merged, issues tackled, quality scores

---

## 7. Tools System & Policies

### Overview

The tools system provides agents with capabilities to interact with their environment, managed
through a multi-layered policy and filtering mechanism.

### Tool Categories

- **File system**: `read`, `write`, `edit`
- **Runtime**: `exec`, `process`
- **Session management**: `sessions_list`, `sessions_history`, `sessions_send`
- **Memory**: `memory_read`, `memory_write`
- **Image**: `image`

### Tool Profiles

| Profile | Tools Included |
|---------|---------------|
| `minimal` | `session_status` only |
| `coding` | `group:fs`, `group:runtime`, `group:sessions`, `group:memory`, `image` |
| `messaging` | `group:messaging`, `sessions_list`, `sessions_history`, `sessions_send`, `session_status` |
| `full` | No restrictions |

### Policy Layers (applied in order)

1. **Tool Profile** (`tools.profile`): Base allowlist
2. **Provider Tool Profile** (`tools.byProvider[provider].profile`): Further restricts for specific providers
3. **Global/Per-agent Policy** (`tools.allow`/`tools.deny`): Allow/deny lists
4. **Provider Policy** (`tools.byProvider[provider].allow/deny`): Provider-specific rules
5. **Sandbox Policy** (`tools.sandbox.tools.allow/deny`): Only when sandboxed

**Key rules**: `deny` always wins. Non-empty `allow` list blocks everything not listed.

### Exec Tool

- Runs shell commands in workspace
- Parameters: `command`, `yieldMs`, `timeout`, `background`, `elevated`
- `elevated`: Escape hatch to run on host when sandboxed (gated by `tools.elevated.enabled`)
- `safeBins` and `safeBinProfiles`: Allowlist of executables and argument patterns

### Tool Groups

Shorthands that expand to multiple tools:
- `group:runtime` -> exec, process, etc.
- `group:fs` -> read, write, edit, etc.
- `group:sessions` -> session tools
- `group:messaging` -> messaging tools
- `group:memory` -> memory tools

### ClawOSS Implications

- Use `coding` profile as base -- the agent needs full fs + runtime to clone, build, test,
  and submit PRs to external repos
- `safeBins` allowlist: `git`, `gh`, `npm`, `yarn`, `pnpm`, `bun`, `cargo`, `go`, `python`,
  `pip`, `make`, `cmake` -- restrict to build/test tools only
- Deny dangerous commands: no `rm -rf /`, no system-level operations outside workspace
- Consider sandboxing for safety since the agent runs autonomously against external codebases

---

## 8. Configuration System

### Primary Configuration File

**`~/.openclaw/openclaw.json`** (JSON5 format) -- the main settings file.

Edit methods:
- Direct file editing
- `openclaw onboard` / `openclaw configure` (interactive wizards)
- `openclaw config set <key> <value>` (CLI)
- Control UI

Supports hot-reloading for most changes.

### Workspace Markdown Files

Located in agent workspace (default: `~/.openclaw/workspace/`). Injected into agent context
at session start.

| File | Purpose |
|------|---------|
| `AGENTS.md` | Operating instructions, memory usage guidance |
| `SOUL.md` | Agent persona, tone, boundaries |
| `USER.md` | User description, how agent should address user |
| `IDENTITY.md` | Agent name, vibe, emoji |
| `TOOLS.md` | Notes about local tools and conventions |
| `HEARTBEAT.md` | Checklist for heartbeat runs |
| `BOOTSTRAP.md` | One-time first-run ritual (deleted after completion) |
| `MEMORY.md` | Curated long-term memory |
| `memory/YYYY-MM-DD.md` | Daily memory files |

### Multi-Agent Configuration

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace",
      "heartbeat": { "every": "30m" }
    },
    "list": [
      {
        "id": "oss-coder",
        "workspace": "/path/to/oss-workspace",
        "heartbeat": { "every": "15m" },
        "tools": { "profile": "coding" }
      },
      {
        "id": "oss-reviewer",
        "workspace": "/path/to/review-workspace",
        "tools": { "profile": "coding", "deny": ["exec"] }
      }
    ]
  }
}
```

### ClawOSS Implications

- `AGENTS.md`: comprehensive instructions for how to discover issues in external repos,
  analyze codebases, implement high-quality fixes, self-review, submit PRs, and respond
  to maintainer feedback -- this is the core "brain" of ClawOSS
- `SOUL.md`: persona of a thoughtful, high-quality open source contributor who reads
  CONTRIBUTING.md, follows repo conventions, writes thorough PR descriptions, and
  prioritizes quality over quantity
- `TOOLS.md`: conventions for using git, gh, build tools across different target repo types
- Single-agent recommended (quality focus), but could use multi-agent for separate repos
- `HEARTBEAT.md`: monitoring checklist for PR status, review feedback, CI results
- Hot-reload means we can tune the agent's behavior without downtime

---

## 9. Autonomous 24/7 Operation

### Deployment Options

| Platform | Description |
|----------|-------------|
| **VPS** (GCP, Hetzner, etc.) | Docker-based, durable state, safe restart |
| **Raspberry Pi** | Low-cost always-on personal agent |
| **Systemd** | Auto-start on boot for host installations |

### Key Features for Continuous Operation

1. **Heartbeat**: Periodic awareness, every 30m default
2. **Cron Jobs**: Scheduled tasks, persisted across restarts
3. **Sub-agents**: Parallel work in isolated sessions (spawn with `/subagents`)
4. **Session Compaction**: Automatically compacts history to stay within context limits
5. **Memory Flush**: Silent agent turn to write persistent state before compaction
6. **Session Maintenance**: Prunes stale entries, caps counts, rotates files

### Agent Loop & Queueing

- Runs serialized per session key (prevents tool/session races)
- Optional global lane for concurrency control
- Queue modes: `collect`, `steer`, `followup` (control how new messages interact with in-flight runs)

### Progress Updates

- Short message on task start
- Updates only on: milestone completion, input needed, error, task finish
- `system event --mode now` for immediate notification on completion

### Session Persistence

- Session history: `~/.openclaw/agents/<agentId>/sessions/`
- Compaction: Older history summarized to fit context window
- Memory flush: Writes `memory/YYYY-MM-DD.md` to disk before compaction
- `NO_REPLY` convention suppresses user-facing output during maintenance

### ClawOSS Implications

- Deploy on VPS with Docker for 24/7 autonomous contribution to external OSS projects
- Heartbeat monitors: new issues in target repos, review comments on our submitted PRs,
  CI status on our branches, maintainer activity windows
- Cron jobs for: periodic issue discovery sweeps, PR follow-up checks, quality audits
- Sub-agents for: working on multiple target repos simultaneously without blocking
- Session compaction ensures the agent can run for weeks without context overflow
- Memory flush preserves: which repos we're targeting, which PRs are pending, which
  maintainers have responded, quality patterns learned from accepted/rejected PRs

---

## 10. GitHub Integration & PR Workflows

### Capabilities

| Feature | Implementation |
|---------|---------------|
| **PR Creation** | `gh pr create` via exec tool |
| **PR Merging** | `gh pr merge` |
| **Code Review** | `coding-agent` skill + `codex review` command |
| **Issue Management** | `gh issue list/create/close/comment` |
| **Search** | `gh search prs/issues` |
| **Templates** | `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/` |

### Code Review Flow

1. `codex review` command reviews PRs in temp directory or git worktree
2. Detailed process: validation, quality evaluation, test coverage assessment
3. Review bots leave conversations; authors expected to address and resolve

### Auto-Response Workflow

GitHub Actions `auto-response.yml` handles automated responses based on labels:
- Label application triggers close + comment (e.g., skill publication guidance, support redirects)
- Active PR limits can be enforced via labels

### AI-Assisted PR Transparency

PRs created by AI require transparency markers. The system supports:
- PR Review -> Telegram/Slack feedback loops
- Automated follow-up based on review comments

### ClawOSS Implications

- Full PR lifecycle against external repos: fork -> branch -> implement -> test -> self-review
  -> submit PR -> respond to review feedback -> iterate until merged
- Use `coding-agent` skill as foundation, extend with our custom skills for quality gates
- `gh` CLI provides full GitHub API access: fork repos, create branches, submit PRs, respond
  to review comments, check CI status -- all against external target repos
- Template-based PR descriptions that follow each target repo's CONTRIBUTING.md conventions
- Self-review step before submission is critical for quality -- the agent reviews its own
  changes as if it were a maintainer before creating the PR
- Review feedback loop: heartbeat detects maintainer comments -> agent reads feedback ->
  implements requested changes -> pushes update -> comments that changes were made

---

## 11. ClawOSS Applicability Matrix

### Extension Points for ClawOSS Agent

| Extension Point | ClawOSS Use Case | What We Create/Configure |
|----------------|-------------------|--------------------------|
| **Custom Skills** | Discover issues in external repos, implement fixes, self-review, submit PRs, respond to feedback | Files in `<workspace>/skills/` |
| **HEARTBEAT.md** | Monitor our submitted PRs, detect review comments, check CI on our branches | Workspace markdown file |
| **Internal Hooks** | Audit every action taken on external repos, inject target repo context | Files in `<workspace>/hooks/` |
| **Plugin Hooks** | Stream metrics to Vercel dashboard, quality-gate tool calls | Plugin npm package |
| **MCP Servers** | Code analysis, vulnerability scanning, PR quality assessment | `mcporter config add` |
| **Plugin SDK** | Dashboard API endpoints, background PR tracking service | Plugin npm package |
| **Cron Jobs** | Periodic issue discovery, PR follow-up sweeps, quality audits | `openclaw cron add` |
| **Tool Policies** | Restrict agent to safe build/test tools only, sandbox exec | `openclaw.json` config |
| **Workspace Files** | Agent persona as quality OSS contributor, repo-specific conventions | Markdown files |
| **Multi-Agent** | Optional: separate agents for different target repos | `agents.list[]` config |

### Zero Core Modifications Required

Every extension point listed above operates entirely through:
- File creation (skills, hooks, workspace markdown files)
- Configuration (openclaw.json, mcporter.json)
- Package installation (plugins, MCP servers)
- CLI commands (cron jobs, hook management)

**No forking or modification of the openclaw/openclaw repository is needed.**

### What ClawOSS Ships (our project directory)

ClawOSS is a project directory containing everything needed to configure an OpenClaw instance
as a high-quality autonomous OSS contributor. Users install OpenClaw separately, then apply
our configuration on top.

```
clawoss/                             # Our project repo (what we build)
├── README.md                        # Setup guide and documentation
├── setup.sh                         # Script to install configs into ~/.openclaw/
├── config/
│   └── openclaw.json                # Main config (agent, tools, heartbeat, cron)
├── workspace/                       # Copied to ~/.openclaw/workspace/
│   ├── AGENTS.md                    # Core brain: how to discover, implement, submit, follow up
│   ├── SOUL.md                      # Persona: thoughtful, quality-focused OSS contributor
│   ├── USER.md                      # Context about the operator
│   ├── TOOLS.md                     # Conventions for git, gh, build tools across repo types
│   ├── HEARTBEAT.md                 # Monitor: submitted PRs, review comments, CI status
│   ├── BOOTSTRAP.md                 # First-run setup: fork target repos, verify gh auth
│   ├── skills/
│   │   ├── oss-issue-discoverer/    # Find good issues to work on in target repos
│   │   ├── oss-codebase-analyzer/   # Understand a repo's architecture, conventions, tests
│   │   ├── oss-implementer/         # Implement fixes/features with high quality
│   │   ├── oss-self-reviewer/       # Self-review changes before submitting (anti-slop gate)
│   │   ├── oss-pr-submitter/        # Create PR with proper description, tests, docs
│   │   └── oss-feedback-responder/  # Respond to maintainer review feedback
│   ├── hooks/
│   │   ├── dashboard-metrics/       # Stream run metrics to Vercel dashboard API
│   │   └── audit-logger/            # Log every action taken on external repos
│   └── memory/
│       └── MEMORY.md                # Persistent memory: repos, patterns, maintainer prefs
├── plugins/
│   └── clawoss-dashboard/           # Plugin: HTTP routes for dashboard, background tracking
├── dashboard/                       # Vercel Next.js app for monitoring
│   ├── src/
│   └── package.json
├── scripts/
│   ├── launch.sh                    # Start the OpenClaw gateway with ClawOSS config
│   ├── add-target-repo.sh           # Add a new target repo for the agent to contribute to
│   └── setup-cron-jobs.sh           # Configure scheduled autonomous work cycles
└── docker/
    ├── Dockerfile                   # Containerized 24/7 deployment
    └── docker-compose.yml           # Full stack: OpenClaw + dashboard
```

### How it maps to ~/.openclaw/ at runtime

```
~/.openclaw/
├── openclaw.json                    # <- from clawoss/config/openclaw.json
├── workspace/                       # <- from clawoss/workspace/
│   ├── AGENTS.md, SOUL.md, etc.
│   ├── skills/                      # Our custom skills
│   ├── hooks/                       # Our custom hooks
│   └── memory/                      # Agent's persistent memory (grows over time)
├── plugins/
│   └── clawoss-dashboard/           # <- installed from clawoss/plugins/
└── cron/
    └── jobs.json                    # <- configured via scripts/setup-cron-jobs.sh
```

---

## Sources

### DeepWiki
- [OpenClaw Wiki Structure](https://deepwiki.com/openclaw/openclaw)
- [Plugin Architecture](https://deepwiki.com/openclaw/openclaw/9.1-plugin-architecture)

### Official Documentation
- [Skills](https://docs.openclaw.ai/tools/skills)
- [Heartbeat](https://docs.openclaw.ai/gateway/heartbeat)
- [Plugins](https://docs.openclaw.ai/tools/plugin)
- [Cron Jobs](https://docs.openclaw.ai/automation/cron-jobs)

### Web Sources
- [DigitalOcean - What are OpenClaw Skills?](https://www.digitalocean.com/resources/articles/what-are-openclaw-skills)
- [DigitalOcean - What is OpenClaw?](https://www.digitalocean.com/resources/articles/what-is-openclaw)
- [Awesome OpenClaw Skills (5,400+ curated)](https://github.com/VoltAgent/awesome-openclaw-skills)
- [3 Superpowers of OpenClaw (Hooks, Cron, Heartbeat)](https://blog.kryll.io/openclaw-hooks-cron-heartbeat-ai-agent-automation/)
- [OpenClaw Mega Cheatsheet 2026](https://moltfounders.com/openclaw-mega-cheatsheet)
- [MCP Server Setup for OpenClaw](https://www.clawctl.com/blog/mcp-server-setup-guide)
- [OpenClaw MCP Server Integration Guide](https://clawtank.dev/blog/openclaw-mcp-server-integration)
- [OpenClaw 2026.3.7 - ContextEngine Update](https://www.epsilla.com/blogs/2026-03-09-openclaw-2026-3-7-contextengine-agentic-architecture)
- [OpenClaw Design Patterns](https://kenhuangus.substack.com/p/openclaw-design-patterns-part-1-of)
- [OpenClaw Cron Job Automation Guide](https://www.stack-junkie.com/blog/openclaw-cron-jobs-automation-guide)
