# OpenClaw Repository Deep Knowledge Base

> Comprehensive research from DeepWiki analysis of `openclaw/openclaw`
> Generated: 2026-03-16

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Package Structure & Codebase Organization](#2-package-structure--codebase-organization)
3. [Agent Lifecycle & Execution Pipeline](#3-agent-lifecycle--execution-pipeline)
4. [Configuration System](#4-configuration-system)
5. [Skills System](#5-skills-system)
6. [Task Processing Pipeline](#6-task-processing-pipeline)
7. [Subagents & ACP](#7-subagents--acp)
8. [Heartbeat & Autonomous Operation](#8-heartbeat--autonomous-operation)
9. [Context Window Management & Compaction](#9-context-window-management--compaction)
10. [GitHub PR Workflow](#10-github-pr-workflow)
11. [Quality Gates & CI/CD](#11-quality-gates--cicd)
12. [Model Providers & Claude Code Integration](#12-model-providers--claude-code-integration)
13. [Channel System](#13-channel-system)
14. [Security Model](#14-security-model)
15. [Extension Points & Plugin SDK](#15-extension-points--plugin-sdk)
16. [Tool System & Policies](#16-tool-system--policies)
17. [Session Management Deep Dive](#17-session-management-deep-dive)
18. [Commands, Directives & Slash Commands](#18-commands-directives--slash-commands)
19. [WebSocket Protocol & Gateway API](#19-websocket-protocol--gateway-api)
20. [Limitations & Constraints](#20-limitations--constraints)

---

## 1. Architecture Overview

OpenClaw is a **self-hosted gateway** that connects various chat applications to AI agents (primarily the embedded Pi agent). The architecture centers on three key layers:

### Core Components

```
Chat Apps + Plugins --> Gateway --> Agent (Pi Agent)
                                --> CLI
                                --> Web Control UI
                                --> macOS App
                                --> iOS/Android Nodes
```

1. **Gateway** - Central hub handling inbound messages, routing, sessions, authentication, and channel integrations. Can host one or many isolated agents side-by-side. The Gateway watches `openclaw.json` and applies changes automatically.

2. **Agents** - Isolated "brains" each with:
   - **Workspace** (`~/.openclaw/workspace`): Contains `AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, `HEARTBEAT.md`, and `skills/` folder
   - **State Directory** (`~/.openclaw/agents/<agentId>`): Auth profiles, model registry, per-agent config
   - **Session Store** (`~/.openclaw/agents/<agentId>/sessions`): Chat history and routing state (JSONL format)
   - **Skills**: Per-agent via workspace `skills/` or shared from `~/.openclaw/skills`

3. **Nodes** - Devices (Mac, iOS, Android) connecting as peripherals over Gateway WebSocket. Expose local tools (`system.run`, `canvas`, `camera`).

4. **Channels** - WhatsApp, Telegram, Discord, iMessage, Slack, Signal, and more. Channel accounts are created per agent.

### Multi-Agent Routing

The Gateway routes inbound messages to specific agents via **bindings**, allowing separate agents per channel, account, or task. Binding configuration lives in `openclaw.json` under the `agents.list[]` array.

---

## 2. Package Structure & Codebase Organization

### Source Directory (`src/`)

| Directory | Purpose |
|-----------|---------|
| `src/cli` | CLI wiring and command dispatch |
| `src/commands` | Command implementations |
| `src/agents` | Agent capabilities, Pi agent SDK integration, tools, skills, subagents |
| `src/agents/skills` | Skill loading, workspace resolution, prompt limits |
| `src/agents/pi-embedded-runner` | Embedded Pi agent runner and extensions |
| `src/channels` | Core messaging channels (Telegram, Discord, Slack, Signal, iMessage, WhatsApp) |
| `src/infra` | Infrastructure (heartbeat runner, logging, etc.) |
| `src/media` | Media pipeline |
| `src/plugins` | Plugin API and runtime types |
| `src/config` | Configuration types and validation |
| `src/process` | Command queue, process management |
| `src/cron` | Cron service and timer |
| `src/acp` | ACP translator and session management |
| `src/provider-web.ts` | Web provider |

### Other Key Directories

| Path | Purpose |
|------|---------|
| `docs/` | All project documentation |
| `extensions/` | Workspace plugins (msteams, matrix, zalo, voice-call) |
| `skills/` | Bundled skills shipped with OpenClaw |
| `apps/macos` | macOS companion app |
| `apps/ios` | iOS application |
| `apps/shared/OpenClawKit` | Shared Swift package |
| `scripts/pr` | PR review, landing, and merge utilities |
| `.pi/prompts/` | Prompt files for review/land commands |

### Key Files

- `openclaw.mjs` - Binary entry point for the `openclaw` command
- `package.json` - Main entry: `dist/index.js`, exports plugin SDK modules
- `~/.openclaw/openclaw.json` - Primary configuration (JSON5 format)
- `src/agents/workspace.ts` - Workspace constants and resolution logic
- `src/config/types.openclaw.ts` - TypeScript type `OpenClawConfig`
- `src/agents/pi-embedded-runner.ts` - Main entry for embedded agent: `runEmbeddedPiAgent()`
- `src/process/command-queue.ts` - Command queue with lane-based concurrency
- `src/infra/heartbeat-runner.ts` - Heartbeat run/skip logic

### State Directory Structure (`~/.openclaw/`)

```
~/.openclaw/
  openclaw.json          # Main config
  credentials/           # Provider credentials (WhatsApp, etc.)
  agents/
    <agentId>/
      sessions/          # JSONL chat history
      auth/              # Per-agent auth profiles
  workspace/             # Default agent workspace
    AGENTS.md
    SOUL.md
    USER.md
    IDENTITY.md
    TOOLS.md
    HEARTBEAT.md
    BOOTSTRAP.md         # One-time first-run ritual
    MEMORY.md            # Curated long-term memory
    memory/
      YYYY-MM-DD.md      # Daily memory logs
    skills/              # Per-agent skills
  skills/                # Shared/managed skills
```

---

## 3. Agent Lifecycle & Execution Pipeline

### Agent Loop Steps

The "agentic loop" is the complete process turning a message into actions and a reply:

1. **Entry Points**: Agent runs initiated via Gateway RPC (`agent` and `agent.wait`) or CLI `agent` command
2. **Validation & Session Resolution**: The `agent` RPC validates params, resolves session, persists metadata, returns `runId` and `acceptedAt` immediately
3. **Agent Command Execution**: `agentCommand` function resolves model/thinking defaults, loads skills, calls `runEmbeddedPiAgent()`, emits lifecycle events
4. **Embedded Agent Runtime**: `runEmbeddedPiAgent` serializes runs, resolves model and auth profile, builds Pi session, subscribes to events, streams deltas, enforces timeouts
5. **Event Bridging**: `subscribeEmbeddedPiSession` bridges events from `pi-agent-core` runtime to OpenClaw `agent` stream (tool, assistant, lifecycle events)
6. **Waiting for Completion**: `agent.wait` uses `waitForAgentJob` to wait for lifecycle end/error event

### System Prompt Assembly

OpenClaw builds a **custom system prompt** for every agent run (does NOT use `pi-coding-agent` default prompt). The prompt is intentionally compact with fixed sections:
- Tooling definitions
- Safety rules
- Skills metadata
- Workspace files (`AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`)
- Runtime information

Bootstrap files are injected under a "Project Context" section. Truncation limits can be configured via `agents.defaults.bootstrapMaxChars` and `agents.defaults.bootstrapTotalMaxChars`.

---

## 4. Configuration System

### `openclaw.json` (JSON5 Format)

Located at `~/.openclaw/openclaw.json`. Key configuration sections:

```json5
{
  // Agent defaults
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace",
      skipBootstrap: false,
      bootstrapMaxChars: 8000,
      bootstrapTotalMaxChars: 24000,
      sandbox: false,
      contextTokens: 200000,
      heartbeat: {
        interval: "30m",
        model: "anthropic/claude-opus-4-6",
        delivery: "telegram"
      },
      compaction: {
        mode: "auto",
        targetTokens: 100000,
        model: "anthropic/claude-sonnet-4-6"
      },
      subagents: {
        model: "anthropic/claude-sonnet-4-6",
        maxConcurrent: 3,
        runTimeoutSeconds: 600
      }
    },
    list: [
      // Per-agent overrides with bindings
    ]
  },

  // Model configuration
  agent: {
    model: "anthropic/claude-opus-4-6"
  },

  // Skills
  skills: {
    allowBundled: ["github", "web-search"],
    load: {
      extraDirs: ["/path/to/custom/skills"],
      watch: true
    },
    entries: {
      "skill-key": {
        enabled: true,
        env: { "API_KEY": "..." },
        apiKey: "..."
      }
    }
  },

  // Channels
  channels: {
    whatsapp: { allowFrom: [...] },
    telegram: { ... }
  },

  // Logging
  logging: { level: "info" }
}
```

### Workspace Markdown Files

| File | Purpose | Loaded When |
|------|---------|-------------|
| `AGENTS.md` | Operating instructions, rules, priorities, memory guidelines | Every session |
| `SOUL.md` | Agent persona, tone, boundaries | Every session |
| `USER.md` | User description, how to address them | Every session |
| `IDENTITY.md` | Agent name, vibe, emoji | Every session |
| `TOOLS.md` | Notes about local tools/conventions (does NOT control tool availability) | Every session |
| `HEARTBEAT.md` | Checklist for heartbeat runs | Heartbeat runs only |
| `BOOTSTRAP.md` | One-time first-run ritual | First run only (then deleted) |
| `MEMORY.md` | Curated long-term memory | Main, private sessions only |

---

## 5. Skills System

### What is a Skill?

A skill is a directory containing a `SKILL.md` file that defines instructions and tool definitions for the LLM, optionally with scripts or resources.

### Loading Precedence (highest to lowest)

1. **Workspace skills** (`<workspace>/skills/`) - highest priority
2. **Managed/local skills** (`~/.openclaw/skills/`)
3. **Bundled skills** (shipped with OpenClaw)
4. **Extra directories** (`skills.load.extraDirs` in config)
5. **Plugin skills** (from `openclaw.plugin.json`)

### SKILL.md Frontmatter

```markdown
---
name: my-skill
description: Does something useful
user-invocable: true          # Expose as slash command
disable-model-invocation: false  # Include in model prompt
requires:
  bins: ["gh"]                 # Required binaries
  env: ["GITHUB_TOKEN"]       # Required env vars
  config: ["some.setting"]    # Required config
metadata:
  openclaw:
    # Filtering criteria
---

## Instructions for the LLM...
```

### Skill Lifecycle

1. On agent run start: reads skill metadata
2. Applies `skills.entries.<key>.env` / `skills.entries.<key>.apiKey` to `process.env`
3. Builds system prompt with eligible skills (filtered by requirements)
4. `applySkillsPromptLimits` enforces character and count limits
5. After run: restores original environment

### Hot Reload

When `skills.load.watch: true`, changes to skill files are picked up on the next agent turn. Otherwise, changes apply on next new session.

---

## 6. Task Processing Pipeline

### Command Queue System

Tasks use a **lane-based command queue** (`src/process/command-queue.ts`):

1. **Enqueue**: `enqueueCommandInLane(lane, taskFn)` creates a `QueueEntry` with task function, resolve/reject callbacks, and `enqueuedAt` timestamp
2. **Drain**: `drainLane()` processes tasks respecting `maxConcurrent` per lane
3. **Execute**: Tasks shift from queue, get assigned `taskId`, added to `activeTaskIds`
4. **Complete**: `completeTask()` removes from `activeTaskIds`, calls `pump()` for next task

Concurrency is controlled per-lane via `maxConcurrent` setting.

### Lobster Workflow Runtime

For complex multi-step workflows, OpenClaw uses **Lobster**:

- **Deterministic execution** with explicit approval gates
- **Resumable states** with `resumeToken`
- **Pipeline definitions** as chained commands or `.lobster` workflow files
- **Integration**: Triggered via the `lobster` tool in "tool mode"
- **Approval flow**: Workflow pauses at approval steps, returns `resumeToken`, user resumes with `approve: true`
- **Triggers**: Can be started by cron jobs or heartbeat mechanisms

---

## 7. Subagents & ACP

### Subagents (Native)

Subagents are isolated agent runs spawned from an existing agent for background/parallel work.

**Spawning**: Via `sessions_spawn` tool (non-blocking, returns `runId` + `childSessionKey`)

```json
{
  "task": "Open the repo and summarize failing tests"
}
```

**Key Properties**:
- Session key format: `agent:<agentId>:subagent:<uuid>`
- Default full tool set minus session tools
- Cannot spawn their own subagents unless `maxSpawnDepth` configured
- Results announced back to requester's chat channel
- Each has its own context and token usage
- Configurable via `agents.defaults.subagents` (model, concurrency, timeout)

### ACP (Agent Client Protocol) Sessions

ACP sessions run **external coding harnesses** (Claude Code, Codex, OpenCode, Gemini CLI).

**Spawning**: Via `sessions_spawn` with `runtime: "acp"`

```json
{
  "task": "Open the repo and summarize failing tests",
  "runtime": "acp",
  "agentId": "codex",
  "thread": true,
  "mode": "session"
}
```

**Key Properties**:
- Session key format: `agent:<agentId>:acp:<uuid>`
- Uses external harness runtime (not OpenClaw native)
- Falls back to `acp.defaultAgent` if `agentId` omitted
- Managed through ACP backend plugin (`src/acp/translator.ts`)

---

## 8. Heartbeat & Autonomous Operation

### HEARTBEAT.md

An optional markdown checklist in the workspace providing the agent with routine tasks during periodic heartbeat runs.

**Properties**:
- Location: `<workspace>/HEARTBEAT.md`
- If empty (only blank lines/headers): heartbeat run is skipped (saves API calls)
- Agent can modify it if instructed
- Must not contain sensitive information (becomes part of prompt context)

### Heartbeat Runs

Periodic agent turns in the main session for proactive monitoring.

- **Default cadence**: Every 30 minutes (configurable)
- **Default prompt**: Instructs agent to read `HEARTBEAT.md`, reply `HEARTBEAT_OK` if nothing needs attention
- **Response suppression**: If agent replies `HEARTBEAT_OK`, outbound delivery is suppressed
- **Skip conditions**: Outside active hours, requests in flight, `HEARTBEAT.md` empty
- **Configuration**: Global (`agents.defaults.heartbeat`) or per-agent (`agents.list[].heartbeat`)
  - Settings: `interval`, `model`, `delivery` target

### Cron Jobs

For precise scheduling (daily reports, weekly reviews):
- Isolated task execution with potentially different model/thinking level
- Defined in cron service (`src/cron/service/timer.ts`)
- Can trigger Lobster workflows

### Autonomous Operation Flow

```
Heartbeat Timer (30min) --> Check HEARTBEAT.md --> Agent Turn
Cron Schedule           --> Isolated Agent Run --> Lobster Workflow (optional)
                                               --> Subagent Spawn (optional)
```

---

## 9. Context Window Management & Compaction

### Context Window

The context window = max tokens a model can process at once. Everything counts:
- System prompt
- Conversation history
- Tool calls/results
- Attachments
- Compaction summaries
- Provider wrappers

**Resolution sources** (in order):
1. Model definition from provider catalog
2. `models.providers.*.models[].contextWindow` override
3. Default value
4. Cap via `agents.defaults.contextTokens`

**Inspection commands**: `/status`, `/context list`, `/context detail`

### Context Compaction

Summarizes older conversation to free context space. Persistent (modifies JSONL history).

**Trigger Conditions**:
1. **Overflow recovery**: Model returns context overflow error -> compaction -> retry
2. **Threshold maintenance**: After successful turn, if `contextTokens > contextWindow - reserveTokens`
3. **Manual**: `/compact` command with optional guidance instructions

**Configuration** (`agents.defaults.compaction`):
- `mode`: auto/manual
- `targetTokens`: target after compaction
- `model`: model for summarization (can use cheaper model)
- `reserveTokens`: headroom for prompts (safety floor enforced)
- `keepRecentTokens`: recent history preserved intact

**Pre-compaction Memory Flush**:
Before compaction, a "silent memory flush" stores durable notes to disk (prevents critical context loss). Uses `NO_REPLY` convention to suppress visible output. Triggered at "soft threshold."

### Compaction vs. Session Pruning

| Feature | Compaction | Session Pruning |
|---------|-----------|-----------------|
| What | Summarizes older conversation | Trims old tool results |
| Persistence | Writes to JSONL on disk | In-memory only |
| Scope | Full conversation history | Tool results only |

---

## 10. GitHub PR Workflow

### Three Phases

#### Phase 1: PR Creation & Preparation

Pre-submission requirements:
- Test locally with OpenClaw instance
- Run `pnpm build && pnpm check && pnpm test`
- Optionally run `codex review --base origin/main`
- Keep PRs focused on a single issue
- Clear "what & why" description
- Screenshots for UI changes
- American English spelling

**AI-assisted PRs** require extra transparency: mark as AI-assisted, note testing degree, include prompts/session logs.

#### Phase 2: PR Review (`/reviewpr` command)

Structured review process with scripts from `scripts/pr`:

1. **Truthfulness Gate**: Verify bug claims (symptom evidence, root cause, fix targets correct path)
2. **PR Meta + Context**: Gather details via `pr_meta_json`
3. **Read Description & Diff**: Full review
4. **Validate Change**: Needed? Valuable? Smallest reasonable fix?
5. **Implementation Quality**: Correctness, design, performance, security, style
6. **Tests & Verification**: Coverage, regression tests, missing cases
7. **Follow-up Refactors**: Simplifications, TODOs, doc/type updates
8. **Key Questions**: Claim substantiated? Update needed? Blocking concerns?
9. **Structured Output**: TL;DR, claim verification matrix, changes summary, concerns (BLOCKER/IMPORTANT/NIT)

Utilities: `review_init`, `review_checkout_main`, `review_checkout_pr`, `review_guard`

#### Phase 3: PR Landing (`/landpr` command)

Full merge workflow:
1. Assign PR to self
2. Ensure clean git status
3. Identify PR meta (author, head branch)
4. Fast-forward base (`git pull --ff-only` on main)
5. Create temp base branch
6. Checkout PR branch (`gh pr checkout`)
7. Rebase onto temp base, fix conflicts
8. Implement fixes, adjust tests, update `CHANGELOG.md`
9. Decide merge strategy (squash preferred)
10. **Full gate**: `pnpm lint && pnpm build && pnpm test`
11. Commit with specific format (`prepare_validate_commit`)
12. Force push rebased branch
13. Merge via `gh pr merge --squash` (or `--rebase`)
14. Sync main, comment on PR, verify MERGED state, delete temp branch

Merge verification (`merge_verify`): checks failing/pending required checks, draft status, branch drift.

---

## 11. Quality Gates & CI/CD

### Local Quality Gates

```bash
pnpm build         # Build project
pnpm check         # TypeScript type check + lint + format
pnpm test          # Unit and integration tests
pnpm test:coverage # Coverage checks
pnpm test:e2e      # End-to-end tests
pnpm test:live     # Live tests with real providers (requires credentials)
```

### CI Pipeline (`.github/workflows/ci.yml`)

Runs on every push to `main` and every PR. Uses "smart scoping" to skip irrelevant jobs.

| Job | Purpose |
|-----|---------|
| `docs-scope` / `changed-scope` | Detect if changes are docs-only or affect specific areas |
| `check` | TypeScript type checks, linting, formatting |
| `check-docs` | Markdown linting, broken link detection |
| `secrets` | Detect leaked secrets |
| `checks` | Node tests + protocol checks (sharded across instances) |
| `checks-windows` | Windows-specific tests |
| `macos` | Swift lint + build + test, TypeScript tests for macOS |
| `android` | Gradle build + tests |
| `build-artifacts` | Build dist artifacts (main push + Node changes) |
| `release-check` | Validate npm package contents |
| `compat-node22` | Node 22+ compatibility check |

### Bug Fix Quality Gates

1. **Symptom Evidence**: Reproduction case, logs, or failing test
2. **Verified Root Cause**: Exact file and line number
3. **Fix Targets Correct Path**: Directly addresses implicated code
4. **Regression Test**: Failing before fix, passing after (required when feasible)

### Changelog Requirements

Every PR must update `CHANGELOG.md` with contributor attribution (pure test additions exempt unless altering user-facing behavior). Validated by `validate_changelog_entry_for_pr`.

---

## 12. Model Providers & Claude Code Integration

### Built-in Providers (No extra config needed)

| Provider | Auth Method | Example Model |
|----------|------------|---------------|
| OpenAI | `OPENAI_API_KEY` | `openai/gpt-5.4` |
| Anthropic | `ANTHROPIC_API_KEY` or Claude `setup-token` | `anthropic/claude-opus-4-6` |
| OpenAI Code (Codex) | OAuth (ChatGPT) | `openai-codex/gpt-5.4` |
| OpenCode | `OPENCODE_API_KEY` | `opencode/...` |
| Google Gemini | `GEMINI_API_KEY` | `google/gemini-3.1-pro-preview` |
| Google Vertex | gcloud ADC | `vertex/...` |

### Additional Providers

Amazon Bedrock, Cloudflare AI Gateway, Hugging Face, LiteLLM, Mistral, Moonshot AI, NVIDIA, Ollama, OpenRouter, Together AI, Vercel AI Gateway, Venice, vLLM, and many more.

### Claude Code Integration

- **CLI Backend**: Claude Code CLI serves as text-only fallback when API providers unavailable/rate-limited
- **Safety net design**: Disables tools, provides text-in/text-out only
- **Usage**: `openclaw agent --message "hi" --model claude-cli/opus-4.6`
- **Subscription auth**: Via `setup-token` from Claude Code CLI, pasted with `openclaw models auth paste-token --provider anthropic`
- **`claude-max-api-proxy`**: Community tool exposing Claude Max/Pro subscription as OpenAI-compatible endpoint

### MCP Integration

- Via **`mcporter`** (separate project)
- Decoupled from core runtime
- Changes to MCP servers don't require gateway restart
- Reduces MCP churn impact on core stability

---

## 13. Channel System

### Supported Channels

Core channels (in `src/channels/`):
- Telegram
- Discord
- Slack
- Signal
- iMessage
- WhatsApp Web

Extension channels (in `extensions/`):
- Microsoft Teams
- Matrix
- Zalo
- Voice Call

### Channel Architecture

- Channel accounts created per agent
- Message flow: Chat App -> Gateway -> Agent -> (optional) Node
- Per-channel `allowFrom` configuration for access control
- Each channel has its own protocol adapter

---

## 14. Security Model

### Trust Boundaries

- **Channel access**: Per-agent channel bindings with `allowFrom` lists
- **Session isolation**: Per-agent sessions with separate state directories
- **Tool execution**: Sandboxed execution environment
- **Auth profiles**: Per-agent (credentials not shared between agents)
- **Secret management**: Credentials stored in `~/.openclaw/credentials/`
- **Sandbox mode**: `agents.defaults.sandbox` enables per-session workspaces for non-main sessions
- **HEARTBEAT.md**: Must not contain API keys or secrets (injected into prompt)

---

## 15. Extension Points & Plugin SDK

### Plugin Architecture

- Plugins defined in `extensions/` directory as workspace packages
- Each manages own dependencies in its `package.json`
- Plugin manifest: `openclaw.plugin.json`

### Extension Types

1. **Channel Plugins**: Add new messaging channels (e.g., MS Teams, Matrix)
2. **Tool Plugins**: Add new tools available to agents
3. **Skill Plugins**: Ship skills via `openclaw.plugin.json`

### Plugin SDK Exports

The `package.json` exports plugin SDK modules for:
- Plugin API definitions
- Runtime types
- Channel plugin interface
- Tool plugin interface

### Key Extension Points for ClawOSS

1. **Skills**: Custom `SKILL.md` in workspace `skills/` (highest precedence)
2. **Workspace files**: `AGENTS.md`, `SOUL.md` for behavior customization
3. **Configuration**: Full control via `openclaw.json`
4. **Subagents**: Spawn parallel workers for different tasks
5. **ACP sessions**: Integrate external coding harnesses
6. **Heartbeat**: Autonomous periodic operation
7. **Cron**: Scheduled task execution
8. **Lobster**: Multi-step deterministic workflows with approval gates
9. **Channel plugins**: Add custom channels
10. **Tool plugins**: Add custom tools

---

## 16. Tool System & Policies

### Complete Tool Inventory

| Tool | Purpose |
|------|---------|
| `read` | Read file contents |
| `write` | Create or overwrite files |
| `edit` | Precise file edits |
| `apply_patch` | Multi-file structured patches |
| `grep` | Search file contents for patterns |
| `find` | Find files by glob pattern |
| `ls` | List directory contents |
| `exec` | Run shell commands (replaces `bash`) |
| `process` | Manage background exec sessions (poll, log, write, kill, clear) |
| `web_search` | Search the web |
| `web_fetch` | Fetch and extract readable content from URLs |
| `browser` | Control web browser |
| `canvas` | Present/eval/snapshot the Canvas |
| `nodes` | List/describe/notify/camera/screen on paired nodes |
| `cron` | Manage cron jobs and wake events |
| `message` | Send messages and channel actions |
| `gateway` | Restart, apply config, or run updates |
| `agents_list` | List agent IDs allowed for `sessions_spawn` |
| `sessions_list` | List other sessions including sub-agents |
| `sessions_history` | Fetch history for another session/sub-agent |
| `sessions_send` | Send message to another session/sub-agent |
| `sessions_spawn` | Spawn isolated sub-agent or ACP coding session |
| `subagents` | List, steer, or kill spawned sub-agents |
| `session_status` | Show status card (usage + time + toggles) |
| `image` | Analyze image with configured image model |
| `memory_search` | Search agent memory |
| `memory_get` | Retrieve agent memory |

### Plugin Tools

- **Lobster**: Workflow runtime tool
- **LLM Task**: Structured workflow output
- **Diffs**: View diffs

### Tool Policy Filtering (Applied in Order)

Policies are layered; `deny` always takes precedence. Each layer can restrict but never re-enable denied tools.

1. **Tool Profile** (`tools.profile` or `agents.list[].tools.profile`)
   - Predefined: `minimal`, `coding`, `messaging`, `full`
2. **Provider Tool Profile** (`tools.byProvider[provider].profile`)
3. **Global Tool Policy** (`tools.allow` / `tools.deny`)
4. **Provider Tool Policy** (`tools.byProvider[provider].allow/deny`)
5. **Agent-Specific Policy** (`agents.list[].tools.allow/deny`)
6. **Agent Provider Policy** (`agents.list[].tools.byProvider[provider].allow/deny`)
7. **Sandbox Tool Policy** (`tools.sandbox.tools.allow/deny`)
8. **Subagent Tool Policy** (`tools.subagents.tools`)

**Tool Groups**: Shorthands like `group:runtime`, `group:fs` for common sets.

**Key Functions**:
- `filterToolsByPolicy` - applies policies to tool list
- `resolveEffectiveToolPolicy` - determines combined policy for agent + provider
- `createOpenClawTools` - assembles final tool list
- `createOpenClawCodingTools` (`src/agents/pi-tools.ts`) - creates comprehensive tool list with all filtering

### Exec Tool Details

- Runs shell commands in workspace
- `yieldMs`: auto-background after N ms
- `timeout`: command timeout
- `elevated`: escape hatch for sandboxed agents to run on host (does NOT grant extra tools)
- OpenClaw replaces `bash` with `exec`/`process`

### Tool-Loop Detection

Detects and prevents agents from getting stuck in repetitive tool-call patterns. Configurable globally or per-agent.

---

## 17. Session Management Deep Dive

### Two-Layer Persistence

1. **Session Store** (`~/.openclaw/agents/<agentId>/sessions/sessions.json`)
   - Key/value map: `sessionKey -> SessionEntry`
   - Tracks: current `sessionId`, last activity, toggles, token counters

2. **Transcript** (`~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`)
   - Append-only with tree structure (entries have `id` and `parentId`)
   - First line: session header
   - Entry types: `message` (user/assistant/toolResult), `custom_message` (extension-injected, enters model context), `custom` (extension state, no model context), `compaction` (persisted summary), `branch_summary`

### Session Key Patterns

| Chat Type | Session Key Format |
|-----------|-------------------|
| Direct (default) | `agent:<agentId>:<mainKey>` |
| Direct (per-peer) | `agent:<agentId>:direct:<peerId>` |
| Direct (per-channel) | `agent:<agentId>:<channel>:direct:<peerId>` |
| Direct (full scope) | `agent:<agentId>:<channel>:<accountId>:direct:<peerId>` |
| Group | `agent:<agentId>:<channel>:group:<id>` |
| Room/Channel | `agent:<agentId>:<channel>:channel:<id>` |
| Cron | `cron:<job.id>` |
| Webhook | `hook:<uuid>` |
| Subagent | `agent:<agentId>:subagent:<uuid>` |
| ACP | `agent:<agentId>:acp:<uuid>` |

DM scope configurable via `session.dmScope`.

### Session Lifecycle

- **Creation/Resume**: `initSessionState` function; `resolveSession` checks freshness
- **New session triggers**: daily reset, idle expiry, explicit request
- **Hooks**: `session_start` fires on creation; `session_end` fires when old session replaced
- **Recording**: `recordInboundSession` (`src/channels/session.ts`) updates last route info

### Session Maintenance & Cleanup

Configured via `session.maintenance`. Mode: `warn` (report) or `enforce` (cleanup).

Enforcement order:
1. Prune stale entries older than `pruneAfter`
2. Cap entry count to `maxEntries` (oldest first)
3. Archive transcript files for removed entries
4. Purge old archives by retention policy
5. Rotate `sessions.json` if exceeds `rotateBytes`
6. Enforce disk budget if `maxDiskBytes` set

Triggers: during session-store writes, or manual `openclaw sessions cleanup`.

### In-Memory Session Pruning

Separate from disk maintenance. Trims old `toolResult` messages from in-memory context before LLM calls. Optimizes caching for providers like Anthropic. Does NOT rewrite JSONL.

---

## 18. Commands, Directives & Slash Commands

### Commands vs. Directives

| Type | Description | Example |
|------|-------------|---------|
| **Commands** | Standalone `/` messages triggering actions | `/help`, `/status`, `/skill` |
| **Directives** | Stripped before model sees message; control settings | `/think`, `/model`, `/elevated` |

Commands can also function as **inline shortcuts** when embedded in normal messages (processed before model sees rest of message): `/help`, `/commands`, `/status`, `/whoami`.

### Directive Behavior

- Message with **only** directives: settings persist to session
- Message with directives + text: directives act as inline hints for that message only

### Available Directives

| Directive | Purpose |
|-----------|---------|
| `/think` | Enable/control thinking/reasoning |
| `/verbose` | Toggle verbose mode |
| `/reasoning` | Control reasoning level |
| `/elevated` | Enable elevated (host) execution for sandboxed agents |
| `/model` | Switch model for this message |
| `/queue` | Queue control |

### Key Commands

| Command | Purpose |
|---------|---------|
| `/help` | Help information |
| `/commands` | List available commands |
| `/status` | Quick status overview |
| `/whoami` | Show agent identity |
| `/skill <name>` | Run a skill by name |
| `/subagents` | List/manage subagents |
| `/compact` | Manual context compaction |
| `/context list` | Show injected files and sizes |
| `/context detail` | Deep breakdown per file, tool, skill |
| `/acp` | Manage ACP sessions |

### Implementation

- Command definitions: `src/auto-reply/commands-registry.data.ts` (array of `ChatCommandDefinition` objects)
- UI slash commands: `ui/src/ui/chat/slash-commands.ts` (includes `executeLocal: true` for client-side commands)
- Client-side execution: `ui/src/ui/chat/slash-command-executor.ts` (`executeSlashCommand` function)

---

## 19. WebSocket Protocol & Gateway API

### Protocol Overview

Single control plane and node transport for all clients (CLI, web UI, macOS app, iOS/Android nodes). Text frames with JSON payloads.

### Frame Types

| Type | Direction | Format |
|------|-----------|--------|
| Request | Client -> Gateway | `{type:"req", id, method, params}` |
| Response | Gateway -> Client | `{type:"res", id, ok, payload\|error}` |
| Event | Gateway -> Client | `{type:"event", event, payload, seq?, stateVersion?}` |

Protocol defined using **TypeBox schemas** (runtime validation, JSON Schema export, Swift codegen).

### Node Connection Flow

1. Node connects to WebSocket server, declares `role: node`
2. First frame must be `connect` request
3. Node provides device identity: `{id, publicKey, signature, signedAt, nonce}`
4. Declares capabilities (`caps`) and commands (`canvas.*`, `camera.*`, `screen.record`, `location.get`)
5. Pairing approval stored in device pairing store
6. Gateway issues device token for subsequent connections

### Server Events

| Event | Purpose |
|-------|---------|
| `agent` | Streaming tool/output events from agent runs |
| `chat` | Chat-related events |
| `presence` | Client presence updates (pushed to all) |
| `tick` | Keep-alive/no-op |
| `shutdown` | Gateway exiting (with reason + optional `restartExpectedMs`) |
| `health` | Health snapshots |
| `connect.challenge` | Pre-connect challenge |

Full event list: `src/gateway/server-methods-list.ts`

### Gateway API Details

- **Key Methods**: `health`, `status`, `send`, `agent`, `node.list`, `node.invoke`
- **Idempotency**: Side-effecting methods (`send`, `agent`) require idempotency keys
- **Roles**: `operator` (control plane clients) or `node` (capability hosts)
- **Scopes**: Operators declare scopes for least-privilege access
- **Validation**: Inbound frames validated against JSON Schema

---

## 20. Limitations & Constraints

### Known Constraints

1. **Context window limits**: Even with compaction, very long conversations will lose detail from summaries
2. **Subagent nesting**: Subagents cannot spawn sub-subagents by default (requires `maxSpawnDepth` config)
3. **Skill prompt limits**: `applySkillsPromptLimits` enforces character and count limits on skills in prompt
4. **Bootstrap file truncation**: Large workspace files get truncated per `bootstrapMaxChars` / `bootstrapTotalMaxChars`
5. **Claude Code CLI fallback**: Disables tools, text-only (not suitable for tool-heavy workflows)
6. **Heartbeat frequency**: Minimum practical interval limited by API costs and rate limits
7. **HEARTBEAT.md size**: Should be kept short to avoid prompt bloat
8. **MCP integration**: Via separate `mcporter` project, adding deployment complexity
9. **Auth isolation**: Per-agent auth means credentials must be configured for each agent separately
10. **Compaction quality**: Summarization may lose nuanced context from older turns
11. **Tool-loop detection**: May interfere with legitimate repetitive operations if misconfigured
12. **Session pruning**: In-memory only, does not free disk space
13. **Elevated mode**: Only applies to `exec` tool, not a general privilege escalation

### Architecture Considerations for ClawOSS

- **Single agent approach**: OpenClaw supports multi-agent but each agent is isolated; cross-agent communication requires channel routing
- **Session persistence**: JSONL format on disk; no built-in cloud sync
- **Gateway as single point**: All traffic flows through the Gateway; no distributed mode documented
- **Tool execution**: Depends on Node environment and available binaries
- **Rate limiting**: Provider-dependent; Claude Code CLI fallback exists but is limited
- **Tool policy layering**: 8 layers of tool filtering; must ensure ClawOSS tools are allowed at all levels
- **Session key isolation**: Each session type has distinct key format; subagents and ACP sessions are separate

---

## Summary of Key Entry Points for Implementation

| What | Where | Key Function/File |
|------|-------|-------------------|
| Agent runner | `src/agents/pi-embedded-runner.ts` | `runEmbeddedPiAgent()` |
| Skills loading | `src/agents/skills/workspace.ts` | `loadSkillEntries()` |
| Tool assembly | `src/agents/pi-tools.ts` | `createOpenClawCodingTools()` |
| Tool filtering | `src/agents/pi-tools.ts` | `filterToolsByPolicy()`, `resolveEffectiveToolPolicy()` |
| Command queue | `src/process/command-queue.ts` | `enqueueCommandInLane()` |
| Heartbeat | `src/infra/heartbeat-runner.ts` | heartbeat run/skip logic |
| Context guard | `src/agents/context-window-guard.ts` | `resolveContextWindowInfo()` |
| Subagent spawn | `src/agents/subagent-spawn.ts` | `spawnSubagentDirect()` |
| Subagent prompt | `src/agents/subagent-announce.ts` | `buildSubagentSystemPrompt()` |
| ACP translation | `src/acp/translator.ts` | event bridging |
| Config types | `src/config/types.openclaw.ts` | `OpenClawConfig` type |
| Workspace | `src/agents/workspace.ts` | workspace constants/resolution |
| Session keys | `src/config/sessions/session-key.ts` | `resolveSessionKey()` |
| Session state | `src/channels/session.ts` | `recordInboundSession()` |
| Cron timer | `src/cron/service/timer.ts` | cron execution |
| Commands | `src/auto-reply/commands-registry.data.ts` | `ChatCommandDefinition[]` |
| Gateway events | `src/gateway/server-methods-list.ts` | event type definitions |
| PR utilities | `scripts/pr` | review, land, merge functions |
| PR prompts | `.pi/prompts/reviewpr.md`, `.pi/prompts/landpr.md` | structured PR workflows |
