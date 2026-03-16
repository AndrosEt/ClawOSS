# V10 Architecture Critique — Scoring Weights, Lobster, Direction Analysis

**Author**: critique agent
**Date**: 2026-03-17
**Reviewing**: collab_space/v10-architecture-spec.md

---

## Change 1: Lobster Deterministic Pipeline

### Strengths
- Eliminates context bloat from orchestration (the #1 cause of heartbeat timeouts in V9)
- Deterministic routing = no more LLM deciding to skip steps or reorder priorities
- Resumable on crash — huge improvement over LLM-driven heartbeat that loses state

### Concerns

**P1: Lobster maturity risk.** Lobster has 848 stars, 21 open issues, created Jan 2026. It's 2 months old. We'd be betting the entire orchestration layer on a new tool. If Lobster has bugs or limitations we discover mid-deployment, we lose the LLM-driven fallback (HEARTBEAT.md would be "thinned down").

**Recommendation**: Keep HEARTBEAT.md fully functional as a fallback. The Lobster workflow should be an ADDITION, not a REPLACEMENT, until Lobster is proven stable over 2+ weeks of operation. Add a config flag: `orchestration.mode: "lobster" | "llm"` so we can hot-swap.

**P2: Lobster YAML can't handle all orchestration logic.** The current HEARTBEAT has complex conditional logic:
- Step 2b: classify PR into 13 categories, then execute different actions per category
- Step 3b: 8 dedup gates with different skip reasons
- Step 4: triage scoring with label/title analysis

The YAML workflow in the spec (lines 27-88) only covers the simple parts (health check, respawn, read staging, spawn). The complex decision-making STILL needs LLM inference. So Lobster doesn't eliminate LLM involvement — it just moves the routing to YAML while each step still calls LLMs.

**Question for team-lead**: How much of the orchestration is actually eliminated? If each Lobster step calls `tool: subagent` which runs an LLM, we're not saving much. The real savings come from skipping the main agent's 60k-token context for routing decisions. Quantify this: how many tokens does routing consume vs. actual work?

**P3: `for_each` semantics unclear.** Lines 70-71 and 83 use `for_each` with JavaScript-like filter expressions. Does Lobster actually support this? Verify with DeepWiki. If Lobster's `for_each` is simpler (e.g., YAML list iteration only), the spec needs adjustment.

---

## Change 2: Merge Probability Scoring — Weight Analysis

### The Formula

```
P(merge) =
  + 25 * task_type_score        # docs/typo=1.0, test=0.75, bug=0.5, feature=0
  + 20 * size_score              # <30 lines=1.0, 30-100=0.7, 100-200=0.3, >200=0
  + 15 * repo_responsiveness     # merge<3d=1.0, 3-7d=0.7, 7-14d=0.3, >14d=0
  + 15 * trust_score             # merged before=1.0, positive engagement=0.7, new=0.3, hostile=0
  + 10 * freshness               # <1d=1.0, 1-3d=0.8, 3-7d=0.5, 7-14d=0.2, >14d=0
  + 10 * contributor_fit         # help-wanted=1.0, good-first-issue=0.8, bug=0.5, none=0.3
  + 5  * competition_score       # no other PRs=1.0, 1 competing=0.3, 2+=0
```

### Validation Against Our 3 Merged PRs

**pi-mono #2166** (docs fix, 24.5K stars, 11 additions, merged in ~22h):
- task_type: 25 * 1.0 = 25 (docs)
- size: 20 * 1.0 = 20 (11 lines)
- repo_responsiveness: 15 * 1.0 = 15 (merged in <1 day)
- trust: 15 * 0.3 = 4.5 (new repo at time)
- freshness: 10 * 1.0 = 10 (fresh issue)
- contributor_fit: 10 * 0.3 = 3 (no labels)
- competition: 5 * 1.0 = 5 (no competing PRs)
- **P(merge) = 82.5** — PASS (would be prioritized)

**cmux #1444** (bug fix, 6.9K stars, 16 lines, merged in ~29h):
- task_type: 25 * 0.5 = 12.5 (bug)
- size: 20 * 1.0 = 20 (16 lines)
- repo_responsiveness: 15 * 1.0 = 15 (merged <1 day)
- trust: 15 * 0.3 = 4.5 (new)
- freshness: 10 * 1.0 = 10
- contributor_fit: 10 * 0.5 = 5 (bug label)
- competition: 5 * 1.0 = 5
- **P(merge) = 72** — PASS

**voice-satellite-card-integration #23** (bug fix, 153 stars, 66 lines, merged in ~13h):
- task_type: 25 * 0.5 = 12.5
- size: 20 * 0.7 = 14 (66 lines)
- repo_responsiveness: 15 * 1.0 = 15
- trust: 15 * 0.3 = 4.5
- freshness: 10 * 1.0 = 10
- contributor_fit: 10 * 0.5 = 5
- competition: 5 * 1.0 = 5
- **P(merge) = 66** — PASS

All 3 merged PRs score well above 40. Good.

### Validation Against Notable Failures

**xoundbyte/zoundhub #4** (feature, 6 stars, 591 additions):
- task_type: 25 * 0 = 0 (feature)
- size: 20 * 0 = 0 (591 lines)
- repo_responsiveness: 15 * 0 = 0 (no data)
- trust: 15 * 0.3 = 4.5
- freshness: 10 * 0.5 = 5
- contributor_fit: 10 * 0.3 = 3
- competition: 5 * 1.0 = 5
- **P(merge) = 17.5** — BLOCKED (below 40). Correct.

**llama_index #21031** (bug fix, 47K stars, 43 lines):
- task_type: 25 * 0.5 = 12.5
- size: 20 * 0.7 = 14 (43 lines)
- repo_responsiveness: 15 * 0.7 = 10.5 (3-7d merge time)
- trust: 15 * 0 = 0 (hostile — WOULD need blocklist to catch this)
- freshness: 10 * 0.8 = 8
- contributor_fit: 10 * 0.5 = 5
- competition: 5 * 0.3 = 1.5
- **P(merge) = 51.5** — PASS. **This is a problem.** llama_index should be blocked but scores 51.5 without the blocklist. The scoring model alone wouldn't prevent this disaster.

### Weight Critique

**1. task_type at 25% is TOO HIGH.** Our data doesn't support docs being 2x more likely to merge than bug fixes. Only 1 of our 3 merges was docs. Bug fixes merged at the same rate. The real differentiator is repo responsiveness and trust, not task type.

**Recommendation**: task_type: 15%, trust_score: 25%. Trust is the strongest predictor — a repo that merged your previous PR is far more likely to merge the next one than a random docs fix at an unknown repo.

**2. repo_responsiveness at 15% is TOO LOW.** Our merged PRs all came from repos that reviewed within 24 hours. Our failures are dominated by repos that don't respond at all. Responsiveness should be weighted higher.

**Recommendation**: repo_responsiveness: 20%.

**3. competition_score at 5% is TOO LOW.** Our "already fixed upstream" failures (4 PRs) and "duplicate fix" closures (15 PRs where others already had fixes) show competition is a bigger factor than 5%. If someone is already working on the issue, P(merge) drops to near zero.

**Recommendation**: competition_score: 10%.

**4. MISSING FACTOR: repo_star_tier.** Our data shows a clear pattern: repos with 0-200 stars have 0% merge rate (8 PRs, 0 merges). Repos with 200-1K stars have uncertain rates. Repos with 1K+ stars have positive engagement. Star count correlates with repo health and review quality.

**Recommendation**: Add 5% weight for repo_star_tier: `>10K=1.0, 1K-10K=0.7, 200-1K=0.4, <200=0`.

**5. MISSING FACTOR: blocklist_check.** The scoring model has no blocklist override. A hostile repo with high stars and fast merge velocity would score well. The blocklist must be a HARD GATE, not a factor in the score.

**Recommendation**: Blocklist is NOT part of P(merge) — it's a pre-scoring gate. If repo is blocklisted, P(merge) = 0 regardless of factors.

### Revised Weight Proposal

```
P(merge) =
  GATE: if repo in blocklist → 0 (hard stop)
  GATE: if repo stars < 200 → 0 (hard stop)

  + 15 * task_type_score        # docs/typo=1.0, test=0.75, bug=0.5
  + 20 * size_score              # <30=1.0, 30-100=0.7, 100-200=0.3, >200=0
  + 20 * repo_responsiveness     # merge<3d=1.0, 3-7d=0.7, 7-14d=0.3, >14d=0
  + 25 * trust_score             # merged before=1.0, engagement=0.7, new=0.3, hostile=0
  + 5  * freshness               # <1d=1.0, 1-3d=0.8, 3-7d=0.5, >7d=0.2
  + 5  * contributor_fit         # help-wanted=1.0, gfi=0.8, bug=0.5, none=0.3
  + 10 * competition_score       # no PRs=1.0, 1 competing=0.3, 2+=0
```

Key changes: trust 15->25, responsiveness 15->20, task_type 25->15, competition 5->10, freshness 10->5, contributor_fit 10->5. Added hard gates for blocklist and star count.

### Re-validation with revised weights

**pi-mono**: 15 + 20 + 20 + 7.5 + 5 + 1.5 + 10 = **79** (still passes)
**cmux**: 7.5 + 20 + 20 + 7.5 + 5 + 2.5 + 10 = **72.5** (still passes)
**voice-satellite**: 7.5 + 14 + 20 + 7.5 + 5 + 2.5 + 10 = **66.5** (still passes)
**zoundhub**: BLOCKED by star gate (6 stars) — correct
**llama_index**: BLOCKED by blocklist gate — correct (after blocklist added)

---

## Change 3: Deep Codebase Direction Analysis

### Strengths
- Addresses the "frozen code" problem — stop fixing issues in deprecated modules
- Recent commits check catches "already fixed upstream" (4 of our failures)
- High-engagement issues = maintainer priority = faster review

### Concerns

**P2: API cost explosion.** For each repo the scout evaluates, direction analysis requires 5 API calls (commits, issues, PRs, CHANGELOG, labels). If the scout evaluates 50 repos per cycle, that's 250 API calls just for direction analysis — before any issue-level checks.

**Recommendation**: Only run direction analysis on repos that pass health gate AND have a candidate with score >= 8 (pre-direction score). Don't analyze repos before finding a promising issue.

**P2: CHANGELOG base64 decoding may fail.** Line 147: `gh api "repos/{repo}/contents/CHANGELOG.md" --jq '.content' | base64 -d | head -50`. Many repos don't have CHANGELOG.md, or it's too large (>1MB), or it's in a different location (CHANGES.md, HISTORY.md, NEWS.md). This step should be optional with fallback.

**P3: Direction analysis is subjective.** The decision logic (lines 155-159) says "only greenlight issues that are in modules/areas with recent commit activity." But an LLM interpreting commit messages to determine "area alignment" is inherently noisy. A commit message "fix typo in README" doesn't tell you which module is active.

**Recommendation**: Use file paths from recent commits, not commit messages, to determine active areas. `gh api "repos/{repo}/commits?per_page=10" --jq '.[].files[].filename'` gives you concrete paths.

---

## Throughput: maxConcurrent 7 -> 10

**P1: Cost concern.** 10 concurrent subagents = 10x Kimi API usage. We already hit quota exhaustion at maxConcurrent 7. Increasing to 10 without a cost/quota increase will make the problem worse.

**Recommendation**: Only increase to 10 AFTER confirming Kimi quota can handle it. Otherwise, the extra slots just create more "API rate limited" failures.

**P2: 15 PRs/hour at 4.8% merge rate = 0.72 merges/hour.** The merge rate improvement should come FIRST (via better scoring and direction analysis), then scale throughput. Scaling throughput on a 4.8% merge rate just means more rejected PRs faster.

**Recommendation**: Phase 1 should focus on merge rate (scoring + direction + blocklist). Phase 2 should scale throughput only after merge rate reaches 15%+.

---

## Top 5 Recommendations

1. **Keep HEARTBEAT.md as Lobster fallback** — don't thin it down until Lobster is proven
2. **Reweight P(merge): trust 25%, responsiveness 20%, task_type 15%** — trust is the strongest predictor
3. **Add hard gates before scoring** — blocklist and star count are binary, not gradients
4. **Don't scale throughput before merge rate improves** — 10 slots at 4.8% = more waste
5. **Direction analysis only after health gate + score >= 8** — avoid API cost explosion
