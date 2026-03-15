# OpenClaw Complete Reference (via DeepWiki)

> Comprehensive reference compiled from 35+ DeepWiki queries covering every major area of OpenClaw.
> Last updated: 2026-03-16

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Gateway](#2-gateway)
3. [Agent Loop & Execution](#3-agent-loop--execution)
4. [Session Management](#4-session-management)
5. [Sub-Agents & sessions_spawn](#5-sub-agents--sessions_spawn)
6. [Skills System](#6-skills-system)
7. [Cron & Scheduled Jobs](#7-cron--scheduled-jobs)
8. [Multi-Agent System](#8-multi-agent-system)
9. [Sandbox System](#9-sandbox-system)
10. [Memory System](#10-memory-system)
11. [Compaction & Context Management](#11-compaction--context-management)
12. [Bootstrap Files & System Prompt](#12-bootstrap-files--system-prompt)
13. [Tool System & Policies](#13-tool-system--policies)
14. [Exec & Process Tools](#14-exec--process-tools)
15. [Heartbeat System](#15-heartbeat-system)
16. [System Events & Self-Wake](#16-system-events--self-wake)
17. [Model Configuration](#17-model-configuration)
18. [Authentication & Access Control](#18-authentication--access-control)
19. [Hooks & Plugin SDK](#19-hooks--plugin-sdk)
20. [Channels & Integrations](#20-channels--integrations)
21. [Control UI & Native Clients](#21-control-ui--native-clients)
22. [Configuration Reference](#22-configuration-reference)
23. [CLI Commands](#23-cli-commands)
24. [Webhooks & Delivery](#24-webhooks--delivery)
25. [Prompt Caching](#25-prompt-caching)
26. [Error Handling & Retries](#26-error-handling--retries)
27. [Session Maintenance](#27-session-maintenance)
28. [Environment Variables](#28-environment-variables)
29. [ACP (Agent Client Protocol)](#29-acp-agent-client-protocol)
30. [Gateway Health & Monitoring](#30-gateway-health--monitoring)

---

## 1. Architecture Overview

- **Gateway** is the single control plane for sessions, routing, channels, and events
- Connects chat apps (WhatsApp, Telegram, Discord, iMessage, Slack) to embedded Pi coding agent
- Clients: CLI, Web Control UI, macOS app, iOS/Android nodes
- WebSocket protocol (JSON over text frames) on port 18789 by default

```
Chat apps + plugins --> Gateway --> Pi agent
                                --> CLI
                                --> Web Control UI
                                --> macOS app
                                --> iOS/Android nodes
```

---

## 2. Gateway

### WebSocket Protocol
- Clients send `{type:"req", id, method, params}`, receive `{type:"res", id, ok, payload|error}`
- Server pushes `{type:"event", event, payload, seq?, stateVersion?}`
- All inbound frames validated against JSON Schema using AJV
- TypeBox schemas generate JSON Schema + Swift models

### Connection Handshake
1. Client sends `connect` as first frame (includes role, scopes, capabilities, auth)
2. Gateway may issue `connect.challenge` before connect
3. On success: `hello-ok` with protocol version, available methods, state snapshot

### RPC Methods
- **Core**: `connect`, `health`, `status`, `system-presence`, `system-event`
- **Messaging**: `send`, `agent`, `agent.wait`, `poll`
- **Chat**: `chat.history`, `chat.send`, `chat.abort`, `chat.inject`
- **Sessions**: `sessions.list`, `sessions.patch`, `sessions.delete`
- **Nodes**: `node.list`, `node.describe`, `node.invoke`, `node.pair.*`

### Server-Push Events
- `agent`: Streams tool and output events from agent runs
- `presence`: Incremental presence updates
- `tick`: Periodic keep-alive
- `shutdown`: Gateway exiting (includes `restartExpectedMs`)
- Events are NOT replayed; clients should refresh state on sequence gaps

### Service Management (macOS)
- Managed as per-user LaunchAgent (`ai.openclaw.gateway`)
- Plist at `~/Library/LaunchAgents/ai.openclaw.gateway.plist`
- Logs at `/tmp/openclaw/openclaw-gateway.log`
- Commands: `openclaw gateway install`, `start`, `stop`, `restart`, `uninstall`
- Auto-restarts on crash, persists across reboots

---

## 3. Agent Loop & Execution

### Pipeline
1. Parameter validation and session resolution
2. `agentCommand` runs the agent
3. Loads skills snapshots
4. Calls `runEmbeddedPiAgent` (serialized per session)
5. Resolves model and auth profile
6. Builds Pi session
7. Subscribes to Pi events
8. Streams assistant/tool deltas
9. Enforces timeouts
10. Persists results

### Key Properties
- Runs are serialized per session key (no parallel runs in same session)
- Default timeout: 600 seconds (10 minutes)
- Two-stage response: immediate acceptance (`runId`, `acceptedAt`) + final completion
- If no lifecycle end/error event emitted, `agentCommand` emits fallback

---

## 4. Session Management

### Session Storage
- `sessions.json` (metadata) per agent at `~/.openclaw/agents/<agentId>/sessions/`
- `<sessionId>.jsonl` (transcript with conversation history + tool calls)

### dmScope Options
- `main` (default): All DMs share one session for continuity
- `per-peer`: Isolate by sender ID across channels
- `per-channel-peer`: Isolate by channel + sender
- `per-account-channel-peer`: Isolate by account + channel + sender

### Session Key Resolution
1. Use explicit `sessionKey` if provided
2. Derive from `dmScope` and message context
3. If `sessionId` provided and key doesn't match, search stores
4. Falls back to canonical main session key for default agent

### Daily Reset
- Default: 4:00 AM local time
- Creates new `sessionId` for the `sessionKey`
- Old transcript archived

---

## 5. Sub-Agents & sessions_spawn

### Spawning Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `task` | string | **required** | Initial prompt/instruction |
| `label` | string | optional | For logs and UI |
| `agentId` | string | optional | Target agent ID |
| `model` | string | optional | Model override |
| `thinking` | string | optional | Thinking level override |
| `runTimeoutSeconds` | number | from config or 0 | Timeout (0 = none) |
| `thread` | boolean | false | Thread-bound routing |
| `mode` | "run"/"session" | "run" | One-shot vs persistent |
| `cleanup` | "delete"/"keep" | "keep" | Post-announce cleanup |
| `sandbox` | "inherit"/"require" | "inherit" | Sandbox behavior |
| `attachments` | array | optional | Inline files for child workspace |
| `runtime` | "subagent"/"acp" | "subagent" | Runtime type |

### Attachments
- Materialized to `.openclaw/attachments/<uuid>/` in child workspace
- Limits: 5MB total, 50 files max, 1MB per file
- Properties per file: `name`, `content`, `encoding?` (utf8/base64), `mimeType?`
- Only supported for `subagent` runtime (ACP rejects them)
- Content redacted from transcript persistence

### Announce Mechanism
- Sub-agent posts back: **Status** (completed/failed/timed out), **Result** (assistant reply or latest toolResult), **Stats** (runtime, tokens, cost)
- Parent receives via `deliverSubagentAnnouncement`
- Top-level: direct delivery via `callGateway` with `deliver=true`
- Nested: internal injection (`deliver=false`) for orchestrator synthesis
- Can suppress with `ANNOUNCE_SKIP`

### Timeout Behavior
- When `runTimeoutSeconds` expires: sub-agent aborted, announce step STILL runs
- Status reported: "timed out"
- Sub-agent session persists until `archiveAfterMinutes` (default 60 min)
- Parent handles gracefully via announce

### Configuration
- `maxSpawnDepth`: Default 1 (sub-agents can't spawn further). Set to 2 for orchestrator pattern
- `maxChildrenPerAgent`: Default 5 concurrent children per session
- `maxConcurrent`: Default 8 global sub-agent concurrency
- `archiveAfterMinutes`: Default 60 min auto-archive
- `announceTimeoutMs`: Timeout for the announce step itself

### Tool Access (CRITICAL)
Sub-agents by default have:
- **ALLOWED**: `exec`, `read`, `write`, `edit`, `web_fetch`, `web_search`, `image`
- **DENIED**: `memory_search`, `memory_get`, `sessions_send`, `sessions_list`, `sessions_history`, `sessions_spawn`, `subagents`, `gateway`, `agents_list`, `cron`, `session_status`
- Depth-1 orchestrators (if `maxSpawnDepth >= 2`) additionally get: `sessions_spawn`, `subagents`, `sessions_list`, `sessions_history`

---

## 6. Skills System

### Loading Precedence (highest to lowest)
1. `<workspace>/skills` (workspace skills)
2. `~/.openclaw/skills` (managed/local skills)
3. Bundled skills (shipped with OpenClaw)
4. `skills.load.extraDirs` (custom directories)
5. Plugin skills (from `openclaw.plugin.json`)

### SKILL.md Structure
```yaml
---
name: skill-name
description: What the skill does
user-invocable: true  # expose as slash command
command-dispatch: tool  # bypass model, dispatch to tool directly
metadata: {"openclaw":{"requires":{"bins":["gh"]}}}
---
# Skill instructions (Markdown for the LLM)
```

### Gating
- `requires.bins`: Required binaries in PATH
- `requires.anyBins`: At least one binary required
- `requires.env`: Required environment variables
- `requires.config`: Required config paths
- `skills.entries.<skillKey>.enabled`: Enable/disable per skill

### Invocation
- **Model**: Compact XML list injected into system prompt; model reads SKILL.md via `read` tool
- **User**: Slash commands if `user-invocable: true`
- **Direct dispatch**: `command-dispatch: tool` bypasses model

### Lifecycle
- Discovered at startup, snapshotted per session
- Hot reload via watcher (`skills.load.watch: true`)
- Environment injection: `skills.entries.<key>.env` and `.apiKey` injected per run, restored after

---

## 7. Cron & Scheduled Jobs

### Schedule Types
| Type | Format | Example |
|------|--------|---------|
| `at` | ISO 8601 timestamp or duration | `--at "2026-03-17T08:00:00Z"`, `--at "20m"` |
| `every` | Duration string | `--every "2h"` |
| `cron` | 5/6-field cron expression | `--cron "0 */2 * * *"` |

### Session Targeting
- **`main`**: Enqueues systemEvent, processed at next heartbeat. **DEFAULT AGENT ONLY!**
- **`isolated`**: Runs agentTurn in separate `cron:<jobId>` session. Fresh each run.

### Payload Kinds
- `systemEvent`: For main session jobs. Injected as `System:` line in heartbeat prompt
- `agentTurn`: For isolated jobs. Full agent turn with own session

### wakeMode
- `now` (default): Triggers immediate heartbeat
- `next-heartbeat`: Waits for scheduled heartbeat

### Delivery Modes
- `announce`: Summary to chat channel (default for isolated jobs)
- `webhook`: HTTP POST to URL with `Authorization: Bearer <cron.webhookToken>`
- `none`: No delivery (internal only)

### Stagger
- Recurring top-of-hour crons staggered up to 5 min by default
- Override with `--stagger <duration>` or `--exact`

### Retry Policies
- **Transient errors** (rate limit, 5xx, timeout, network): Retry with exponential backoff (30s -> 1m -> 5m)
- **Permanent errors** (auth failure, validation): Disable immediately
- **Recurring jobs**: Backoff resets after next successful run
- **One-shot jobs**: Max 3 retries, then disable

### Storage
- Jobs: `~/.openclaw/cron/jobs.json`
- Run history: `~/.openclaw/cron/runs/<jobId>.jsonl`
- Run log limits: 2MB max, 2000 lines (configurable)
- Isolated cron sessions pruned after 24h (`cron.sessionRetention`)

### CLI
```bash
openclaw cron add --name "Name" --cron "0 */2 * * *" --message "Task" [--agent <id>] [--light-context] [--no-deliver]
openclaw cron list
openclaw cron edit <id> [options]
openclaw cron rm <id>
openclaw cron enable/disable <id>
openclaw cron runs [--job <id>]
openclaw cron run <id>  # manual trigger
```

---

## 8. Multi-Agent System

### Agent Configuration
```json5
{
  "agents": {
    "list": [
      {
        "id": "clawoss",
        "default": true,  // REQUIRED for main session routing
        "workspace": "/path/to/workspace",
        "model": { "primary": "provider/model" },
        "tools": { "profile": "coding" }
      }
    ]
  }
}
```

### Default Agent Resolution Order
1. Agent with `"default": true` (first match wins)
2. First agent in `agents.list`
3. Agent ID `"main"` (hardcoded fallback)

### Agent Bindings (routing)
Match priority (most specific wins):
1. `match.peer` (specific DM/group/channel)
2. `match.guildId` (Discord)
3. `match.teamId` (Slack)
4. `match.accountId` (exact)
5. `match.accountId: "*"` (channel-wide)
6. Default agent

### Workspace Isolation
- Each agent: own workspace, state dir (`agentDir`), session store
- Auth profiles per agent at `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- Agent-to-agent messaging disabled by default (`tools.agentToAgent`)

---

## 9. Sandbox System

### Modes
- `off`: No sandboxing
- `non-main`: Only non-main sessions sandboxed
- `all`: Every session sandboxed

### Scope
- `session`: Container per session
- `agent`: One container per agent
- `shared`: Single container for all

### Docker Configuration
| Setting | Default | Description |
|---------|---------|-------------|
| `image` | `openclaw-sandbox:bookworm-slim` | Docker image |
| `setupCommand` | none | Runs once after container creation |
| `network` | `"none"` | Network mode (none/bridge/custom) |
| `readOnlyRoot` | false | Read-only root filesystem |
| `user` | `"1000:1000"` | Container user:group |

### Workspace Access
- `none`: Sandbox-specific workspace under `~/.openclaw/sandboxes`
- `ro`: Agent workspace mounted read-only at `/agent`
- `rw`: Agent workspace mounted read-write at `/workspace`

### Blocked Bind Sources
`/var/run/docker.sock`, `/etc`, `/proc`, `/sys`, `/dev`

### Git in Sandbox (IMPORTANT)
- Default sandbox image does NOT include git
- Network default is `none` -- git clone/push/fetch will fail
- `GIT_EXEC_PATH` and `GIT_SSH_COMMAND` env vars blocked for security
- **For ClawOSS**: Use sandbox `off` or elevated exec for git operations

---

## 10. Memory System

### Storage
- `memory/YYYY-MM-DD.md`: Daily logs (append-only)
- `MEMORY.md`: Curated long-term memory (loaded only in main private session)
- All plain Markdown files in agent workspace

### Tools
- **`memory_search`**: Semantic search over indexed snippets. Hybrid vector + BM25. Index at `~/.openclaw/memory/<agentId>.sqlite`
- **`memory_get`**: Targeted file/line reading. Graceful degradation for missing files
- **No `memory_write` tool**: Agents use `write` tool to update memory files directly
- **Sub-agents DENIED** `memory_search` and `memory_get` by default

### Memory Flush
- Auto-triggered before compaction
- Silent agentic turn to persist important context to disk
- Configurable: `compaction.memoryFlush.enabled`, `softThresholdTokens`, prompts

---

## 11. Compaction & Context Management

### Compaction Modes
- `default`: Baseline behavior
- `safeguard`: Stricter guardrails, chunked summarization, optional quality audits

### Triggers
- **Overflow recovery**: Model returns context overflow error -> compact -> retry
- **Threshold maintenance**: After successful turn, if `contextTokens > contextWindow - reserveTokens`

### Key Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| `reserveTokens` | 20000 (floor) | Token headroom for reply + tools |
| `keepRecentTokens` | configurable | Recent tokens preserved during compaction |
| `maxHistoryShare` | 0.1-0.9 | Max fraction of context for history |

### Session Pruning (distinct from compaction)
- Trims old `toolResult` messages in-memory before LLM call
- Does NOT modify on-disk history
- Modes: `off`, `cache-ttl`
- Soft-trim: Keep beginning/end, insert ellipsis
- Hard-clear: Replace entire tool result with placeholder
- Primarily for Anthropic cache optimization

---

## 12. Bootstrap Files & System Prompt

### Bootstrap Files
| File | Purpose | When Loaded |
|------|---------|-------------|
| `AGENTS.md` | Operating instructions, rules | Every session start |
| `SOUL.md` | Persona, tone, boundaries | Every session start |
| `USER.md` | User profile and preferences | Every session start |
| `TOOLS.md` | Tool usage notes/conventions | Every session start |
| `IDENTITY.md` | Name, vibe, emoji | Created during bootstrap ritual |
| `BOOTSTRAP.md` | One-time first-run ritual | New workspaces only, delete after |
| `HEARTBEAT.md` | Heartbeat checklist | Heartbeat runs |
| `MEMORY.md` | Long-term memory | Main private session only |

### Character Limits
- Per file: `bootstrapMaxChars` (default 20,000)
- Total: `bootstrapTotalMaxChars` (default 150,000)
- Missing files get a "missing file" marker

### lightContext Behavior
| Context Mode | Run Kind | Bootstrap Files Included |
|-------------|----------|--------------------------|
| `full` (default) | any | All standard files |
| `lightweight` | heartbeat | Only HEARTBEAT.md |
| `lightweight` | cron/default | None (empty on purpose) |
| Sub-agent | any | Only AGENTS.md + TOOLS.md |

### System Prompt Components (in order)
1. Identity line
2. Tooling (available tools + descriptions)
3. Tool call style guidance
4. Safety guardrails
5. OpenClaw CLI quick reference
6. Self-update instructions
7. Skills (compact XML list with paths)
8. Documentation path
9. Workspace (CWD)
10. Sandbox info (if enabled)
11. User identity
12. Current date & time
13. Workspace files (bootstrap files injected here)
14. Reply tags (provider-specific)
15. Messaging details
16. Voice/TTS hint
17. Heartbeat prompt and HEARTBEAT_OK behavior
18. Runtime metadata
19. Reasoning visibility
20. Reactions guidance

### Prompt Modes
- `full` (default): All sections
- `minimal` (sub-agents/cron): Omits Skills, Memory Recall, Heartbeats, User Identity, Reply Tags
- `none`: Only basic identity line

---

## 13. Tool System & Policies

### Tool Pipeline
1. **Base Tools**: Pi's `codingTools` (read, bash, edit, write)
2. **Custom Replacements**: bash -> exec/process, read/edit/write customized for sandbox
3. **OpenClaw Tools**: messaging, browser, canvas, sessions, cron, gateway
4. **Channel Tools**: Discord, Telegram, Slack, WhatsApp specific
5. **Policy Filtering**: profiles, providers, agents, groups, sandbox
6. **Schema Normalization**: Cleaned for Gemini/OpenAI compatibility
7. **AbortSignal Wrapping**: Graceful termination support

### Tool Profiles
| Profile | Tools Included |
|---------|---------------|
| `minimal` | `session_status` only |
| `coding` | `group:fs`, `group:runtime`, `group:sessions`, `group:memory`, `image` |
| `messaging` | `group:messaging`, `sessions_list`, `sessions_history`, `sessions_send`, `session_status` |
| `full` | No restrictions |

### Tool Groups
- `group:runtime`: `exec`, `bash`, `process`
- `group:fs`: `read`, `write`, `edit`, `apply_patch`
- `group:sessions`: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `subagents`
- `group:memory`: `memory_search`, `memory_get`
- `group:messaging`: messaging tools
- `group:web`: `web_fetch`, `web_search`

### Filtering Hierarchy (each level can only restrict further)
1. Tool profiles (base allowlist)
2. Provider tool profiles
3. Global `tools.allow` / `tools.deny`
4. Provider tool policy
5. Agent `agents.list[].tools.allow` / `deny`
6. Agent provider policy
7. Sandbox `tools.sandbox.tools.allow` / `deny`
8. Subagent `tools.subagents.tools`

`deny` ALWAYS takes precedence over `allow`.

---

## 14. Exec & Process Tools

### Exec Tool
- Primary shell command tool (replaces `bash`)
- Parameters: `command`, `timeout` (default 1800s), `workdir`, `env`, `background`, `yieldMs`, `pty`, `host`, `security`
- Shell: Prefers bash/sh over fish. Windows uses pwsh
- Environment: Injects `OPENCLAW_SHELL=exec`
- Security: Blocks `GIT_EXEC_PATH`, `GIT_SSH_COMMAND` env vars
- PATH: For gateway host, `env.PATH` overrides rejected (prevent binary hijacking)

### Process Tool
- Manages background exec sessions
- Actions: `list`, `poll`, `log`, `write`, `kill`, `clear`, `remove`
- Sessions not persistent across process restarts
- Scoped per agent

---

## 15. Heartbeat System

### Configuration (`agents.defaults.heartbeat` or `agents.list[].heartbeat`)
| Field | Default | Description |
|-------|---------|-------------|
| `every` | `"30m"` (API key) / `"1h"` (OAuth) | Interval. `"0m"` disables |
| `activeHours` | none | `{start, end, timezone}` restriction |
| `model` | session primary | Model override |
| `session` | `"main"` | Session key |
| `target` | `"none"` | Delivery target (`"last"`, `"none"`, channelId) |
| `directPolicy` | `"allow"` | DM delivery (`"allow"`, `"block"`) |
| `to` | none | Channel-specific recipient |
| `accountId` | none | Multi-account channel ID |
| `prompt` | (default reads HEARTBEAT.md) | Prompt override |
| `ackMaxChars` | 300 | Max chars after HEARTBEAT_OK before delivery |
| `suppressToolErrorWarnings` | false | Suppress tool error payloads |
| `lightContext` | false | Only load HEARTBEAT.md |
| `includeReasoning` | false | Deliver model reasoning |

### Lifecycle
1. **Trigger**: Scheduled interval or manual `system event --mode now`
2. **Pre-flight**: Check enabled, activeHours, queue not busy, HEARTBEAT.md not empty
3. **Prompt**: Construct from HEARTBEAT.md + pending system events
4. **Agent turn**: Full turn in main session
5. **Response**: If `HEARTBEAT_OK` (within ackMaxChars) -> suppress. Otherwise -> deliver
6. **Session update**: Restore `updatedAt` if suppressed (don't keep session alive artificially)

### Overlap Handling (IMPORTANT)
- If agent already running: heartbeat SKIPPED with reason `"requests-in-flight"`
- Schedule NOT advanced -- retried ~1 second later by wake layer
- System events queued and injected as `System:` lines in next heartbeat

### HEARTBEAT.md Best Practices
- Keep tiny and focused (avoid prompt bloat)
- Batch multiple checks in one turn
- Agent can update it dynamically
- Don't put secrets in it (becomes part of prompt)
- Reply `HEARTBEAT_OK` if nothing needs attention

---

## 16. System Events & Self-Wake

### Command
```bash
openclaw system event --text "message" --mode now|next-heartbeat
```

### Behavior
- `--mode now`: Enqueues event + triggers immediate heartbeat
- `--mode next-heartbeat`: Enqueues event, waits for scheduled heartbeat (default)
- Events injected as `System:` lines in heartbeat prompt
- Events are TEMPORARY -- do not persist across gateway restart

### Self-Wake Loop
- Agent CAN trigger its own system event via exec tool
- Creates continuous autonomous loop:
  ```
  Heartbeat -> Work -> Commit -> exec: openclaw system event --text "done" --mode now -> Immediate heartbeat -> ...
  ```
- Safe: overlapping heartbeats are skipped and retried ~1s later

---

## 17. Model Configuration

### Resolution Order
1. Primary model (`agents.defaults.model.primary`)
2. Fallbacks (`agents.defaults.model.fallbacks`)
3. Provider auth failover within current provider

### Special Models
- `imageModel`: For image-capable tasks
- `pdfModel`: For PDF processing
- `cliBackends`: Text-only fallback runs

### Aliases
- Built-in: `opus` -> `anthropic/claude-opus-4-6`, `gpt` -> `openai/gpt-5.4`
- Custom: `agents.defaults.models.<modelId>.alias`

### Thinking Modes
- Values: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `adaptive`
- Per-model: `agents.defaults.models["provider/model"].params.thinking`
- Per-message: `/think:<level>`

---

## 18. Authentication & Access Control

### API Key Priority
1. `OPENCLAW_LIVE_<PROVIDER>_KEY`
2. `<PROVIDER>_API_KEYS`
3. `<PROVIDER>_API_KEY`
4. `<PROVIDER>_API_KEY_*`

### Auth Profiles
- Named credential records (OAuth or API key) per provider
- Stored per agent: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- Rotation with cooldown (exponential backoff on failures)
- `auth.order`: Explicit rotation order

### Gateway Auth
- Token mode: `gateway.auth.token` or `OPENCLAW_GATEWAY_TOKEN`
- Password mode: alternative
- Non-loopback binds always require auth

### DM Pairing
- Default: First DM sends pairing code
- Approve: `openclaw pairing approve <channel> <code>`
- Allowlists: `~/.openclaw/credentials/<channel>-allowFrom.json`

---

## 19. Hooks & Plugin SDK

### Internal Hooks (Gateway)
- Event-driven scripts for commands and lifecycle events
- Examples: `agent:bootstrap`, `/new`, `/reset`, `/stop`

### Plugin Hooks
| Hook | When | Can Do |
|------|------|--------|
| `before_model_resolve` | Pre-session | Override provider/model |
| `before_prompt_build` | After session load | Inject/override system prompt |
| `before_tool_call` / `after_tool_call` | Tool execution | Intercept params/results |
| `tool_result_persist` | Before transcript write | Transform tool results |
| `agent_end` | After completion | Inspect final state |
| `before_compaction` / `after_compaction` | Compaction cycle | Observe/annotate |
| `message_received/sending/sent` | Message lifecycle | Intercept messages |
| `session_start/end` | Session lifecycle | Session boundaries |
| `gateway_start/stop` | Gateway lifecycle | Gateway events |

### Plugin Registration
```typescript
export default function register(api) {
  api.on("before_prompt_build", (event, ctx) => {
    return { prependSystemContext: "Custom instruction." };
  }, { priority: 10 });
}
```

### Plugin Capabilities
- `registerTool`, `registerHook`, `registerChannel`, `registerProvider`
- `registerHttpRoute`, `registerCommand`, `registerCli`
- `registerService`, `registerContextEngine`

---

## 20. Channels & Integrations

| Channel | SDK/Library | Auth | Key Config |
|---------|------------|------|------------|
| WhatsApp | Baileys (WhatsApp Web) | QR pairing | `dmPolicy`, `groupPolicy`, `allowFrom` |
| Telegram | grammY (Bot API) | Bot token | `channels.telegram.allowFrom` (numeric ID) |
| Discord | Discord Bot API | Bot token | `channels.discord.dm.policy` |
| iMessage | BlueBubbles (recommended) | REST API | macOS server required |
| Slack | Bolt SDK | `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN` | Workspace apps |

### Message Flow
1. Inbound from chat app
2. Routing via bindings
3. Queue if agent busy
4. Agent run (model inference + tools)
5. Outbound reply (channel-formatted)

### Reply Formatting Pipeline
1. Parse Markdown -> IR (intermediate representation)
2. Chunk IR (safe splitting)
3. Render per channel (Slack mrkdwn, Telegram HTML, etc.)

---

## 21. Control UI & Native Clients

### Control UI
- Browser dashboard at `http://127.0.0.1:18789/`
- Features: Chat, config editor, session management, node pairing, exec approvals
- Access: `openclaw dashboard` or direct URL
- Auth: Gateway token

### Native Clients (Nodes)
| Platform | Features | Connection |
|----------|----------|------------|
| macOS | Canvas, camera, screen, system tools | Menu-bar app, local or remote (SSH) |
| iOS | Canvas, screen, camera, location, voice | WebSocket to gateway |
| Android | Chat, canvas, camera, notifications, contacts | WebSocket (internal preview) |

- Discovery: Bonjour/mDNS (LAN), Tailnet (cross-network), manual
- Pairing required: `openclaw devices approve <requestId>`
- Tool invocation: `node.invoke` RPC commands

---

## 22. Configuration Reference

### Top-Level Sections
`meta`, `auth`, `env`, `wizard`, `diagnostics`, `logging`, `cli`, `update`, `browser`, `ui`, `secrets`, `skills`, `plugins`, `models`, `nodeHost`, `agents`, `gateway`, `tools`, `messages`, `session`, `cron`, `commands`

### agents.defaults Key Fields
| Field | Description |
|-------|-------------|
| `model` | Primary + fallbacks |
| `imageModel` / `pdfModel` | Special-purpose models |
| `workspace` | Agent working directory |
| `heartbeat` | Periodic background runs |
| `humanDelay` | Block reply delay (`off`/`natural`/`custom`) |
| `sandbox` | Docker isolation |
| `compaction` | Context management |
| `subagents` | Sub-agent config |
| `contextPruning` | Tool result trimming |
| `thinkingDefault` | Default thinking level |
| `blockStreamingDefault` | Block streaming |
| `bootstrapMaxChars` | Per-file bootstrap limit (20000) |
| `bootstrapTotalMaxChars` | Total bootstrap limit (150000) |
| `timeoutSeconds` | Agent operation timeout |
| `maxConcurrent` | Max concurrent runs |
| `memorySearch` | Vector memory config |

### Config Validation
- Strict schema validation via Zod
- Unknown keys = validation error
- Invalid config prevents gateway start
- Fix with `openclaw doctor --fix`

### Hot Reload
- `gateway.reload.mode`:
  - `hybrid` (default): Hot-apply safe changes, auto-restart for critical
  - `hot`: Hot-apply only, log warning for restart-needed
  - `restart`: Restart for any change
  - `off`: Manual restart only
- Most fields hot-reloadable; `gateway.*` changes require restart

---

## 23. CLI Commands

### Key Commands
```bash
# Gateway
openclaw gateway [run]        # Start gateway
openclaw gateway install      # Install as service
openclaw gateway start/stop   # Manage service
openclaw gateway health       # Health check
openclaw gateway status       # Status summary

# Agent
openclaw agent --message "..." [--agent <id>] [--local]

# Cron
openclaw cron add/list/edit/rm/enable/disable/runs/run

# System
openclaw system event --text "..." --mode now|next-heartbeat
openclaw system heartbeat last|enable|disable

# Config
openclaw config get/set/unset/validate/file

# Models
openclaw models list/status/set/scan/auth

# Sessions
openclaw sessions list/cleanup

# Sandbox
openclaw sandbox explain/list/recreate

# Setup
openclaw onboard / configure / setup / doctor
```

---

## 24. Webhooks & Delivery

### Ingress Webhooks
| Endpoint | Action | Auth |
|----------|--------|------|
| `POST /hooks/wake` | Enqueue system event for main session | `hooks.token` |
| `POST /hooks/agent` | Run isolated agent turn | `hooks.token` |
| `POST /hooks/<name>` | Custom mapped hook | `hooks.token` |

### Wake Request Format
```json
{ "text": "System line", "mode": "now" }
```

### Agent Request Format
```json
{
  "message": "Run this",
  "name": "Hook Name",
  "agentId": "clawoss",
  "wakeMode": "now",
  "deliver": true,
  "model": "provider/model",
  "timeoutSeconds": 120
}
```

### Auth Methods
- `Authorization: Bearer <token>` (recommended)
- `x-openclaw-token: <token>`
- Query string tokens REJECTED

---

## 25. Prompt Caching

### Anthropic Caching
- `cacheRetention: "short"` (5 min TTL, default for API key)
- `cacheRetention: "long"` (1 hour TTL, requires beta flag)
- `cacheRetention: "none"` (disabled)

### OpenRouter
- `openrouter/anthropic/*` models: Anthropic `cache_control` injected into system/developer prompt blocks

### Context Pruning for Cache Optimization
- Mode `cache-ttl`: Trims old tool results when cache TTL expired
- Reduces `cacheWrite` size on first request after TTL
- Only affects `toolResult` messages (user/assistant untouched)

### Heartbeat + Cache Interaction
- Setting heartbeat interval just under cache TTL keeps cache warm
- Example: 1-hour cache -> 55-min heartbeat interval
- Self-wake loop naturally keeps sessions active for cache hits

---

## 26. Error Handling & Retries

### Error Types
| Error | Action |
|-------|--------|
| Rate limit / 429 | Auth profile rotation + cooldown |
| Timeout | Cooldown + failover |
| 5xx / server error | Retry with backoff |
| Auth failure | Disable profile |
| Context overflow | Auto-compaction + retry |
| `FailoverError` | Model fallback |

### Failover Process
1. Rotate auth profiles within current provider (with cooldown)
2. If all profiles exhausted -> fall back to next model in `model.fallbacks`
3. Cooldowns use exponential backoff

---

## 27. Session Maintenance

### Configuration (`session.maintenance`)
| Setting | Default | Description |
|---------|---------|-------------|
| `mode` | `warn` | `warn` (report only) or `enforce` (apply) |
| `pruneAfter` | `"30d"` | Age cutoff for stale entries |
| `maxEntries` | 500 | Max entries in sessions.json |
| `rotateBytes` | `"10mb"` | Rotate sessions.json at this size |
| `maxDiskBytes` | none | Optional disk budget |
| `resetArchiveRetention` | = pruneAfter | Cleanup old archives |

### Maintenance Actions (in order)
1. Prune stale entries (older than `pruneAfter`)
2. Cap entry count (oldest first)
3. Archive removed transcripts
4. Clean up old archives
5. Rotate oversized session files
6. Enforce disk budget (if configured)

---

## 28. Environment Variables

### Core
| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCLAW_HOME` | `$HOME` | Override home directory |
| `OPENCLAW_STATE_DIR` | `~/.openclaw` | State directory |
| `OPENCLAW_CONFIG_PATH` | `~/.openclaw/openclaw.json` | Config file path |
| `OPENCLAW_PROFILE` | none | Named profile (affects service names) |
| `OPENCLAW_GATEWAY_TOKEN` | none | Gateway auth token |
| `OPENCLAW_GATEWAY_PORT` | 18789 | Gateway port |
| `OPENCLAW_SHELL` | (injected) | Runtime context marker |
| `OPENCLAW_LOG_LEVEL` | from config | Override log level |
| `OPENCLAW_THEME` | auto | TUI palette (light/dark) |

---

## 29. ACP (Agent Client Protocol)

- Bridge for external IDEs (Zed, etc.) to interact with gateway sessions
- Session key: `agent:<agentId>:acp:<uuid>`
- Spawned via `sessions_spawn` with `runtime: "acp"`
- CLI: `openclaw acp [--url <ws>] [--token <token>] [--session <key>]`
- Permission modes: `approve-all`, `approve-reads`, `deny-all`
- Not a full ACP-native runtime; focuses on session routing and prompt delivery

---

## 30. Gateway Health & Monitoring

### HTTP Endpoints (no auth required)
- `/healthz`: Shallow liveness probe (process running?)
- `/readyz`: Readiness probe (503 if channels disconnected)

### Detailed Health
- `openclaw health --json`: Full health snapshot via WebSocket RPC
- Includes: channel status, heartbeat interval, agents, sessions, recent activity

### Health Snapshot Fields
- `ok`: Overall health boolean
- `ts`: Timestamp
- `durationMs`: Snapshot generation time
- `channels`: Per-channel health (linked, auth age, probe results)
- `defaultAgentId`: Default agent
- `sessions`: Count, path, recent activity

---

## Sources

All information sourced from [DeepWiki: openclaw/openclaw](https://deepwiki.com/openclaw/openclaw)
