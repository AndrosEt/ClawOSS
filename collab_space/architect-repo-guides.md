# Architect Repo Guides — Per-Repo Contribution Intelligence

**Author**: clawoss-architect
**Date**: 2026-03-16
**Status**: ACTIVE — 16 repo guides + 22 prompt/config fixes across 2 rounds

## Prompt Changes Made (autonomy improvements)

### 1. CLA repos are now HARD SKIP (not just -3 penalty)
- **Files changed**: AGENTS.md, HEARTBEAT.md step 4b, oss-discover/SKILL.md
- **Before**: CLA repos got -3 score penalty but could still enter work queue
- **After**: Known CLA repos (haystack, dvc, aider, milvus) are HARD SKIP at discovery AND triage
- **Why**: We can't sign CLAs, so PRs to these repos can NEVER merge = wasted tokens

### 2. Orchestrator dedup strengthened with live GitHub check
- **File changed**: HEARTBEAT.md step 5b
- **Before**: Only checked `impl-spawn-state.md` (race condition: two agents spawned before file write)
- **After**: Also runs `gh pr list --author @me --repo` check before spawn — live GitHub state is authoritative
- **Why**: Prevents the 3x-duplicate-PR pattern seen on cleanlab, taskcoach, azlin

### 3. Anti-AI policy detection added as explicit rule
- **File changed**: AGENTS.md (Known Repo Metadata section)
- **Before**: Only in oss-discover skill, not visible to sub-agents
- **After**: Explicit in AGENTS.md: HARD SKIP if CONTRIBUTING.md has "no bot", "no ai generated", etc.
- **Why**: Textual maintainer asked "Are you an AI agent?" — we should pre-detect anti-AI policies

### 5. Compaction identity preservation + quality guards (openclaw.json)
- **Files changed**: config/openclaw.json, ~/.openclaw/openclaw.json
- **Added**: `identifierPolicy: "strict"` — preserves PR URLs, file paths, branch names, issue numbers during compaction
- **Added**: `qualityGuard: { enabled: true, maxRetries: 2 }` — audits compaction summaries and retries bad ones
- **Why**: Agent loses context during compaction (PR URLs garbled, file paths lost). Strict identifier policy + quality guards prevent this.

### 6. CLA SKIP added to heartbeat prompt (BOTH configs)
- **Files changed**: config/openclaw.json, ~/.openclaw/openclaw.json
- **Added**: `CLA SKIP: NEVER submit PRs to repos requiring CLA/DCO signing` with known org list
- **Why**: Agent was submitting to haystack, DVC, aider — all CLA-required, PRs can never merge

### 7. @me replaced with BillionClaw in heartbeat prompt (BOTH configs)
- **Files changed**: config/openclaw.json, ~/.openclaw/openclaw.json
- **Before**: `gh pr list --author @me --repo OWNER/REPO` — fails in sub-agent/cron contexts
- **After**: `gh search prs --author BillionClaw --repo OWNER/REPO` — always works
- **Why**: Root cause of duplicate PRs. @me resolves to nothing in isolated sessions.

### 8. ALL 5 cron jobs fixed (delivery mode + explicit instructions)
- **Live cron changes**: All 5 jobs changed from `delivery.mode: "announce"` to `delivery.mode: "none"`
- **pr-followup-check**: Now has explicit `gh search prs --author BillionClaw` instructions, batches to 5 PRs max per run, 120s timeout
- **daily-discovery**: Now has explicit CLA skip, BillionClaw dedup check, work-queue-staging.md target
- **Why**: All 5 crons were failing silently because isolated sessions have no "last" channel for announce mode

### 9. Stronger self-review step in subagent-implementation.md
- **File changed**: workspace/templates/subagent-implementation.md step 7
- **Before**: Simple checklist
- **After**: "Act as a skeptical reviewer" with pass/fail scoring, explicit unnecessary-line check
- **Why**: Researcher found Open SWE's Planner->Programmer->Reviewer pipeline drastically improves quality. This adds the reviewer step.

### 10. Reference cron config synced
- **File changed**: config/cron-jobs.json
- **Fix**: pr-followup-scan payload now uses `BillionClaw` instead of `@me`
- **Why**: Reference config should match live cron state

### (Original) 6. Live config heartbeat prompt LOC fix
- **File changed**: ~/.openclaw/openclaw.json
- **Before**: `"Small diffs (<200 LOC) merge fastest"` (inconsistent with all other files)
- **After**: `"Target 25-100 LOC per PR (max 150). Smaller PRs merge 40% faster."` (matches everywhere)
- **Why**: The issue-fixer fixed config/openclaw.json but the LIVE config at ~/.openclaw/ still had the old text

### 4. Repo guide passthrough to sub-agents
- **File changed**: HEARTBEAT.md step 5b
- **Before**: Sub-agents received repo-conventions.md + issue-details.md only
- **After**: Also passes `memory/repos/{owner}_{repo}.md` if it exists
- **Why**: Sub-agents get branch target, CLA info, CI requirements without having to rediscover them

---

## Guide Inventory

### Active Repos (PRs submitted today)

| Repo | Guide File | PR(s) | Target Branch | CLA? | Key Gotcha |
|------|-----------|-------|---------------|------|------------|
| ollama/ollama | `ollama_ollama.md` | #14875 (APPROVED) | `main` | No | Multi-platform build matrix; keep diffs tiny |
| huggingface/peft | `huggingface_peft.md` | #3102 | `main` | No (Apache) | GPU tests need special setup; `make quality` + `make style` |
| Textualize/textual | `Textualize_textual.md` | #6429 | `main` | No | Will McGugan reviews personally; AI bot disclosure happened |
| PrefectHQ/prefect | `PrefectHQ_prefect.md` | #21131 | `main` | Unknown | Task runner concurrency is complex; understand engine flow |
| deepset-ai/haystack | `deepset-ai_haystack.md` | #10835 | `main` | **YES** | CLA not signed — blocks merge; Vale prose linting for docs |
| bentoml/BentoML | `bentoml_BentoML.md` | #5572 | `main` | Yes (in PR body) | Security-related changes need careful justification |
| dlt-hub/dlt | `dlt-hub_dlt.md` | #3748 | **`devel`** | Unknown | CRITICAL: target `devel` not `main` |
| allegroai/clearml | `allegroai_clearml.md` | #1560, #1561 | **`master`** | Unknown | CRITICAL: target `master` not `main`; some modules have no tests |
| iterative/dvc | `iterative_dvc.md` | #11014 | `main` | **YES** (CLA bot active) | CLA not signed — blocks merge |
| run-llama/llama_index | `run-llama_llama_index.md` | #21025 | `main` | No | 50% coverage requirement enforced by CI |
| 567-labs/instructor | `567-labs_instructor.md` | #2159, #2160 | `main` | No (MIT) | Strict PyRight type checking; conventional commits required |
| Aider-AI/aider | `Aider-AI_aider.md` | #4927 | `main` | **YES** | CLA required; no type hints in project; cross-platform CI |
| simonw/llm | `simonw_llm.md` | #1370 | `main` | Unknown | Simon Willison reviews personally; plugin architecture |
| chroma-core/chroma | `chroma-core_chroma.md` | #6655 | `main` | Unknown | Dual Python/Rust codebase |

### Pending Target Repos (in work queue)

| Repo | Guide File | Target Issue | Notes |
|------|-----------|-------------|-------|
| huggingface/transformers | `huggingface_transformers.md` | #44737 (XLNet CPU) | 157k stars, extremely active, PRs get buried |
| weaviate/weaviate | `weaviate_weaviate.md` | #10771 (PQ validation) | Go codebase, vector DB internals |
| qdrant/qdrant | `qdrant_qdrant.md` | #8406 (group search panic) | Rust codebase, panic prevention |

---

## Critical Findings from Teammate Reports

### From problem-finder (PR Audit)

1. **DUPLICATE PRs** — 6 repos have 2-3 PRs for the same issue. Orchestrator dedup is broken.
   - cleanlab (3 PRs), taskcoach (3), azlin (3), arrow (2), devaiflow (2), jeeves-watcher (2)
   - **Action**: Close older duplicates immediately

2. **CLA SIGNING BLOCKED** — haystack #10835, DVC #11014, and potentially aider #4927
   - BillionClaw account needs proper email config for CLA bots
   - **Action**: Fix CLA signing or avoid CLA-required repos

3. **flash.nvim #478** — Issue reporter confirmed fix doesn't work
   - **Action**: Withdraw PR with polite comment

4. **codex #1** — 3421-line "fix" to BillionClaw's own fork. Off-scope.
   - **Action**: Close immediately

5. **Branch naming violation** — aider PR uses `fix/...` instead of `clawoss/fix/...`
   - **Action**: Enforce prefix in subagent templates

### From compatibility-ensurer (Consistency Check)

1. **FIXED**: openclaw.json heartbeat said `<200 LOC` while all other files say `25-100/max 150`
   - Fixed in commit `c50e07e`

2. **FIXED**: README.md still showed `lightContext: true`
   - Fixed in same commit

3. **VERIFIED**: `gh api` format, contribution types, lightContext setting all consistent

### From monitor (Agent Status)

- Agent is IDLE, daily limit reached (13 PRs)
- ollama #14875 is APPROVED — closest to merge
- 63 PRs at round 0 pending review
- Skill symlink warnings are cosmetic, don't affect operation

### From researcher (Repo Profiles Batch 2)

New target repo recommendations:
- **mem0ai/mem0**: GOOD fit — pytest, ruff, relaxed requirements
- **FlowiseAI/Flowise**: GOOD fit — component-based, isolated fixes
- **gradio-app/gradio**: MEDIUM — changeset files add complexity
- **modelcontextprotocol/python-sdk**: MEDIUM-HARD — 100% coverage, strict
- **milvus-io/milvus**: HARD — DCO sign-off, multi-language, 90% coverage

### From researcher (OpenClaw Advanced Features)

Top 3 features to adopt:
1. Pre-Compaction Memory Flush (preserve state before summarization)
2. Tool Loop Detection (break repetitive failures)
3. Compaction Quality Guards (catch bad summaries)

---

## Branch Naming Quick Reference

Non-`main` target branches (sub-agents MUST check this):

| Repo | Target Branch | Notes |
|------|--------------|-------|
| dlt-hub/dlt | `devel` | |
| allegroai/clearml | `master` | |
| open-webui/open-webui | `dev` | Bot auto-rejects PRs to main |
| langchain-ai/langchain | `main` | Requires issue assignment first |
| All others | `main` | Always verify with `gh api` |

## CLA-Required Repos (sub-agents MUST handle)

| Repo | CLA Type | Status |
|------|---------|--------|
| deepset-ai/haystack | CLA-assistant bot | NOT SIGNED |
| iterative/dvc | CLA bot | NOT SIGNED |
| Aider-AI/aider | Individual CLA | NOT SIGNED |
| bentoml/BentoML | In PR body | OK |
| milvus-io/milvus | DCO sign-off in commits | N/A (not targeted yet) |

---

## Architect Recommendations

### Completed Actions (this session)
1. DONE: PR deduplication — 3-layer defense (HEARTBEAT step 2f self-cleanup, step 3b one-agent-per-repo, step 5b live GitHub check)
2. DONE: CLA repos are HARD SKIP at discover + triage + heartbeat + sub-agent levels
3. DONE: `fix_rejected` flow for withdrawn PRs (flash.nvim pattern)
4. DONE: `@me` replaced with `BillionClaw` everywhere (heartbeat, cron, subagent templates)
5. DONE: All 5 cron jobs fixed (delivery mode, explicit instructions, batch size)
6. DONE: Compaction identity preservation + quality guards
7. DONE: Stronger self-review step in subagent-implementation template
8. DONE: CLA SKIP instruction added to both heartbeat configs
9. DONE: Reference cron config synced with live state

### Round 2 Actions (this session — closed PR analysis + defense-in-depth)
10. DONE: Trust-building strategy across all prompts (AGENTS.md, HEARTBEAT.md, oss-discover)
11. DONE: Defense-in-depth star check in subagent-implementation (catches queue bypass)
12. DONE: Defense-in-depth CLA org reject in subagent-implementation
13. DONE: Defense-in-depth title keyword reject in subagent-implementation
14. DONE: Commit type gate enforced as actual bash script (not just instruction)
15. DONE: HEARTBEAT follow-ups elevated to "#1 priority" with inline fetch instructions
16. DONE: HEARTBEAT now closes `invalid_contribution` (feat: PRs) and `low_star_repo` PRs
17. DONE: Issue readiness check (step 1d): won't-fix, active discussion, assigned to someone else
18. DONE: Langchain requires issue assignment — added to known repo metadata
19. DONE: open-webui targets dev — added to known repo metadata
20. DONE: Repo-analyzer and oss-triage aligned with tiered health thresholds
21. DONE: PR body writing guidelines with good/bad examples in subagent-implementation
22. DONE: Stale PR closing message improved with "happy to reopen" language

### Still Needed
1. Close feat: PRs (autokey#1091, voicecrew#11, devaiflow#170) — agent handles via `invalid_contribution`
2. Close CLA PRs (aider#4927, arrow#49520) — agent handles via known CLA orgs
3. Close low-star PRs — agent handles via `low_star_repo` classification
4. Enable OpenClaw memory_search for semantic recall (researcher recommendation)
5. Enable session-memory hook for auto-persistence across compactions
