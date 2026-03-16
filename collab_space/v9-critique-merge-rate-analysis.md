# V9 Merge Rate Analysis — CRITICAL FINDINGS

**Date**: 2026-03-17
**Author**: critique agent

---

## Overall Numbers

| Metric | Value |
|--------|-------|
| **Open PRs** | 47 |
| **Closed PRs** | 56 |
| **Merged PRs** | 3 |
| **Closed without merge** | 53 |
| **Merge rate** | **5.4%** |
| **Total PRs submitted** | 103 |

**Industry AI PR average merge rate: 32.7%. We are at 5.4%.** That is 6x below average.

## The 3 Merged PRs

1. `jxlarrea/voice-satellite-card-integration #23` — Fix voice when using assist_satellite.announce
2. `badlogic/pi-mono #2166` — docs: document terminal keyboard protocol limitations
3. `manaflow-ai/cmux #1444` — fix: remove blocking sleep from preexec hook

These are all small repos. None are in our "golden niche" of agentic AI repos.

## Critical Rejection Patterns

### Pattern 1: DUPLICATE SUBMISSIONS (same fix submitted multiple times)
- **567-labs/instructor**: 5 PRs for the SAME fix (remove IMAGE_ harm categories) — all rejected
- **itdove/devaiflow**: 3 PRs for the SAME feature — all rejected
- **cleanlab/cleanlab**: 3 PRs for the SAME feature — all rejected
- **apache/arrow**: 2 PRs for same docs fix — both rejected
- **taskcoach/taskcoach**: 2 PRs for same fix — both rejected
- **rysweet/azlin**: 2 PRs for same fix — both rejected
- **jenkinsci/warnings-ng-plugin**: 2 PRs for same fix — both rejected

**At least 15 of 53 rejections (28%) are DUPLICATE submissions.** The dedup check is fundamentally broken. The agent submits, gets rejected, and immediately resubmits the same fix.

### Pattern 2: FEATURE SUBMISSIONS (violating bug-fix-only policy)
- `cleanlab/cleanlab #1305, #1304, #1303` — "feat(multilabel):" prefix — clear feature
- `itdove/devaiflow #170, #169, #168` — "feat: enable daf note command" — clear feature
- `autokey/autokey #1091` — "feat: Add game controller input" — clear feature
- `sonpiaz/4x-game-agent #10` — "feat: Add iOS device interface" — clear feature
- `whoisjayd/yt-study #56` — "feat: add authenticated YouTube requests" — clear feature
- `Nexal-AI/voicecrew #11` — "feat: Add Anthropic Claude LLM provider" — clear feature
- `xoundbyte/zoundhub #4` — "Add Spotify API integration" — clear feature
- `BillionClaw/codex #1` — submitted to own fork (self-fork!)

**At least 10 of 53 rejections (19%) are FEATURE submissions** that should have been caught by the title keyword reject and commit type gate.

### Pattern 3: CLA-REQUIRED REPOS
- `deepset-ai/haystack #10835` — CLA required (in blocklist!)
- `apache/arrow #49517, #49516` — CLA required (in blocklist!)
- `apache/mahout #1194, #1193, #1192, #1191` — CLA required (apache is in blocklist!)

**7 of 53 rejections (13%) are at CLA-required repos** that are explicitly in the blocklist. The CLA check is completely non-functional.

### Pattern 4: SUB-200 STAR REPOS
Based on star counts from the audit:
- `sonpiaz/4x-game-agent` (1 star) — 2 rejected PRs
- `rysweet/azlin` (1 star) — 2 rejected PRs
- `taskcoach/taskcoach` (25 stars) — 2 rejected PRs
- `karmaniverous/jeeves-watcher` (1 star) — 1 rejected PR
- `xoundbyte/zoundhub` — likely <200 stars
- `whoisjayd/yt-study` — likely <200 stars

**~8 of 53 rejections (15%) are at tiny repos** where PRs are unlikely to even be noticed.

## Root Cause Analysis

### Why is the merge rate so low?

1. **Gate bypasses are the #1 problem.** The dedup check, CLA check, star check, and feature check are all being bypassed — either by concurrent agents, cron jobs in isolated mode, or the agent simply not executing the checks.

2. **Duplicate submissions are the #2 problem.** 28% of rejections are the same fix submitted 2-5 times. The `pr-ledger.md` dedup and `gh search prs --author BillionClaw` checks are not working.

3. **Feature creep is the #3 problem.** 19% of rejections are features, not bug fixes. The title keyword reject gate and commit type gate are not enforced.

4. **CLA ignorance is the #4 problem.** 13% of rejections are at CLA repos. The CLA org list exists in every file but is not being checked.

## Comparison to Targets

| Metric | Target | Actual | Gap |
|--------|--------|--------|-----|
| Merge rate | 32.7% (industry avg) | 5.4% | **-27.3 pts** |
| Duplicate submission rate | 0% | 28% | **-28 pts** |
| Feature submission rate | 0% | 19% | **-19 pts** |
| CLA violation rate | 0% | 13% | **-13 pts** |

## What Would Merge Rate Be If Gates Worked?

If we eliminate the obvious gate failures:
- Remove 15 duplicate submissions: 53 - 15 = 38 unique rejections
- Remove 10 feature submissions: 38 - 10 = 28 valid rejections
- Remove 7 CLA violations: 28 - 7 = 21 rejections at valid repos
- Remove ~8 sub-200 star repos: 21 - 8 = 13 legitimate rejections

Adjusted: 3 merged / (3 + 13) = **18.8% merge rate** if gates worked.

Still below 32.7% industry average, but 3.5x better than current 5.4%.

## V9 Recommendations

1. **Fix dedup BEFORE removing rate limits.** Without working dedup, removing rate limits could make the duplicate submission problem even worse. The agent would submit even more duplicate PRs.

2. **Add a POST-SUBMIT dedup check.** After creating a PR, immediately check if we already have another open PR in the same repo. If so, close the older one.

3. **Make the commit type gate a HARD ABORT.** The `feat:` prefix check in subagent-implementation.md exists but clearly isn't being executed. Consider making it a pre-push git hook rather than an in-prompt instruction.

4. **Move CLA check to repo-health-check.sh.** Instead of relying on the agent to read an org list, have the health check script detect CLA bots from recent PR comments in the repo. This is more reliable than maintaining a list.

5. **Focus on the 3 repos that merged our PRs.** These are our proven winners:
   - jxlarrea/voice-satellite-card-integration
   - badlogic/pi-mono
   - manaflow-ai/cmux
   Return to these repos for new issues.
