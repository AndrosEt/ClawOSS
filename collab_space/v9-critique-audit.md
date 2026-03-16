# V9 Critique Audit — Deep Codebase & Agent Analysis

**Date**: 2026-03-17
**Author**: critique agent
**Status**: Complete

---

## 1. RATE LIMIT REFERENCES (all files, all locations)

The following rate limits exist across the codebase. **Tasks #3 needs to change ALL of these.**

### 1a. Daily PR Limit (10/day)

| File | Line(s) | Text |
|------|---------|------|
| `workspace/AGENTS.md` | 25 | "Max 10 PRs/day, max 3 per repo/day, 30-min gap between same-repo PRs" |
| `workspace/HEARTBEAT.md` | 81 | "prs_today >= 10: do NOT spawn new implementations" |
| `config/openclaw.json` | 52 (heartbeat prompt) | "LIMITS: Max 10 PRs/day." |
| `~/.openclaw/openclaw.json` | heartbeat prompt | Same as above — "LIMITS: Max 10 PRs/day." |
| `workspace/skills/oss-discover/SKILL.md` | 29 | "Check daily PR count — if at limit (10), triage-only mode." |
| `workspace/skills/oss-discover/SKILL.md` | 291 | "At daily limit (10 PRs)? Triage-only." |
| `workspace/templates/subagent-result-schema.md` | 131 | "daily_limit_reached: Hit daily PR limit (10/day)" |

### 1b. Per-Repo Limits (3/repo/day, 30-min gap)

| File | Line(s) | Text |
|------|---------|------|
| `workspace/AGENTS.md` | 25 | "max 3 per repo/day, 30-min gap between same-repo PRs" |
| `workspace/HEARTBEAT.md` | 94 | "Skip if repo has 3 PRs today." |

### 1c. New Repo Limit (3/day)

| File | Line(s) | Text |
|------|---------|------|
| `workspace/AGENTS.md` | 97 | "Max 3 NEW repos per day" |
| `workspace/HEARTBEAT.md` | 85 | "Max 3 new repos per day — if new_repos_today >= 3, only pick from trusted repos" |
| `config/openclaw.json` | 52 (heartbeat prompt) | "Max 3 NEW repos per day." |
| `~/.openclaw/openclaw.json` | heartbeat prompt | Same — "Max 3 NEW repos per day." |
| `workspace/skills/oss-discover/SKILL.md` | 40 | "Max 3 NEW repos per day" |
| `config/cron-jobs.json` | 10 | "Max 3 NEW repos per day" (inside work-queue-refill payload) |

### 1d. wake-state.md Bypass Bug
**CRITICAL**: `workspace/wake-state.md` currently shows:
```
prs_today: 30
new_repos_today: 15
```
The agent submitted 30 PRs despite a 10/day limit and targeted 15 new repos despite a 3/day cap. **The rate limits were being bypassed entirely.** This means the limits in prompts are not being enforced — likely because:
1. The agent doesn't always read wake-state.md before spawning
2. Cron jobs run in `lightContext: true` / `isolated` mode and bypass gates
3. The increment logic may race with concurrent sub-agents

**Implication for V9**: Removing rate limits won't change behavior (they weren't working), but it will eliminate the confusion and free up prompt tokens.

---

## 2. PR CLOSE LOGIC (every "close PR" action — all must become "rework")

### 2a. HEARTBEAT.md Close Actions (lines 58-76)

| Line | Category | Current Action | V9 Change Needed |
|------|----------|----------------|------------------|
| 58 | `fix_rejected` | Close PR: "approach doesn't resolve" | **REWORK**: attempt alternative approach or leave open for maintainer |
| 59 | `already_fixed_upstream` | Close PR: "already fixed upstream" | Keep close — this is correct (issue is resolved) |
| 60 | `stale` (>7d no activity) | Close PR: "Closing as stale" | **REWORK**: keep open, wait longer. 7 days is too aggressive. Many repos review weekly. |
| 61 | `invalid_contribution` | Close PR: "feature not bug fix" | Keep close — this is a valid withdrawal of a misfiled PR |
| 62 | `low_star_repo` | Close PR: "submitted in error" | Keep close — these should never have been submitted |
| 63 | `close_withdraw` | Close with polite withdrawal | **ELIMINATE**: never voluntarily withdraw |
| 70-76 | Batch cleanup (low-star, feat title, CLA org, self-fork, duplicates) | Close all | **Keep most** — low-star, CLA, self-fork, true dupes are valid closures. `feat:` title could be reworked. |

### 2b. subagent-followup.md Close Actions

| Line | Category | Current Action | V9 Change Needed |
|------|----------|----------------|------------------|
| 50 | `closed_scope_concern` | Close PR if reviewer says out of scope | **REWORK**: adjust scope, don't close |
| 52-54 | `fix_rejected` | Close PR: "approach doesn't resolve" | **REWORK**: try alternative approach |
| 56-58 | `already_fixed_upstream` | Close PR: "already fixed upstream" | Keep close — correct |
| 63 | CLA can't sign | Close PR | Keep close — CLA is a hard blocker |

### 2c. AGENTS.md Close References

| Line | Text | V9 Change Needed |
|------|------|------------------|
| 96 | "Abandon losers fast: closed our PR without review within 24h, deprioritize" | Consider: don't close, just deprioritize |
| 143 | "Not appropriate / out of scope: close PR, log lesson, move on" | **REWORK**: adjust scope instead of closing |

### 2d. HEARTBEAT.md Step 2b Classification Actions

The classification system at lines 52-63 needs a new category: **`rework`** — instead of closing, re-enter the implementation cycle with adjusted approach.

---

## 3. AGENT LOG ANALYSIS

### 3a. Errors Found in Last 200 Lines

| Error | Count | Impact |
|-------|-------|--------|
| `zsh:1: command not found: python` | 3x | Sub-agents trying to run Python tests on repos — `python` not in PATH, need `python3` |
| `zsh:1: command not found: go` | 1x | Sub-agent working on Go repo (ollama?) — `go` not installed or not in PATH |
| `ENOENT: no such file or directory` — various paths | 4x | Sub-agents looking for files that don't exist (context.md, subagent-input files, docs) |
| `web_fetch failed: 404` | 4x | Fetching URLs that don't exist (likely trying to check repo docs) |
| `error: pathspec 'expect' did not match any file(s) known to git` | 1x | **Malformed git commit command** — the agent passed a multi-word commit message without proper quoting. "expect", "or", "handle", "redirects." were parsed as separate arguments. |
| `tools.profile allowlist contains unknown entries (apply_patch, cron, image)` | 18x | Config references tools that don't exist in the current OpenClaw build |

### 3b. Critical Bug: Malformed Git Commit

At 16:55:26, the agent produced this error:
```
error: pathspec 'expect' did not match any file(s) known to git
error: pathspec 'or' did not match any file(s) known to git
error: pathspec 'handle' did not match any file(s) known to git
error: pathspec 'redirects.' did not match any file(s) known to git
zsh:8: command not found: By
zsh:9: command not found: directly
zsh:11: command not found: Fixes
```
This is a **commit message that was not properly quoted** — the multi-line PR description was parsed as shell commands. This likely resulted in a failed PR submission (BerriAI/litellm #23758 based on "redirects" keyword). The subagent-implementation template should enforce single-quoted heredoc for commit messages.

### 3c. Missing Tool Warnings

The `apply_patch`, `cron`, and `image` tools are referenced in the config tools profile but don't exist in the current OpenClaw build. This produces 18 warnings in the log. While not blocking, it's noise. The config should be updated to remove these.

---

## 4. OPEN PR REVIEW STATUS

### 4a. PRs With UNRESPONDED Human Comments (ACTION REQUIRED)

| PR | Commenter | Comment | Age | Priority |
|----|-----------|---------|-----|----------|
| **Textualize/textual #6429** | `willmcgugan` (repo owner) | "@BillionClaw what CLA did you sign?" | 2026-03-16 13:55 | **URGENT** — maintainer asking about CLA. This repo does NOT require CLA. Need to respond honestly. |
| **huggingface/peft #3102** | `BenjaminBossan` (maintainer) | CHANGES_REQUESTED: "I had a very similar solution in the works. Before merging: 1. For consistency..." | 2026-03-16 | **HIGH** — maintainer gave specific change requests. Must respond with implementation changes. |
| **manaflow-ai/cmux #1394** | `wobondar` | "I think this PR fixes one real part of the drag regression, but not the whole thing..." | 2026-03-13 23:52 | **MEDIUM** — reviewer says PR is partial fix. May need scope adjustment. |
| **crosspoint-reader/crosspoint-reader #1404** | `znelson`, `jpirnay` | Discussion about approach — asking about tail threshold | 2026-03-16 | **MEDIUM** — active design discussion between other contributors. BillionClaw may need to chime in. |

### 4b. PRs With Approved Review (MERGE IMMEDIATELY)

| PR | Reviewer | Status |
|----|----------|--------|
| **run-llama/llama_index #21025** | `logan-markewich` | **APPROVED** — needs immediate merge attempt |

### 4c. PRs at CLA-Required Repos (should not exist)

| PR | Repo | Issue |
|----|------|-------|
| **BerriAI/litellm #23759** | BerriAI/litellm | CLA-assistant bot flagged "not_signed" |
| **BerriAI/litellm #23758** | BerriAI/litellm | CLA-assistant bot flagged "not_signed" |
| **BerriAI/litellm #23756** | BerriAI/litellm | CLA-assistant bot flagged "not_signed" |
| **Aider-AI/aider #4927** | Aider-AI/aider | Aider-AI is in the CLA blocklist in AGENTS.md! |
| **apache/arrow #49520** | apache/arrow | Apache is in the CLA blocklist in AGENTS.md! |

**BerriAI/litellm uses CLA-assistant** but is NOT in the CLA blocklist in AGENTS.md. This is a gap — BerriAI should be added to the CLA org list. All 3 litellm PRs will be blocked by CLA.

**Aider-AI/aider and apache/arrow** — these ARE in the CLA blocklist but the agent submitted PRs anyway. The CLA check is being bypassed.

### 4d. PRs at Sub-200 Star Repos (should not exist)

| PR | Repo | Stars |
|----|------|-------|
| sonpiaz/4x-game-agent #12 | sonpiaz/4x-game-agent | **1 star** |
| rysweet/azlin #853 | rysweet/azlin | **1 star** |
| taskcoach/taskcoach #418 | taskcoach/taskcoach | **25 stars** |
| windoze95/servicewow-mcp #34 | windoze95/servicewow-mcp | **0 stars** |
| windoze95/nullfeed-backend #41 | windoze95/nullfeed-backend | **2 stars** |
| karmaniverous/jeeves-watcher #125 | karmaniverous/jeeves-watcher | **1 star** |
| Fchat-Horizon/Horizon #695 | Fchat-Horizon/Horizon | **43 stars** |
| Roxonn-FutureTech/Roxonn-Platform #107 | Roxonn-FutureTech/Roxonn-Platform | **24 stars** |
| gtech-mulearn/mulearn #2026 | gtech-mulearn/mulearn | **98 stars** |

**9 out of 47 open PRs (19%) target repos with < 200 stars.** The star threshold is specified in AGENTS.md line 72, HEARTBEAT.md step 1a, and the subagent-implementation template step 1a. All three checks are being bypassed.

---

## 5. PROMPT INCONSISTENCIES

### 5a. CLA Org List Inconsistency

| File | CLA Orgs Listed |
|------|----------------|
| AGENTS.md (line 54-61) | deepset-ai, iterative, Aider-AI, milvus-io, apache, microsoft, google, meta-llama |
| HEARTBEAT.md (line 73) | deepset-ai, iterative, Aider-AI, milvus-io, apache, microsoft, google, meta-llama |
| heartbeat prompt (openclaw.json) | deepset-ai, iterative, Aider-AI, milvus-io, apache, microsoft, google, meta-llama |
| oss-discover SKILL.md (line 206) | deepset-ai, iterative, Aider-AI, milvus-io, apache, microsoft, google, meta-llama |
| oss-triage SKILL.md (line 67) | Mentions CLA but defers to repo-health-check.sh |
| subagent-implementation.md (line 56-58) | deepset-ai, iterative, Aider-AI, milvus-io, apache, microsoft, google, meta-llama |
| subagent-scout.md (line 102) | deepset-ai, iterative, Aider-AI, milvus-io, apache, microsoft, google, meta-llama |
| cron-jobs.json (line 10) | deepset-ai, iterative, Aider-AI, milvus-io, apache, microsoft, google, meta-llama |

**MISSING from all lists: BerriAI** (litellm uses CLA-assistant — we have 3 blocked PRs proving it).

### 5b. Contribution Type Consistency

All files consistently list: bug fixes, docs fixes, typo fixes, test additions. **Consistent.**

### 5c. Title Keyword Reject List Consistency

| File | Keywords Listed |
|------|----------------|
| HEARTBEAT.md (line 97) | add, extend, enable, improve, enhance, new feature, request, implement, support, introduce, create, propose, migrate, upgrade, refactor, redesign, optimize, allow, provide |
| AGENTS.md (line 112) | Not listed inline — defers to "same as 3f" |
| oss-discover SKILL.md (line 274-277) | Same list |
| oss-triage SKILL.md (line 17-19) | Same list |
| subagent-implementation.md (line 24-26) | Same list |
| subagent-scout.md (line 107) | Same list |

**Consistent across all files.**

### 5d. Scoring Consistency

Scoring formulas are consistent across oss-discover, oss-triage, and subagent-scout (all use the same +5/+3/+2 structure with trust bonuses).

### 5e. 1 Active PR Per Repo vs 3 Per Repo Contradiction

- **AGENTS.md line 25**: "max 3 per repo/day" (allows multiple)
- **HEARTBEAT.md line 93**: dedup check uses `> 0` (blocks any new PR if one is open)
- **heartbeat prompt**: "Max 1 active PR per repo"
- **oss-triage SKILL.md line 73-74**: "If > 0, SKIP: already have open PR on this repo — max 1 active PR per repo"

The heartbeat prompt and triage skill say 1, but AGENTS.md says 3. In practice the dedup logic enforces 1 (which is correct). **AGENTS.md line 25 needs updating to say "max 1 active PR per repo".**

---

## 6. "NEVER CLOSE PRs" CHANGE POINTS

Complete list of every file and line where a PR close action occurs, for builder to modify:

### Must Change to "Rework" Logic:
1. **`workspace/HEARTBEAT.md:58`** — `fix_rejected` close action
2. **`workspace/HEARTBEAT.md:60`** — `stale` close action (7 days too aggressive)
3. **`workspace/HEARTBEAT.md:63`** — `close_withdraw` action
4. **`workspace/templates/subagent-followup.md:50`** — `closed_scope_concern`
5. **`workspace/templates/subagent-followup.md:52-54`** — `fix_rejected` close
6. **`workspace/AGENTS.md:143`** — "Not appropriate / out of scope: close PR"

### Keep as Close (valid reasons to close):
1. **`workspace/HEARTBEAT.md:59`** — `already_fixed_upstream` (issue resolved)
2. **`workspace/HEARTBEAT.md:61`** — `invalid_contribution` (we submitted a feature by mistake)
3. **`workspace/HEARTBEAT.md:62`** — `low_star_repo` (should not have been submitted)
4. **`workspace/HEARTBEAT.md:70-76`** — Batch cleanup: low-star, CLA org, self-fork, true duplicates
5. **`workspace/templates/subagent-followup.md:56-58`** — `already_fixed_upstream`
6. **`workspace/templates/subagent-followup.md:63`** — CLA can't sign

---

## 7. ADDITIONAL FINDINGS

### 7a. Cron Jobs Run in Isolated/lightContext Mode

`config/cron-jobs.json` has 4 out of 5 crons using `lightContext: true` and `sessionTarget: "isolated"`. This means they:
- Do NOT read AGENTS.md, HEARTBEAT.md, or memory files
- Do NOT enforce CLA checks, star thresholds, or rate limits
- Operate with minimal context

The `work-queue-refill` cron (line 10) does mention "Max 3 NEW repos per day" and CLA orgs in its payload text, but since it's in isolated mode, the agent may not have full context to enforce these. This is a known issue (per `feedback_cron_gate_bypass` memory).

### 7b. Multiple PRs at Same Repo

We have open PRs at these repos simultaneously:
- **BerriAI/litellm**: 3 open PRs (#23759, #23758, #23756)
- **vllm-project/vllm**: 2 open PRs (#37211, #37208)
- **ollama/ollama**: 2 open PRs (#14877, #14875)
- **clearml/clearml**: 2 open PRs (#1561, #1560)
- **windoze95/servicewow-mcp**: 2 open PRs (#34, #33)
- **moltis-org/moltis**: 2 open PRs (#435, #431)

This violates the "max 1 active PR per repo" rule in the heartbeat prompt and oss-triage. The dedup check (`gh search prs --author BillionClaw --repo ... --state open`) should catch this, but clearly it's being bypassed — possibly because concurrent sub-agents spawn before the first one's PR is created.

### 7c. Unknown Tool Warnings

The config references `apply_patch`, `cron`, and `image` tools that don't exist in the current OpenClaw build. These produce 18 warning lines per session. Should be cleaned up.

### 7d. Total PR Portfolio Health

| Category | Count | % of Total |
|----------|-------|------------|
| Total open PRs | 47 | 100% |
| At CLA-required repos | 5 | 11% — **will never merge** |
| At sub-200 star repos | 9 | 19% — **unlikely to merge** |
| At repos with multiple open PRs | 12 (6 repos) | 26% — **violates policy** |
| With unresponded human comments | 4 | 9% — **urgent action needed** |
| With approved review | 1 | 2% — **merge immediately** |
| Healthy, on track | ~26 | ~55% |

**Only ~55% of the PR portfolio has a reasonable path to merge.** The other 45% is wasted effort due to gate bypasses.

---

## 8. RECOMMENDATIONS FOR V9

### Immediate Actions (before V9 restart):
1. **Merge run-llama/llama_index #21025** — it's approved
2. **Respond to Textualize/textual #6429** — maintainer asking about CLA, this repo doesn't require one
3. **Respond to huggingface/peft #3102** — implement requested changes
4. **Close all CLA-blocked PRs** (litellm x3, aider x1, arrow x1) with honest CLA message
5. **Close all sub-200 star PRs** (9 PRs) — they should never have been submitted
6. **Add BerriAI to CLA org list** across all files

### V9 Configuration Changes:
1. Remove all rate limits (Task #3) — they weren't working anyway
2. Implement rework logic (Task #4) — replace close with rework at the 6 identified change points
3. Fix `python` -> `python3` in subagent PATH or add alias
4. Fix commit message quoting in subagent-implementation template
5. Remove `apply_patch`, `cron`, `image` from tools profile
6. Change AGENTS.md "max 3 per repo/day" to "max 1 active PR per repo"
7. Add race condition guard for concurrent sub-agents targeting same repo
