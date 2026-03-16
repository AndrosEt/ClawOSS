# Broad Research Findings — researcher-2
**Last updated**: 2026-03-16

## Table of Contents
1. [OpenClaw Advanced Features We're Not Using](#1-openclaw-advanced-features-were-not-using)
2. [Codex Architecture Insights](#2-codex-architecture-insights)
3. [GitHub AI PR Crisis & Policy Changes](#3-github-ai-pr-crisis--policy-changes)
4. [Multi-Agent Failure Patterns (MAST)](#4-multi-agent-failure-patterns-mast)
5. [Anthropic Multi-Agent Architecture Lessons](#5-anthropic-multi-agent-architecture-lessons)
6. [SWE-bench State of the Art](#6-swe-bench-state-of-the-art)
7. [PR Merge Rate Improvement Strategies](#7-pr-merge-rate-improvement-strategies)
8. [Competitor Agent Architectures](#8-competitor-agent-architectures)
9. [Actionable Recommendations for ClawOSS](#9-actionable-recommendations-for-clawoss)

---

## 1. OpenClaw Advanced Features We're Not Using

### Memory System (memory_search / memory_get)
OpenClaw has a full **semantic memory system** with hybrid vector+BM25 search. Tools:
- `memory_search`: Semantic search over agent memory files using embeddings
- `memory_get`: Read specific lines from memory files after search
- Supports OpenAI, Gemini, Voyage, Mistral, Ollama embeddings
- Can index extra sources via `memorySearch.extraPaths`

**Why this matters**: Our agent could use semantic memory to recall which repos were successful, which approaches worked, and avoid repeating mistakes. Currently we rely on flat markdown files.

### Session-Memory Hook
- Auto-saves last N messages (default 15) as markdown on `/new` or `/reset`
- Creates dated memory files with LLM-generated filenames
- **Pre-compaction memory flush**: Silent turn prompts agent to write down anything important before compaction discards tokens

**Action**: Enable `session-memory` hook for our agent. It will auto-persist context across compactions.

### Cron System (Advanced Scheduling)
Beyond heartbeats, OpenClaw has a full cron scheduler:
- `at`: One-shot reminders at specific timestamps
- `every`: Fixed interval in milliseconds
- `cron`: 5/6-field cron expressions with timezone support
- **Isolated sessions**: Cron jobs can run in separate sessions (won't clutter main chat)
- **Delivery modes**: announce (posts summary), webhook (POST to URL), none
- Persists across restarts at `~/.openclaw/cron/jobs.json`

**Action**: Use cron jobs for:
- Scheduled PR follow-up checks (every 4 hours)
- Daily repo health checks
- Stale PR cleanup

### Plugin Hooks We Should Enable
- `bootstrap-extra-files`: Inject extra context files into agent sessions
- `command-logger`: Audit trail of all commands
- `boot-md`: Execute BOOT.md on gateway startup for initialization

### Advanced Compaction Config
- `reserveTokensFloor` (default 20000): Safety buffer before compaction
- Separate summarization model: Use cheaper model for compaction
- `identifierPolicy`: Controls how identifiers are handled during compaction
- `bootstrapMaxChars`/`bootstrapTotalMaxChars`: Control bootstrap size

### Tool Groups
OpenClaw has tool group shorthands: `group:fs`, `group:runtime`, `group:web`, `group:sessions`, `group:memory`. We should verify our agent has optimal tool groups enabled.

---

## 2. Codex Architecture Insights

### Key Patterns Worth Adopting

**AGENTS.md Convention**: Codex uses repo-level AGENTS.md files that take precedence over system instructions. Scoped to directory trees. More deeply nested files win in conflicts.
- **Idea for ClawOSS**: Before implementing a fix, check if target repo has AGENTS.md and follow its conventions.

**Progressive Test Strategy**: Run targeted tests first (specific module), expand to full suite only after those pass. Avoids wasting time on full test runs for trivial changes.

**Approval-Mode Aware Validation**: In autonomous mode, proactively run tests and lint. In interactive mode, defer until confirmed. We should always be in "autonomous" mode.

**File Size Limits**: Module files target under 500 LoC (excluding tests). This is a good heuristic for our PR size management.

**Sandboxing**: Codex uses OS-level sandboxing (Seatbelt on macOS, bubblewrap on Linux) with fine-grained filesystem policies. Our agent runs less sandboxed — something to consider for safety.

**apply_patch Tool**: Codex prefers structured patches over raw file writes. More reliable for multi-file changes.

### MCP Integration
Codex functions as BOTH MCP client and server — bidirectional tool delegation. Could ClawOSS expose itself as an MCP server for monitoring/control?

---

## 3. GitHub AI PR Crisis & Policy Changes

### CRITICAL: The Landscape Has Changed Dramatically

**February 2026 Events**:
- GitHub product manager Camilla Moraes opened community discussion on low-quality AI contributions
- **Feb 14, 2026: GitHub shipped two new settings**: disable PRs entirely, or restrict to collaborators only
- Mitchell Hashimoto's Ghostty: zero-tolerance policy, permanent bans for bad AI code
- Steve Ruiz's tldraw: auto-closes ALL external PRs
- curl: shut down 6-year bug bounty after 20 invalid AI security reports in 21 days
- Gentoo Linux migrating from GitHub to Codeberg
- NetBSD, QEMU: outright AI coding bans

**Key Statistics**:
- AI PRs have **32.7% acceptance rate** vs 84.4% for human PRs
- AI PRs wait **4.6x longer** for review pickup
- Only **1 in 10** AI PRs "meets standards required to open that PR"
- AI-generated code contains **1.7x more issues** than human code
- Security vulnerabilities **1.57x more frequent** in AI code
- Logic errors **1.75x more frequent**

**GitHub's Official Position**: "We don't think counting AI-generated PRs is the right metric" — quality matters regardless of source.

### What This Means for ClawOSS

**EXISTENTIAL RISK**: If repos enable "restrict PRs to collaborators only", ClawOSS can't contribute at all. We MUST:
1. Target repos that haven't restricted PRs
2. Make our PRs indistinguishable from expert human work
3. Build trust through consistent quality, not volume
4. Never submit AI slop — every PR must be genuinely valuable
5. Monitor the policy landscape at oss-ai-policies.netlify.app
6. Consider becoming a "trusted contributor" at key repos before mass-contributing

---

## 4. Multi-Agent Failure Patterns (MAST)

### UC Berkeley Study (March 2025)
Analyzed 1,642 execution traces across 7 MAS frameworks:

**Failure rates**: 41% to 86.7% across frameworks

**14 failure modes in 3 categories**:
1. **System design issues** — poor architecture
2. **Inter-agent misalignment** (36.9% of all failures) — coordination breakdowns
3. **Task verification** — not checking outputs

**Key Finding**: "The prompting fallacy" — belief that prompt tweaks alone fix systemic coordination failures. If agents consistently underperform, the issue is architecture, not prompts.

**Prevention Patterns**:
- Hierarchical structures with supervisor agents reduce direct agent-to-agent communication
- Sequential pipelines eliminate parallel coordination overhead
- Feedback loops with "reviewer" agents checking output significantly reduce hallucinations
- Weak role definitions amplify failures in multi-agent contexts
- Upstream specification flaws cascade through the system

### Relevance to ClawOSS
Our orchestrator->subagent architecture is hierarchical (good), but we should add:
- A reviewer step before PR submission
- Clearer role boundaries for sub-agents
- Better error detection at each stage

---

## 5. Anthropic Multi-Agent Architecture Lessons

### From "How We Built Our Multi-Agent Research System"

**Task Decomposition is Everything**:
- Vague instructions cause duplication — subagents do overlapping work
- Each subagent needs: objective, output format, tool guidance, task limits
- Effort scaling: simple=1 agent/3-10 tool calls, complex=10+ agents

**Quality Control**:
- LLM-as-Judge evaluation: 5 criteria scored 0.0-1.0 + pass-fail
- Human testing caught edge cases automation missed
- Agents chose "SEO-optimized content farms over authoritative sources"
- Small test sets (20 queries) revealed prompt tweaks boosting success 30%->80%

**Performance**:
- Parallel subagents reduced research time by up to 90%
- Agents use ~4x more tokens than chat; multi-agent ~15x more
- Token usage explains 80% of performance variance
- Upgrading model quality > doubling token budget

**Production Reliability**:
- Stateful resume from error points, not full restarts
- Rainbow deployments for gradual traffic shifts
- Full tracing for diagnosing failures
- Memory persistence when context windows approach limits
- Compound errors: "minor issues for traditional software can derail agents entirely"

**Tool Design**: Poor tool descriptions send "agents down completely wrong paths". A tool-testing agent rewrote descriptions achieving 40% decrease in task completion time.

---

## 6. SWE-bench State of the Art

### Current Performance (2025-2026)
- **SWE-bench Verified**: Claude 4.5 Opus achieves 74.4% resolved rate
- **SWE-bench Pro** (enterprise complexity): best agents below 45% (Claude Sonnet 4.5 + Live-SWE-agent at 45.8%)
- **SWE-EVO** (long-horizon): GPT-5 + OpenHands only 21% (vs 65% on single-issue)
- **FeatureBench** (complex features): Claude 4.5 Opus only 11%

### Live-SWE-agent (Self-Evolving)
Breakthrough architecture: starts with basic bash tools, autonomously creates new tools at runtime while solving issues.
- Step reflection mechanism: explicitly considers tool creation as a first-class decision
- Claude Opus 4.5 + Live-SWE-agent: 79.2% on SWE-bench Verified
- Removes need for precomputed tool catalogs

**Insight for ClawOSS**: Our agent should be able to create custom tools/scripts during implementation, not just use predefined ones.

### Open SWE (LangChain)
Multi-agent architecture: Manager -> Planner -> Programmer -> Reviewer
- Planner researches codebase to form strategy FIRST
- Reviewer checks for errors, runs tests, reflects BEFORE opening PR
- Cloud-native: runs in isolated Daytona sandboxes
- Async: handles multiple tasks in parallel

**Insight for ClawOSS**: The Planner->Programmer->Reviewer pipeline is exactly what we should replicate.

---

## 7. PR Merge Rate Improvement Strategies

### Tactical Improvements

1. **Small, atomic PRs**: 50-line PRs merge 40% faster (from our prior research). Stacked PR workflows drop median merge time from 24h to 90min.

2. **Test coverage proof**: Cloud agents that self-test and include proof of working tests get dramatically higher merge rates. Every PR should include test results.

3. **Shift-left validation**: Run checks in pre-commit, not just PR review. Lint + test BEFORE opening PR.

4. **Repo-specific conventions**: Encode institutional knowledge in skills. Check for AGENTS.md, CONTRIBUTING.md, .github/PULL_REQUEST_TEMPLATE.md before contributing.

5. **67% merge rate** achieved on "well-defined tasks like migrations, framework upgrades, and tech debt cleanup" — but 85% FAIL on complex/ambiguous tasks without human intervention.

6. **Post-merge monitoring**: AI code should be monitored 30-90 days after merge. We should track whether our merged PRs cause regressions.

### What Makes Maintainers Accept PRs
- Follows CONTRIBUTING.md exactly
- Includes tests for the fix
- Small, focused diff (25-100 lines)
- Clear problem description with reproduction steps
- Matches existing code style perfectly
- Doesn't introduce new dependencies
- Has CI passing before review
- References a real, open issue

---

## 8. Competitor Agent Architectures

### Key Agents in the Space

| Agent | Architecture | Key Innovation |
|-------|-------------|----------------|
| SWE-agent | RunOrchestrator + SWEEnv | Custom file editor with lint feedback |
| Live-SWE-agent | Self-evolving scaffold | Creates tools at runtime |
| Open SWE | Manager->Planner->Programmer->Reviewer | Async cloud-native, dedicated reviewer |
| Codex CLI | Queue-based message passing | OS-level sandboxing, MCP bidirectional |
| Cursor Cloud | Multi-agent parallel | Video demo artifacts as proof |

### Common Patterns Across Winners
1. **Codebase indexing before coding** — all top agents deeply understand the repo first
2. **Progressive testing** — targeted tests first, then broad suite
3. **Reviewer step** — separate review agent before submission
4. **Sandboxed execution** — isolated environments for safety
5. **Error recovery loops** — iterate on failures rather than give up
6. **Structured patches** — prefer structured edits over raw writes

---

## 9. Actionable Recommendations for ClawOSS

### CRITICAL (Do Immediately)

1. **Add Pre-Submission Review Step**: Implement a reviewer sub-agent that checks every PR before submission. Check for: logic errors, style mismatches, test coverage, proper issue references, diff size.

2. **Monitor Repo AI Policies**: Before targeting a repo, check if it has disabled external PRs or has anti-AI policies. Check oss-ai-policies.netlify.app. Add this to the discovery skill.

3. **Enable OpenClaw memory_search**: Enable semantic memory so the agent can recall past successes/failures and adapt.

4. **Enable session-memory hook**: Auto-persist context across compactions.

### HIGH PRIORITY

5. **Implement Planner->Programmer->Reviewer Pipeline**: Based on Open SWE's architecture, split implementation into planning (understand repo), coding (implement fix), and reviewing (verify quality) phases.

6. **Pre-Commit Validation**: Run repo's lint + test suite BEFORE opening the PR. Only open PR if CI-equivalent checks pass locally.

7. **Check for AGENTS.md / CONTRIBUTING.md**: Before implementing, read and follow repo-specific conventions.

8. **Use Cron for PR Follow-ups**: Schedule cron jobs to check PR status every 4 hours instead of relying on heartbeat.

### MEDIUM PRIORITY

9. **Progressive Test Strategy**: Run targeted module tests first, expand only after pass.

10. **Tool Quality Audit**: Review all our skill prompts for ambiguity. Anthropic found that fixing tool descriptions achieved 40% faster task completion.

11. **Track Post-Merge Health**: Monitor merged PRs for 30 days. If any cause regressions, learn from it.

12. **Trust-Building Strategy**: Instead of spray-and-pray across 60+ repos, focus on 10-15 repos where we can build reputation as a trusted contributor.

### LONGER TERM

13. **Self-Evolving Tools**: Inspired by Live-SWE-agent, allow the agent to create custom scripts during implementation.

14. **MCP Server Mode**: Expose ClawOSS status/metrics as an MCP server for monitoring tools.

15. **Rainbow Deployments**: Gradually shift between prompt versions to avoid disrupting running agents.

---

## Sources

### DeepWiki
- openclaw/openclaw: Advanced features, plugins, hooks, sessions, memory, cron
- openai/codex: Architecture, sandboxing, AGENTS.md, testing

### Web Sources
- [SWE-agent GitHub](https://github.com/SWE-agent/SWE-agent)
- [SWE-bench Pro (arXiv)](https://arxiv.org/html/2509.16941)
- [Live-SWE-agent Leaderboard](https://live-swe-agent.github.io/)
- [Live-SWE-agent (arXiv)](https://arxiv.org/abs/2511.13646)
- [Open SWE by LangChain](https://github.com/langchain-ai/open-swe)
- [GitHub AI slop kill switch (The Register)](https://www.theregister.com/2026/02/03/github_kill_switch_pull_requests_ai/)
- [GitHub policy changes (OSFY)](https://www.opensourceforu.com/2026/02/github-weighs-pull-request-kill-switch-as-ai-slop-floods-open-source/)
- [AI destroying open source (Jeff Geerling)](https://www.jeffgeerling.com/blog/2026/ai-is-destroying-open-source/)
- [Projects banning AI PRs (Dev Genius)](https://blog.devgenius.io/open-source-projects-are-now-banning-ai-generated-pull-requests-8e1dd3e8d41c)
- [AI Slopageddon (RedMonk)](https://redmonk.com/kholterhoff/2026/02/03/ai-slopageddon-and-the-oss-maintainers/)
- [Anthropic multi-agent system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [MAST failure taxonomy (arXiv)](https://arxiv.org/abs/2503.13657)
- [MAST GitHub](https://github.com/multi-agent-systems-failure-taxonomy/MAST)
- [Multi-agent trap (Towards Data Science)](https://towardsdatascience.com/the-multi-agent-trap/)
- [Multi-agent patterns (Confluent)](https://www.confluent.io/blog/event-driven-multi-agent-systems/)
- [O'Reilly multi-agent design](https://www.oreilly.com/radar/designing-effective-multi-agent-architectures/)
- [GitHub 2026 trends](https://github.blog/open-source/maintainers/what-to-expect-for-open-source-in-2026/)
- [2026 Agentic Coding Trends (Anthropic)](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf)
- [AI code quality review (Morphic)](https://www.morphllm.com/ai-coding-agent)
- [LLM bug fixing (arXiv)](https://arxiv.org/html/2411.10213v2)
- [GitHub InfoQ 2026](https://www.infoq.com/news/2026/03/github-ai-2026/)
- [Early PR review effort prediction (arXiv)](https://arxiv.org/html/2601.00753)
- [Generative AI OSS policy landscape (RedMonk)](https://redmonk.com/kholterhoff/2026/02/26/generative-ai-policy-landscape-in-open-source/)
