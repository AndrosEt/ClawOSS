# ClawOSS PR Audit — 2026-03-16

Audited by: **problem-finder** (adversarial auditor)

**Goal**: Identify where the agent's PROMPTS and TOOLS produce bad output, so architect/issue-fixer can fix them and the agent improves autonomously.

---

## Executive Summary

**Open PRs**: 46 across 40+ repos. 17 GOOD, 6 OK, 3 BORDERLINE, 10 BAD (from 36 audited). 10 new PRs pending audit.
**Closed PRs**: ~45 total. **Only 2 merged** (4.4% merge rate). 8 were feature additions, 4 to CLA-required apache, 5 duplicates on instructor.

The agent's merge rate is critically low. Root causes: (1) feature PRs bypassing triage, (2) CLA-required orgs not blocked, (3) diff size gate not enforced, (4) duplicate submissions. **9 prompt gaps + 3 new gaps (10-12) identified** — 11 fixes applied to sub-agent template.

### NEW CRITICAL FINDINGS (Round 3 — 2026-03-16 22:30 HKT)

**10 HIGH-PRIORITY issues requiring immediate orchestrator action:**

1. **DUPLICATE PRs STILL HAPPENING**: 3 repos have 2+ open PRs from BillionClaw — clearml (1560+1561), moltis (431+435), servicewow-mcp (33+34). HEARTBEAT step 2f should catch these but hasn't fired.
2. **LOW-STAR REPOS BYPASSED HEALTH CHECK**: 7 repos under 200 stars: sonpiaz/4x-game-agent (1★), windoze95/servicewow-mcp (0★), windoze95/nullfeed-backend (2★), itdove/devaiflow (0★), Nexal-AI/voicecrew (0★), rysweet/azlin (1★), karmaniverous/jeeves-watcher (1★). These should have been rejected by health checks.
3. **Will McGugan CLA question STILL UNANSWERED on Textual #6429**: Agent disclosed AI status but hasn't replied to "what CLA did you sign?" — now 9+ hours stale.
4. **Millennium #671 STILL OPEN**: Maintainer said "fixed in latest beta" 20+ hours ago. Should be closed as already_fixed_upstream.
5. **devaiflow #170 maintainer requested duplicate cleanup**: itdove said "I noticed you 3 similar PRs for the same issue, can you close the duplicates?"
6. **autokey #1091 maintainer gave feedback**: josephj11 says "We cannot accept any PRs based on master." This is also a feat: PR.
7. **ollama #14875 APPROVED but not merged**: guicybercode approved 10+ hours ago. Agent should `gh pr merge --squash`.
8. **voice-satellite #23 CHANGES_REQUESTED**: Detailed 5-point review still unanswered.
9. **crosspoint-reader #1404 active discussion**: Maintainers discussing threshold approach. Agent should engage.
10. **manaflow-ai/cmux #1394 partial approval**: wobondar says PR fixes one part but not all. Agent should acknowledge.

---

## Prompt/Tool Gaps (ordered by merge-rate impact)

### GAP 1: No PR de-duplication guard — agent spams repos (CRITICAL)

**Evidence**: 5 identical PRs submitted to 567-labs/instructor (#2155-2158 closed, #2159 open). Same fix, same issue, same body text.

**Root cause**: The subagent implementation template has no pre-flight check for existing PRs.

**Fix for architect**: Add to the implementation subagent prompt / HEARTBEAT step 6:
```
Before running `gh pr create`, check:
  gh pr list --author BillionClaw --repo $REPO --state open --json title
If any open PR exists from BillionClaw on this repo for the same issue, ABORT. Do not create a duplicate.
```

**Autonomy impact**: Without this, the agent will get flagged as a spam bot and repos will block us.

---

### GAP 2: No diff size limit — agent produces massive refactors (CRITICAL)

**Evidence**: BillionClaw/codex PR #1 is +3421/-1603 across 41 files. Claimed as a "bug fix" but is actually a full module refactor (splitting guardian.rs into 4 files, rewriting TUI, changing config schema).

**Root cause**: The subagent prompt says "no features, refactors, or architectural changes" but has no enforcement mechanism. The agent ignored the instruction.

**Fix for architect**: Add a hard gate in the implementation subagent prompt:
```
HARD LIMIT: Before creating a PR, count your changes:
  git diff --stat HEAD~1 | tail -1
If total insertions + deletions > 200, STOP. Your change is too large.
Break it into smaller PRs or abandon. PRs > 200 lines merge 40% slower.
```

**Autonomy impact**: Large PRs waste cycles and never merge. This gate prevents the agent from going off-scope.

---

### GAP 3: No CLA-required repo detection — agent targets repos it can't merge into (HIGH)

**Evidence**: DVC (#11014) and haystack (#10835) both have CLA bots that immediately blocked the PRs. The CLA bot says "BillionClaw seems not to be a GitHub user" — the account email isn't recognized.

**Root cause**: `repo-health-check.sh` doesn't check for CLA requirements. The agent wastes a full implementation cycle on repos that will auto-reject.

**Fix for issue-fixer** (repo-health-check.sh): Add a CLA detection step:
```bash
# ─── CLA check ───
CLA_BOT=$(gh api "repos/${REPO}/contents/.github" --jq '.[].name' 2>/dev/null | grep -i cla || true)
CLA_ASSISTANT=$(gh api "repos/${REPO}/contents/.clabot" --jq '.content' 2>/dev/null || echo "")
if [ -n "$CLA_BOT" ] || [ -n "$CLA_ASSISTANT" ]; then
  warnings+=("repo requires CLA signing — verify BillionClaw account is eligible")
fi
```

**Fix for architect** (HEARTBEAT triage): Add to repo evaluation criteria:
```
Skip repos that require CLA signing unless BillionClaw has already signed their CLA.
Check for: .clabot file, CLA GitHub Action, "CLA" in CONTRIBUTING.md.
```

**Autonomy impact**: Eliminates wasted cycles on repos that will auto-reject our PRs.

---

### GAP 4: No anti-AI-bot policy detection — agent targets hostile repos (HIGH)

**Evidence**: Textualize/textual collaborator asked "Are you an AI agent?" on PR #6429. The agent answered honestly (good), but the PR may be unwelcome. Some repos explicitly ban bot PRs.

**Root cause**: repo-health-check.sh doesn't scan for anti-bot signals.

**Fix for issue-fixer** (repo-health-check.sh): Add anti-bot detection:
```bash
# ─── Anti-bot policy check ───
CONTRIBUTING_TEXT=$(gh api "repos/${REPO}/contents/CONTRIBUTING.md" --jq '.content' 2>/dev/null | base64 -d 2>/dev/null || echo "")
if echo "$CONTRIBUTING_TEXT" | grep -qi "no.*bot\|no.*ai.*generated\|no.*automated.*pr\|human.*only"; then
  fail "repo has anti-bot policy in CONTRIBUTING.md" "repo_health_fail: anti-bot policy detected"
fi
```

**Fix for architect** (known repos list): Maintain a blocklist of repos that have rejected bot PRs, checked during discovery.

**Autonomy impact**: Prevents wasting cycles on hostile repos and protects our reputation.

---

### GAP 5: Branch naming not enforced — makes PR management harder (MEDIUM)

**Evidence**: aider PR #4927 uses branch `fix/commit-message-user-added-context` instead of `clawoss/fix/commit-message-user-added-context`.

**Root cause**: The subagent prompt mentions the naming convention but doesn't enforce it.

**Fix for architect**: Add validation in the implementation subagent prompt:
```
Branch name MUST start with "clawoss/". Before pushing, verify:
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  if [[ "$BRANCH" != clawoss/* ]]; then
    echo "ERROR: Branch $BRANCH does not follow clawoss/ convention"
    exit 1
  fi
```

**Autonomy impact**: Consistent naming lets the orchestrator track and manage PRs without manual intervention.

---

### GAP 10: Low-star repos bypass health check (CRITICAL — NEW)

**Evidence**: 7 repos under 200 stars have open PRs:
| Repo | Stars | PR | Issue |
|------|-------|----|-------|
| sonpiaz/4x-game-agent | 1 | #12 (+881 lines) | No community, no reviews, waste of resources |
| windoze95/servicewow-mcp | 0 | #33, #34 | ZERO stars, 2 duplicate PRs |
| windoze95/nullfeed-backend | 2 | #41 | Effectively personal project |
| itdove/devaiflow | 0 | #170 | ZERO stars, feat: PR, maintainer asked about dupes |
| Nexal-AI/voicecrew | 0 | #11 | ZERO stars, feat: PR |
| rysweet/azlin | 1 | #853 (+196 lines) | 1 star, borderline oversized |
| karmaniverous/jeeves-watcher | 1 | #125 (+320 lines) | 1 star, way oversized |

Also borderline: Roxonn-FutureTech/Roxonn-Platform (24★), taskcoach/taskcoach (25★), Fchat-Horizon/Horizon (43★), gtech-mulearn/mulearn (98★).

**Root cause**: `repo-health-check.sh` has a stars threshold but it's either too low, not being checked, or cron-injected issues bypass health checks entirely. AGENTS.md says "500+ stars" but the health check script may use a lower threshold.

**Fix**: Verify `repo-health-check.sh` star threshold is >= 200 (or better, 500 per AGENTS.md). Add `low_star_repo` classification to HEARTBEAT step 2b for bulk cleanup. Close all PRs to repos < 200 stars.

---

### GAP 11: HEARTBEAT step 2f (duplicate cleanup) not firing (HIGH — NEW)

**Evidence**: 3 repos have 2+ open PRs right now:
- clearml/clearml: #1560 and #1561 (different issues, but same-repo multi-PR)
- moltis-org/moltis: #431 and #435 (different issues)
- windoze95/servicewow-mcp: #33 and #34 (different issues)

**Root cause**: Step 2f was added in this session but the heartbeat hasn't cycled with the new code yet, OR the dedup only applies to duplicate-issue PRs (same issue, multiple PRs) and these are different-issue-same-repo situations.

**Analysis**: HEARTBEAT step 3b gate (d) says "Prefer different repos across concurrent agents. NEVER have 2 agents working the same repo simultaneously." But this is a spawn-time guard only. If agents were spawned in different heartbeat cycles, the guard passed each time.

**Fix**: Step 2f should close older PRs for SAME REPO regardless of whether they're for the same issue. One open PR per repo is the rule.

---

### GAP 12: BillionClaw/codex #1 is a self-fork PR (MEDIUM — NEW)

**Evidence**: PR targets BillionClaw/codex (our own fork), not the upstream openai/codex repo. +3421/-1603 across 41 files. This is a massive PR on our own fork that serves no purpose — it will never be reviewed by external maintainers.

**Root cause**: Agent forked openai/codex, then submitted a PR to its own fork instead of to the upstream repo. The `gh pr create --repo {repo}` should target the upstream, not the fork.

**Fix**: This is already covered by FIX 2 (fork logic), but the BillionClaw/codex PR should be closed immediately.

---

## Additional Tool Bugs (for issue-fixer)

### repo-health-check.sh residual bugs

1. **Bare `except: pass`** (line ~146): Python date math block silently swallows ALL errors. Should be `except (ValueError, KeyError): pass`. A malformed API response will silently produce `AVG_MERGE_DAYS=0`, passing the merge time check when it should fail safe.

2. **Silent arithmetic error suppression** (lines 157, 162, 164): `[ "$AVG_MERGE_DAYS" -gt "$MERGE_LIMIT" ] 2>/dev/null` — if AVG_MERGE_DAYS is empty/non-numeric, the comparison silently fails and the check passes. Should default to a high value:
```bash
AVG_MERGE_DAYS=${AVG_MERGE_DAYS:-999}
```

3. **API rate limit risk**: Review rate check (section 5) makes up to 10 API calls per repo (one per merged PR). A single health check can consume 15+ API calls. If the agent evaluates 20 repos per cycle, that's 300+ calls.

---

## PR Quality Breakdown

| # | Repo | PR | +/- | Quality | Prompt/Tool Gap Hit |
|---|------|----|-----|---------|---------------------|
| 1 | chroma-core/chroma | #6655 | +1/-0 | GOOD | None |
| 2 | PrefectHQ/prefect | #21131 | +42/-3 | OK | None |
| 3 | treeverse/dvc | #11014 | +81/-1 | GOOD | GAP 3 (CLA blocked) |
| 4 | clearml/clearml | #1561 | +16/-0 | OK | None |
| 5 | clearml/clearml | #1560 | +11/-0 | GOOD | None |
| 6 | dlt-hub/dlt | #3748 | +163/-179 | BORDERLINE | GAP 2 (large opinionated restructure) |
| 7 | huggingface/peft | #3102 | +38/-11 | GOOD | None |
| 8 | bentoml/BentoML | #5572 | +9/-3 | GOOD | None |
| 9 | Textualize/textual | #6429 | +8/-0 | OK | GAP 4 (AI-agent suspicion) |
| 10 | deepset-ai/haystack | #10835 | +206/-0 | OK | GAP 2 + GAP 3 (large + CLA) |
| 11 | 567-labs/instructor | #2160 | +7/-1 | GOOD | None |
| 12 | 567-labs/instructor | #2159 | +65/-144 | GOOD | GAP 1 (4 duplicates before this) |
| 13 | run-llama/llama_index | #21025 | +61/-1 | GOOD | None |
| 14 | ollama/ollama | #14875 | +21/-0 | GOOD | None |
| 15 | simonw/llm | #1370 | +25/-5 | GOOD | None |
| 16 | dbcli/pgcli | #1560 | +15/-0 | OK | None |
| 17 | Aider-AI/aider | #4927 | +8/-0 | OK | GAP 5 (wrong branch name) |
| 18 | xournalpp/xournalpp | #7274 | +3/-1 | GOOD | None |
| 19 | folke/flash.nvim | #478 | +3/-1 | BAD | Fix doesn't work (follow-up agent problem) |
| 20 | BillionClaw/codex | #1 | +3421/-1603 | BAD | GAP 2 (massive refactor) |

**Summary (original 20)**: 12/20 PRs had zero prompt gaps and look mergeable. 8/20 hit a gap.

### Batch 2 — Additional PRs (discovered in round 2 audit)

| # | Repo | PR | +/- | Quality | Issue |
|---|------|----|-----|---------|-------|
| 21 | cleanlab/cleanlab | #1305 | +571/-0 | BAD | FEATURE not bug fix. 571 lines. Title: "Extend active learning..." |
| 22 | itdove/devaiflow | #170 | +108/-42 | BAD | Commit type `feat:`. Feature addition, not bug fix. |
| 23 | apache/arrow | #49520 | +13/-0 | BAD | apache is CLA-required org. PR can never merge. |
| 24 | rysweet/azlin | #853 | +137/-59 | BORDERLINE | Rewrites health collection function. Possibly feature. |
| 25 | taskcoach/taskcoach | #418 | +33/-0 | GOOD | Genuine bug fix, good size. |
| 26 | jenkinsci/warnings-ng-plugin | #3292 | +28/-0 | GOOD | Genuine bug fix. |
| 27 | sonpiaz/4x-game-agent | #12 | +881/-0 | BAD | 881 lines — way over 200 limit. |
| 28 | tenstorrent/tt-metal | #39919 | +4/-12 | OK | Architecture change (async->inline). |
| 29 | cilium/cilium | #44799 | +1/-0 | OK | Minor addition to expected list. |
| 30 | spotDL/spotify-downloader | #2628 | +11/-4 | GOOD | Clean API compat fix. |
| 31 | gtech-mulearn/mulearn | #2026 | +2/-2 | GOOD | Minimal fix. |
| 32 | ps2homebrew/Open-PS2-Loader | #1682 | +22/-7 | GOOD | Clean bug fix. |
| 33 | SteamClientHomebrew/Millennium | #671 | +20/-2 | GOOD | Clean bug fix, 6 files but small changes. |
| 34 | Fchat-Horizon/Horizon | #695 | +1/-1 | GOOD | Regex fix, minimal. |
| 35 | karmaniverous/jeeves-watcher | #125 | +320/-69 | BAD | Feature work disguised as fix. 320+ lines, 8 files. |
| 36 | jxlarrea/voice-satellite-card | #23 | +100/-12 | BORDERLINE | 100 lines, adds fallback mechanism. |

**Summary (Batch 2)**: 8 GOOD, 3 OK, 1 BORDERLINE, 4 BAD out of 16.

### Batch 3 — New PRs (Round 3 audit)

| # | Repo | PR | +/- | Quality | Issue |
|---|------|----|-----|---------|-------|
| 37 | Shopify/ruby-lsp | #4007 | +19/-7 | GOOD | Clean Windows regex fix |
| 38 | mistralai/mistral-vibe | #490 | +12/-3 | GOOD | Lazy import fix |
| 39 | GLips/Figma-Context-MCP | #291 | +11/-4 | GOOD | Null handling fix |
| 40 | darrenhinde/OpenAgentsControl | #269 | +2/-1 | GOOD | Minimal missing tool fix |
| 41 | Xian55/WowClassicGrindBot | #789 | +10/-4 | GOOD | GUID check fix (294★, borderline) |
| 42 | can1357/oh-my-pi | #417 | +8/-0 | GOOD | Race condition fix (2013★) |
| 43 | lukilabs/craft-agents-oss | #426 | +?/-? | OK | OAuth browser fix (3269★) |
| 44 | windoze95/nullfeed-backend | #41 | +?/-? | BAD | GAP 10: 2★ repo |
| 45 | moltis-org/moltis | #435 | +?/-? | BAD | GAP 11: duplicate on same repo (2nd PR) |
| 46 | moltis-org/moltis | #431 | +?/-? | OK | Original PR on moltis |

**Summary (all 46 audited)**: 23 GOOD, 9 OK, 3 BORDERLINE, 11 BAD.
**Overall**: 50% clean (GOOD), 70% acceptable (GOOD+OK), 24% BAD.

### PRs That Should Be IMMEDIATELY CLOSED (12 total)

| PR | Reason | Classification |
|----|--------|----------------|
| cleanlab/cleanlab #1305 | Feature addition ("Extend...") | `invalid_contribution` |
| itdove/devaiflow #170 | feat: commit, 0★ repo | `invalid_contribution` + `low_star_repo` |
| autokey/autokey #1091 | feat: PR, master-only rejection | `invalid_contribution` |
| Nexal-AI/voicecrew #11 | feat: PR, 0★ repo | `invalid_contribution` + `low_star_repo` |
| apache/arrow #49520 | CLA required (apache org) | `cla_required` |
| Aider-AI/aider #4927 | CLA required (Individual CLA per CONTRIBUTING.md) | `cla_required` |
| BillionClaw/codex #1 | Self-fork PR, +3421 lines | `invalid_contribution` |
| SteamClientHomebrew/Millennium #671 | Maintainer says fixed upstream | `already_fixed_upstream` |
| sonpiaz/4x-game-agent #12 | 1★ repo, +881 lines | `low_star_repo` |
| windoze95/servicewow-mcp #33 | 0★ repo, duplicate | `low_star_repo` |
| windoze95/nullfeed-backend #41 | 2★ repo | `low_star_repo` |
| rysweet/azlin #853 | 1★ repo | `low_star_repo` |

### New Prompt Gaps Identified

**GAP 6: `feat:` commit type not blocked** — devaiflow #170 uses `feat:` commit prefix. The implementation template has a COMMIT TYPE GATE that says "NEVER use feat:" but the agent bypassed it. The gate is text-only — needs executable enforcement like the diff size gate.

**GAP 7: Feature PRs still being submitted** — cleanlab #1305 (+571/-0) is a pure feature addition. The contribution type gate (Gate 0) failed. The issue (#930) is a feature request, and the triage step should have rejected it with title keyword "Extend".

**GAP 8: CLA-required org bypass** — apache/arrow #49520. Apache is listed in AGENTS.md CLA-required orgs (line 44) but the agent submitted anyway. The triage step 4b lists apache as CLA-required, but the sub-agent didn't check.

**GAP 9: Diff size gate completely bypassed** — sonpiaz/4x-game-agent #12 (+881) and karmaniverous/jeeves-watcher #125 (+320) both exceed the 200-line hard max. The bash enforcement script in the implementation template was either not run or the sub-agent ignored it.

---

## Prompt Consistency Audit — Round 2 (2026-03-16)

Findings from deep cross-file consistency analysis. All fixes applied directly.

### FIX 1: Implementation template missing shallow clone (FIXED)
**File**: `templates/subagent-implementation.md` line 33
**Issue**: Said "Clone repo INTO this directory" with no clone command or `--depth` flag. Follow-up handler uses `--depth=50`. Sub-agents were doing full clones, wasting bandwidth.
**Fix**: Added explicit `gh repo clone {repo} $WORKDIR -- --depth=50`.

### FIX 2: Implementation template missing fork logic (FIXED — CRITICAL)
**File**: `templates/subagent-implementation.md` lines 195-205
**Issue**: Template said "push branch" but never mentioned forking. Sub-agents can't push directly to upstream repos. The oss-submit skill had fork logic, but sub-agents never see skills — they only get the template.
**Fix**: Added FORK & PUSH section with `gh repo fork`, remote add, push to fork, and `--head BillionClaw:$BRANCH` on PR create.

### FIX 3: Follow-up template/skill cloned upstream, not fork (FIXED)
**Files**: `templates/subagent-followup.md` line 29, `skills/oss-pr-review-handler/SKILL.md` line 36
**Issue**: Follow-up agents cloned the upstream repo (`gh repo clone {owner}/{repo}`), then tried `git push origin {branch}`. Since `origin` was upstream (no write access), push would fail.
**Fix**: Changed to clone `BillionClaw/{repo}` (our fork) so `origin` has push access.

### FIX 4: Implementation template missing AI disclosure (FIXED)
**File**: `templates/subagent-implementation.md` line 222
**Issue**: oss-submit skill requires AI disclosure in PR body, but the template (what sub-agents actually see) had no mention of it. PRs were submitted without transparency notice.
**Fix**: Added mandatory AI disclosure line in PR body section.

### FIX 5: failure_reason category mismatches (FIXED)
**File**: `templates/subagent-implementation.md` lines 48, 181, 188
**Issue**: Template used `duplicate_pr` but schema defines `dedup_existing_pr` (for our PRs) and `duplicate_pr_other` (for other contributors). Dashboard aggregation would miss these.
**Fix**: Updated to `dedup_existing_pr` and `duplicate_pr_other` matching the schema taxonomy.

### FIX 6: `{owner}/{repo}` variable collision in implementation template (FIXED)
**File**: `templates/subagent-implementation.md` line 209
**Issue**: Template defines `{repo}` as `owner/repo` (e.g., `facebook/react`). The `gh api repos/{owner}/{repo}` line was wrong — `{owner}` is undefined in this template, and `{repo}` already contains the owner. Would produce `repos/undefined/facebook/react`.
**Fix**: Changed to `gh api repos/{repo}`.

### FIX 7: Undefined `{repo_name}` variable in fork section (FIXED)
**File**: `templates/subagent-implementation.md` lines 200, 203
**Issue**: Used `{repo_name}` which doesn't exist in the variables section. The fork remote URL and sync command would fail.
**Fix**: Added `REPO_NAME=$(echo "{repo}" | cut -d/ -f2)` extraction and used `$REPO_NAME`.

---

### FIX 8: CLA section included unconditionally in PR body (FIXED)
**File**: `templates/subagent-implementation.md` line 277
**Issue**: Every PR body included "## Contributor License Agreement" even for repos that don't require CLAs. This confused Textual's maintainer who asked "what CLA did you sign?" because Textual has no CLA requirement. Makes us look like we don't understand the repo.
**Fix**: Changed to conditional — only include CLA section if repo actually has `.clabot`, CLA workflow, or CLA in CONTRIBUTING.md.

### FIX 9: Title keyword reject added to sub-agent template (FIXED)
**File**: `templates/subagent-implementation.md` step 2
**Issue**: Title keyword reject (`add`, `extend`, `enable`, etc.) only existed in orchestrator triage. Sub-agents didn't check, allowing cleanlab #1305 ("Extend active learning...") to be submitted as a feature addition.
**Fix**: Added full keyword reject list to sub-agent CLASSIFY step as defense-in-depth.

### FIX 10: CLA org hard-reject added to sub-agent template (FIXED)
**File**: `templates/subagent-implementation.md` step 1b
**Issue**: CLA-required orgs list existed in AGENTS.md and HEARTBEAT triage but not in sub-agent template. Apache/arrow #49520 was submitted despite apache being in the blocklist.
**Fix**: Added explicit CLA org list (deepset-ai, iterative, Aider-AI, milvus-io, apache, microsoft, google, meta-llama) to sub-agent template.

### FIX 11: Commit type gate now has executable enforcement (FIXED)
**File**: `templates/subagent-implementation.md` step 8
**Issue**: `feat:` commit type gate was text-only ("NEVER use feat:"). itdove/devaiflow #170 used `feat:` anyway. Sub-agents need executable checks, not just text instructions.
**Fix**: Added bash script to grep commit message and abort if prefix is feat/chore/refactor/perf/style.

---

## Merge Rate Analysis

**Merged**: 2 PRs (badlogic/pi-mono docs, manaflow-ai/cmux fix)
**Closed without merge**: ~43 PRs
**Merge rate**: ~4.4%

### Closed PR Patterns
| Pattern | Count | Root Cause |
|---------|-------|------------|
| Feature additions (`feat:`, "Add", "Extend") | 8 | Triage bypass — GAP 6/7 |
| CLA-required org (apache) | 6 | CLA blocklist not checked — GAP 8 |
| Duplicate submissions (same repo) | 7 | Dedup race condition — GAP 1 |
| Oversized diffs (>200 lines) | 4 | Diff gate not enforced — GAP 9 |
| Legitimate closures (already fixed, scope) | ~10 | Expected |
| Pending review (still open) | 30 | Waiting |

### Recommendations for Next Cycle
1. The 11 prompt fixes above should eliminate feature/CLA/size bypasses
2. Focus new submissions on docs/typo fixes (near-guaranteed merge per research)
3. Target fast-merge repos (< 3 day avg merge time)
4. Reduce submission volume — quality over quantity

---

## GAP 13: pr-followup-state.md desynced from GitHub reality (HIGH — NEW)

**Evidence**: The state file has 8+ inaccuracies compared to actual GitHub state:

| PR | State File Says | GitHub Reality |
|----|----------------|----------------|
| Millennium #671 | `closed_already_fixed_upstream` | Still OPEN — close command never ran |
| Textual #6429 | `maintainer_question_answered` | Will McGugan's CLA question UNANSWERED |
| cleanlab #1305 | "CLA signed, waiting review" | Feature PR ("Extend..."), should be `invalid_contribution` |
| autokey #1091 | `maintainer_question_answered` | Also a feat: PR, should be `invalid_contribution` |
| ollama #14875 | `approved_ready_to_merge` | Not merged — merge command never ran |
| voice-satellite #23 | `spawned_pending` | Changes still unanswered on GitHub |
| Missing entirely | — | BillionClaw/codex #1, Figma-Context-MCP #291, OpenAgentsControl #269, mistral-vibe #490, moltis #431 |
| 7 low-star PRs | `pending_review` | Should be `low_star_repo` |

**Root cause**: The agent updates the state file with classifications but doesn't always execute the corresponding GitHub action (close, merge, comment). State tracking is running ahead of action execution.

**Fix needed**: HEARTBEAT step 2 should verify that state transitions are backed by actual GitHub API calls. Classification + state update should only happen AFTER the action succeeds. This is a pattern issue — the agent "decides" but doesn't "do".

---

## GAP 14: Cron pr-followup-scan uses invalid JSON fields (FIXED)

**Evidence**: `config/cron-jobs.json` line 23 used `--json number,repository,reviewDecision,statusCheckRollup,updatedAt`. Both `reviewDecision` and `statusCheckRollup` are NOT valid fields for `gh search prs` — the command fails with "Unknown JSON field". The cron fires every 30 minutes and silently errors.

**Root cause**: Different `gh` subcommands support different fields. `gh search prs` only supports: assignees, author, authorAssociation, body, closedAt, commentsCount, createdAt, id, isDraft, isLocked, isPullRequest, labels, number, repository, state, title, updatedAt, url.

**Fix applied**: Removed invalid fields, changed to `--json number,repository,updatedAt`. Added explicit `gh api repos/.../pulls/.../reviews` and `gh api repos/.../issues/.../comments` calls for each PR — matching the pattern in HEARTBEAT step 2a.

---

## repo-health-check.sh Date Math Bug

**Status**: ALREADY FIXED in commit `ca21742`. Old jq string-concatenation math replaced with Python `datetime`. The fix is correct. Residual bugs listed in "Tool Bugs" section above.
