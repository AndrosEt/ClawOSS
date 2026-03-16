# OpenClaw Advanced Features We're Not Using

Research date: 2026-03-16. Source: DeepWiki MCP on openclaw/openclaw.

---

## High-Value Features We Should Adopt

### 1. Pre-Compaction Memory Flush
**What:** Run an explicit memory storage turn before compaction with custom prompts.
**Why it matters:** Our agent loses context during compaction. A memory flush beforehand would preserve critical state (current task, PR status, issue details) in a structured way before the summarization happens.
**Config:** Custom system prompts for the flush, size heuristics, retry logic.
**Priority: HIGH**

### 2. Compaction Quality Guards
**What:** Enable quality audits and automated retries on failed compaction summary checks.
**Why it matters:** Bad compactions have caused our agent to lose track of what it was doing. Quality guards would catch and retry poor summarizations.
**Config:** Quality audit flags, retry logic configuration.
**Priority: HIGH**

### 3. Tool Loop Detection
**What:** Runtime detection of repetitive tool patterns.
**Why it matters:** Our agent sometimes gets stuck in loops (e.g., repeatedly trying the same failing approach). This would auto-detect and break those cycles.
**Config:** `tools.loopDetection` settings.
**Priority: HIGH**

### 4. Compaction Identifier Preservation
**What:** `identifierPolicy` with strictness levels and custom instructions.
**Why it matters:** During compaction, file paths, branch names, issue numbers, and PR URLs can get lost or garbled. Strict identifier preservation would keep these intact.
**Priority: MEDIUM-HIGH**

### 5. Plugin Hooks: before_tool_call / after_tool_call
**What:** Intercept tool calls before and after execution.
**Why it matters:** Could log all `gh` CLI calls, detect errors before they propagate, add retry logic for transient GitHub API failures.
**Priority: MEDIUM**

### 6. Compaction-Only Model Override
**What:** Use a different LLM model specifically for compaction summarization.
**Why it matters:** We could use a cheaper/faster model for compaction while keeping Kimi Code for main reasoning, or use a model that's better at summarization.
**Priority: MEDIUM**

### 7. Session History Pruning
**What:** Token-based and policy-based trimming with selective tool-result pruning using allow/deny lists.
**Why it matters:** We could prune verbose tool outputs (like full `git diff` results) while keeping important ones (like test results), extending effective context.
**Config:** Keep/deny/allow tool lists, ratio-based pruning.
**Priority: MEDIUM**

### 8. Webhook System
**What:** Custom webhook endpoints mapping payloads to agents/sessions.
**Why it matters:** Could enable GitHub webhook integration — get notified of PR reviews, issue comments, CI results directly instead of polling.
**Priority: MEDIUM (future)**

### 9. $include for Configs
**What:** Modular config organization using `$include` directives.
**Why it matters:** Our openclaw.json is getting large. Could split heartbeat prompt, skills config, and tool settings into separate files.
**Priority: LOW-MEDIUM**

### 10. Compaction Reinjection
**What:** Inject specific AGENTS.md sections after compaction.
**Why it matters:** Could ensure critical rules (like "never force push", "always run tests") survive compaction even if the summary loses them.
**Priority: MEDIUM**

---

## Features We're Already Using Well
- Heartbeat with activeHours
- lightContext toggle (currently disabled — loads all bootstrap)
- Sub-agent spawning with session management
- Event system for wakeups

## Features Not Applicable
- **Apply Patch Tool** — OpenAI provider only, we use Kimi Code
- **Agent-to-Agent Tools** — we use sub-agents, not peer agents
- **Nested Subagent Orchestration (maxSpawnDepth: 2)** — adds complexity, not needed yet

---

## Recommended Implementation Order

1. **Pre-Compaction Memory Flush** — biggest bang for context preservation
2. **Tool Loop Detection** — prevents wasted cycles
3. **Compaction Quality Guards** — catches bad summaries
4. **Identifier Preservation** — keeps file paths/URLs intact through compaction
5. **Session History Pruning** — extends effective context window
6. **Compaction Reinjection** — ensures critical rules survive
7. **Plugin Hooks** — better error handling for gh CLI
8. **$include for Configs** — cleanliness improvement
