# Issue Fixer Progress

## repo-health-check.sh — 3 Bugs Fixed

**Commit**: `ca21742` on `v6-release` (pushed)

### Bug 1: Merge time math broken across month/year boundaries
- **Root cause**: jq date math concatenated year+month+day as numbers (e.g., `20260316`), which produces wrong deltas across month/year boundaries (e.g., Jan 31 to Feb 1 = `20260201 - 20260131 = 70` instead of 1 day)
- **Fix**: Replaced jq with Python `datetime.fromisoformat()` for correct calendar-aware date subtraction
- **Lines**: 127-148

### Bug 2: Open PR count capped at 100
- **Root cause**: Used `pulls?state=open&per_page=100` endpoint which returns max 100 results, so repos with 150+ open PRs still showed 100
- **Fix**: Switched to search API `/search/issues?q=is:pr+is:open+repo:${REPO}&per_page=1` with `.total_count` for accurate counts
- **Lines**: 171

### Bug 3: Thresholds too strict for large repos
- **Root cause**: Flat thresholds (14d merge, 50 open PRs, 50% review rate) caused healthy large repos (vllm, langchain, transformers) to fail health checks
- **Fix**: Added star-based tiered thresholds:
  - **20000+ stars**: 1000 open PR limit (mega-repos)
  - **5000+ stars**: 30d merge limit, 500 open PR limit, 30% review rate minimum
  - **<5000 stars**: 14d merge, 50 open PRs, 50% review rate (unchanged)
- **Lines**: 151-179, 216-221

### Bonus: Review rate check improved
- Old: Used `comments`/`review_comments` fields from pulls list (sometimes null)
- New: Checks actual `/pulls/{number}/reviews` endpoint per merged PR for reliable signal
- **Lines**: 193-208

---

## Consistency Fixes (from compatibility-ensurer)

**Commit**: `c50e07e` on `v6-release` (pushed)

### Fix 1: openclaw.json heartbeat prompt PR size limit
- **Was**: `"Small diffs (<200 LOC) merge fastest — aim for the smallest correct fix."`
- **Now**: `"Target 25-100 LOC per PR (max 150). Smaller PRs merge 40% faster."`
- Aligns with AGENTS.md, TOOLS.md, all skills, and all templates

### Fix 2: README.md lightContext reference
- **Was**: `lightContext: true` in architecture diagram
- **Now**: `lightContext: false`
- Reflects actual config change

---

## PR Audit Bug Fixes (from problem-finder)

**Commit**: `826cf25` on `v6-release` (pushed)

### Bug 1 (CRITICAL): PR de-duplication missing
- **Problem**: Agent submitted same fix 5x to instructor (#2155-#2159) — no check for existing open PRs
- **Fix**: Added mandatory de-duplication check to both `subagent-implementation.md` (step 8) and `oss-submit/SKILL.md`
- Subagents now run `gh pr list --author @me --repo REPO --state open` before `gh pr create` and abort if >0

### Bug 2: Bare except and silent error suppression
- **Problem**: `except: pass` catches all exceptions (TypeError, SystemExit, etc.); `2>/dev/null` on integer comparisons silently passes when AVG_MERGE_DAYS is empty/non-numeric
- **Fix**: `except (ValueError, KeyError): pass` for specific error handling; added regex sanitization (`^[0-9]+$`) that sets AVG_MERGE_DAYS=999 (fail safe) if invalid; removed all `2>/dev/null` from integer comparisons

### Bug 3: Branch naming convention not enforced
- **Problem**: Subagents could create branches like `fix/...` without the `clawoss/` prefix
- **Fix**: Added mandatory branch name check to `subagent-implementation.md` step 8 that verifies `clawoss/*` prefix and auto-renames with `git branch -m` if missing

---

## CLA + Anti-Bot + Fork Restriction (from problem-finder + researcher-2)

**Commit**: `61ef94b` + `0170637` on `v6-release` (pushed)

### CLA detection (hard-fail)
- Known CLA org blocklist (8 orgs) + .clabot file check + CLA GitHub Actions scan + CONTRIBUTING.md text detection
- Hard-fail: CLA-required repos waste full implementation cycles

### Anti-bot policy detection
- Decodes CONTRIBUTING.md, greps for "no bot", "no ai generated", "human only", etc.
- Hard-fail: submitting to hostile repos damages reputation

### Fork restriction check
- Checks `allow_forking` API field — if forking is disabled, we can't submit PRs
- Zero-cost check (piggybacks on existing metadata API call)

---

## Script Hardening (from proactive audit)

**Commits**: `7b46473`, `f550f20`, `1da5eb4`, `19ac5af` on `v6-release` (pushed)

- `pr-ledger-sync.sh`: 2 bare `except:` → `except (json.JSONDecodeError, ValueError):`
- `dashboard-sync.sh`: 3 bare `except:` → specific exception types
- `start.sh`: stale model reference `openrouter/moonshotai/kimi-k2.5` → `kimi-coding/k2p5`
- `pr-ledger-sync-wrapper.sh`: hardcoded nvm Node `v22.21.1` → dynamic `ls -d */bin | tail -1`
- `restart.sh`: removed dead `OPENROUTER_API_KEY` injection
- `setup.sh`: required KIMI_API_KEY explicitly, removed OpenRouter fallback, fixed shell injection

---

## Stale OpenRouter Cleanup

**Commits**: `ec6e391`, `a550b69`, `6c1bd80` on `v6-release` (pushed)

- `dashboard-reporter/handler.ts`: `provider: "openrouter"` → `provider: "kimi-direct"`
- `.env.example`: removed OPENROUTER_API_KEY line
- `plugins/pii-sanitizer/package.json` + `openclaw.plugin.json`: updated descriptions
- `workspace/templates/subagent-result-schema.md`: `content_filter_blocked` description updated
- `workspace/hooks/pii-sanitizer/handler.ts` + `HOOK.md`: removed stale OpenRouter comments
- `plugins/pii-sanitizer/index.js`: updated comments
- `config/com.clawoss.pr-ledger-sync.plist`: removed hardcoded nvm v22.21.1 from PATH

---

## Cron Job + Exception Fixes

**Commits**: `6658e47`, `2d001b4` on `v6-release` (pushed)

- `dashboard-sync.sh`: narrowed last remaining `except Exception` in `build_session_map` to specific types
- `config/cron-jobs.json`: batched `pr-followup-scan` from `--limit 100` to `--limit 5 --sort updated` — was likely causing all 3 cron job gateway timeouts reported by monitor
- Deleted stale `workspace/scripts/repo-health-check.sh` (buggy duplicate of canonical `scripts/repo-health-check.sh`)

---

## Session 2 Commits (2026-03-16, continued)

**Commit `d4ff690`**: trust-building strategy, CLA honesty across all templates, dashboard metrics panels
- AGENTS.md: concurrent sub-agent limit wording
- HEARTBEAT.md: batch PR comment scanning, mandatory issues/comments check
- oss-followup: maintainer_question handling, trust-repos update on merge
- oss-submit: CLA honesty rule (step 6), renumbered steps
- subagent-followup: CLA honesty rule for follow-up interactions
- CLAUDE.md: aligned star threshold to 200+
- cron-jobs.json: trust-repos-first discovery with CLA org blocklist
- openclaw.json: trust-building + anti-AI-slop heartbeat prompt rewrite
- Dashboard: 5 new panels (autonomy, post-merge, velocity, response-times, alerts)
- Deleted 39 resolved issue tracking files

**Commit `609f35a`**: oss-submit step numbering fix, HEARTBEAT threshold for trusted repos

**Commit `2cfcbbe`**: executable duplicate/low-star cleanup, CLA question handling, hypothesis checks, action items panel

**Commit `52f3154`**: expanded step 2f cleanup to catch CLA orgs, self-forks, feat: titles

---

## Status: 17 COMMITS, 35+ fixes pushed to v6-release

All known bugs from problem-finder (round 1-3), compatibility-ensurer (round 1-4), researcher-2, monitor, prompt-architect, and proactive audit are fixed. Full audit complete of all scripts, hooks, plugins, templates, skills, configs, and dashboard. CLA honesty rule applied across all 4 relevant files.
