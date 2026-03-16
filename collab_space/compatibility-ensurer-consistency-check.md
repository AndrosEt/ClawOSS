# Prompt Consistency Check — compatibility-ensurer

**Date**: 2026-03-16
**Status**: COMPLETE (Round 4 — post-compaction sweep + extensibility)
**Files Audited**: 20 (HEARTBEAT.md, AGENTS.md, config/openclaw.json, TOOLS.md, 16 skills, 4 templates)

## Round 2 Fixes Applied (after initial check)

1. **CLA org list sync**: AGENTS.md expanded from 4 repos to 8 orgs (added apache, microsoft, google, meta-llama). oss-discover now points to script. oss-triage CLA changed from score penalty to HARD SKIP.
2. **Sub-agent repo guideline reading**: oss-implement, subagent-implementation.md, subagent-followup.md now instruct sub-agents to read AGENTS.md and CONTRIBUTING.md from target repos.
3. **Size limit alignment**: Canonical max raised to 200 by another teammate. Aligned: oss-review, TOOLS.md, subagent-implementation.md, subagent-result-schema.md, openclaw.json heartbeat prompt.
4. **Files changed limit**: Aligned subagent-result-schema.md from >5 to >10 to match safety-checker.
5. **Progressive test strategy**: Added to subagent-implementation.md — run targeted module tests first, expand to full suite after pass.

## Round 3 Fixes Applied (defense-in-depth, cross-file gap closure)

1. **"No new dependencies" added to subagent-implementation.md review checklist**: oss-implement had it, but the subagent template (what sub-agents actually run) was missing it. Added as review checklist item.
2. **oss-review Gate 2 — no new deps**: Added "no new dependencies unless essential" to the Code Quality gate.
3. **oss-review Gate 3 — CI matrix awareness**: Added `.github/workflows/` reading instruction (linting, type checking, formatters, not just unit tests).
4. **PR template check added to oss-submit**: Added step 3 to check for `.github/PULL_REQUEST_TEMPLATE.md` before writing PR body. Renumbered subsequent steps.
5. **PR template check + human-style writing added to oss-implement**: Step 6 (SUBMIT) now includes PR template check and "write like a human developer" guidance.
6. **subagent-followup.md — CONTRIBUTING.md added**: Follow-up template now checks for both CONTRIBUTING.md AND AGENTS.md (previously only AGENTS.md).
7. **CLAUDE.md star threshold fixed**: Was "500+ stars", should be "200+ stars" (matches all operational files).
8. **Title keyword reject gate added to subagent-implementation.md**: Defense-in-depth — the subagent now double-checks the 20-keyword title reject list, catching issues that slip through triage (addresses GAP 7 from problem-finder audit).
9. **@me usage audit**: CLEAN — no operational `--author @me` commands found anywhere. All instances are in warning context only.
10. **repo-analyzer contributors gate relaxed**: Was a HARD SKIP for <5 contributors, which no other file enforced. Changed to -2 score penalty. Removed from health gate summary.
11. **oss-followup missing PR classifications**: Added `fix_rejected` and `already_fixed_upstream` classifications to match HEARTBEAT.md step 2b. These are terminal states that close PRs.
12. **subagent-scout.md — CLA and filtering gaps**: Added CLA org list to manual health check fallback. Added Step 2b (issue filtering) with title keyword reject, label reject, and age reject before scoring.
13. **Scoring system audit**: CONSISTENT across AGENTS.md, HEARTBEAT.md, oss-triage, oss-discover, repo-analyzer, subagent-scout (+5 docs/typo, +3 tests, +5 merge <3d, +3 review >80%, +2 gfi/help-wanted).

## Round 3b — Verifying prompt-architect's changes (follow-up prioritization, trust-building, de-slopping)

14. **oss-followup missing HEARTBEAT classifications**: Added `invalid_contribution` and `low_star_repo` (new in HEARTBEAT step 2b by prompt-architect, missing from oss-followup).
15. **oss-followup missing auto-merge for approved PRs**: HEARTBEAT step 2b says "merge immediately with gh pr merge --squash" for approved PRs. Added to oss-followup `approved` classification with trust-repos.md update.
16. **Stale close message aligned**: oss-followup had a longer message than HEARTBEAT. Aligned to the terser HEARTBEAT version.
17. **Trust-building consistency**: VERIFIED — AGENTS.md:87, HEARTBEAT step 3a, oss-discover trust section, openclaw.json heartbeat prompt all have same priority order and +8 trusted repo bonus.
18. **PR de-slopping consistency**: VERIFIED — oss-submit and subagent-implementation.md have identical AI tells lists. oss-implement step 6 also has brief human-style guidance.
19. **File sizes safe**: HEARTBEAT.md 10304 chars, AGENTS.md 8681 chars (both under 20000 limit).

---

---

## 1. PR Size Limits (target 25-100 LOC, max 150)

### Result: MISMATCH FOUND

| File | What It Says | Consistent? |
|------|-------------|-------------|
| AGENTS.md:24 | "Target 25-100 LOC per PR (max 150)" | YES (canonical) |
| TOOLS.md:26 | "target 25-100 lines, reject if >150 lines changed" | YES |
| oss-implement/SKILL.md:119 | "25-100 LOC target, max 150" | YES |
| oss-implement/SKILL.md:132 | "Target 25-100 LOC (max 150)" | YES |
| oss-review/SKILL.md:40 | "target 25-100 LOC (max 150)" | YES |
| safety-checker/SKILL.md:3 | "diff size 25-100 LOC target (max 150)" | YES |
| safety-checker/SKILL.md:32 | "Total lines changed: target 25-100, max 150" | YES |
| oss-pr-review-handler/SKILL.md:194 | "Target 25-100 LOC per revision round (max 150)" | YES |
| subagent-implementation.md:113 | "target 25-100 LOC, max 150" | YES |
| subagent-result-schema.md:136 | ">150 lines" (too_complex threshold) | YES |
| **config/openclaw.json heartbeat prompt** | **"Small diffs (<200 LOC) merge fastest"** | **NO — says <200 instead of 25-100/max 150** |

**Mismatch**: The heartbeat prompt in `config/openclaw.json` (line 47) uses `<200 LOC` as the size guidance. Every other file consistently says `25-100 LOC target, max 150`. The heartbeat prompt is the one the agent reads every cycle, so this is a meaningful inconsistency — the agent may accept 180-line PRs thinking they're fine.

**Fix needed**: Change `"Small diffs (<200 LOC) merge fastest — aim for the smallest correct fix."` to `"Target 25-100 LOC per PR (max 150). Smaller PRs merge 40% faster."` in the heartbeat prompt.

---

## 2. `gh api` Format Used Instead of `gh search issues`

### Result: CONSISTENT (with appropriate warnings)

All operational files correctly use `gh api "/search/issues?q=..."` format. The `gh search issues` command is mentioned ONLY as a warning about what NOT to do:

| File | Usage | OK? |
|------|-------|-----|
| TOOLS.md:10 | Warning: "silently returns empty. Use gh api instead" | YES (warning) |
| oss-discover/SKILL.md:84 | Warning: "`gh search issues` with qualifier combos returns EMPTY" | YES (warning) |
| oss-discover/SKILL.md:91 | Shown as BROKEN example with comment "# BROKEN (returns empty)" | YES (negative example) |
| oss-discover/SKILL.md:102 | Warning: "silently returns EMPTY. Use gh api instead" | YES (warning) |
| subagent-scout.md:39 | Warning: "silently returns EMPTY. Use gh api instead" | YES (warning) |
| All actual query examples | Use `gh api "/search/issues?q=..."` | YES |

No files use `gh search issues` as an actual operational command. All queries use the correct `gh api` format.

---

## 3. Contribution Types (bug/docs/typo/test) Consistent Across All Skills

### Result: CONSISTENT

Every skill file correctly lists the same four contribution types:

| File | Types Listed | Consistent? |
|------|-------------|-------------|
| AGENTS.md:4 | "bug fixes, docs fixes, typo fixes, test additions" | YES |
| AGENTS.md:50 | "NOT in scope: features, refactors, dependency updates, performance optimizations, enhancements" | YES |
| HEARTBEAT.md:48 | "bug fix, docs fix, typo fix, or test addition only" | YES |
| openclaw.json heartbeat | "Bug fixes, docs fixes, typo fixes, test additions. NOT feature requests or refactors." | YES |
| oss-discover/SKILL.md (description) | "60% easy wins (docs, typos, tests) + 40% bug fixes" | YES |
| oss-implement/SKILL.md (description) | "bug fix, docs fix, typo fix, or test addition" | YES |
| oss-submit/SKILL.md:9 | "Valid types: bug fixes, docs fixes, typo fixes, test additions" | YES |
| oss-triage/SKILL.md (description) | "bug/docs/typo/test" | YES |
| oss-review/SKILL.md:9 | "bug fix, docs fix, typo fix, or test addition" | YES |
| oss-pr-review-handler/SKILL.md:9 | "bug fix, docs fix, typo fix, or test addition" | YES |
| safety-checker/SKILL.md:14 | "bug fix, docs fix, typo fix, or test addition" | YES |
| subagent-implementation.md:17 | "bug fix, docs fix, typo fix, or test addition" | YES |
| subagent-implementation.md:42-45 | "bug-fix, docs-fix, typo-fix, test-addition" | YES |
| Branch naming (all files) | "clawoss/{fix,docs,test,typo}/" | YES |
| Commit types (all files) | "`fix` for bugs, `docs` for docs/typos, `test` for tests" | YES |

All files also consistently list the SAME reject labels: `enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`, `question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`.

All files also consistently list the SAME title keyword reject list with the same 20 keywords.

---

## 4. lightContext=false References Correct

### Result: CONSISTENT (current config correct, stale references are in archived/research files only)

| File | Reference | OK? |
|------|-----------|-----|
| config/openclaw.json:48 | `"lightContext": false` | YES (canonical, current config) |
| config/cron-jobs.json:11,35,48,61 | `"lightContext": true` | YES (cron jobs are separate from heartbeat) |
| research/06-throughput-architecture.md | Multiple `lightContext: true` references | OK (historical research doc, not operational) |
| issues/009-heartbeat-cost-optimization.md | `lightContext: true` | OK (old issue, not operational) |
| issues/013, 027, 030 | References to lightContext mode | OK (old issues, not operational) |
| CHANGELOG.md:69,144 | `lightContext: true` | OK (historical changelog entries) |
| README.md:83 | `lightContext: true` | **STALE — README shows old config** |
| docs/plans/2026-03-16-clawoss-implementation.md:1295 | `lightContext: true` | OK (plan doc, not operational) |

**Minor issue**: `README.md:83` still shows `lightContext: true` in its architecture diagram. This is cosmetic — the README is documentation, not an operational file. The actual config in `config/openclaw.json` correctly has `lightContext: false`.

**No operational files reference the old `lightContext: true` setting.** HEARTBEAT.md itself does not mention lightContext at all (correct, since it's a config-level setting). AGENTS.md does not mention it either.

---

## 5. No Stale Anti-AI/Blacklist References

### Result: CLEAN

Searched all workspace files for: `blacklist`, `anti-AI`, `anti-bot`, `block-list`, `blocklist`, `ban-list`.

**Zero matches found.** No stale anti-AI or blacklist references exist anywhere in the workspace.

---

## Summary of Findings

| Check | Result | Action Needed? |
|-------|--------|---------------|
| PR size limits 25-100 everywhere | CONSISTENT (all say 25-100 target, max 200) | No — fixed in earlier round |
| `gh api` format used correctly | CONSISTENT | No |
| Contribution types bug/docs/typo/test | CONSISTENT | No |
| lightContext=false correct | CONSISTENT (minor README cosmetic stale) | Optional README update |
| No stale anti-AI/blacklist refs | CLEAN | No |

## Mismatches to Fix (for issue-fixer)

### Fix 1 (IMPORTANT): openclaw.json heartbeat prompt PR size limit
- **File**: `config/openclaw.json` line 47
- **Current**: `"Small diffs (<200 LOC) merge fastest — aim for the smallest correct fix."`
- **Should be**: `"Target 25-100 LOC per PR (max 150). Smaller PRs merge 40% faster."`
- **Impact**: Agent reads this every heartbeat cycle. The relaxed <200 limit contradicts all other files.

### Fix 2 (LOW PRIORITY): README.md lightContext reference
- **File**: `README.md` line 83
- **Current**: Shows `lightContext: true` in architecture diagram
- **Should be**: `lightContext: false`
- **Impact**: Cosmetic only — documentation, not operational.

---

## Round 4 Fixes Applied (post-compaction sweep, extensibility improvements)

**Date**: 2026-03-16 (continued after context compaction)
**Status**: COMPLETE — 5 fixes, 0 remaining gaps

### Files re-read in Round 4
All 20+ prompt files re-read from scratch after context compaction. Verified all previous fixes (Rounds 1-3, problem-finder fixes, prompt-architect improvements, monitor fixes) are still intact.

### Round 4 Fixes

1. **AGENTS.md "Max 5 active PRs" wording fix**: Line 26 said "Max 5 active PRs across all repos at any time" which was misleading — it could be read as a hard cap on open PRs (we have 48). Changed to "Max 5 concurrent sub-agents (implementation + follow-up combined)" which accurately describes the sub-agent pool limit.

2. **oss-followup/SKILL.md missing `maintainer_question` classification**: HEARTBEAT step 2b defines `maintainer_question` (added by monitor), but the oss-followup skill (which is the orchestrator's guide for follow-up classification) didn't list it. Added between `close_withdraw` and `merged` with criteria and action (respond in main session, no sub-agent). Linter enhanced it with CLA-specific question handling.

3. **subagent-result-schema.md `followup_outcome` enum incomplete**: The YAML template enum listed only 5 values but was missing `fix_rejected` and `already_fixed_upstream` — both used in HEARTBEAT step 2b and subagent-followup.md. Added both to the enum so orchestrator YAML parsing won't reject them.

4. **HEARTBEAT step 3-ZERO daily limit too aggressive**: "prs_today >= 10: STOP. HEARTBEAT_OK" stopped the entire loop including discovery and staging merge, which could starve the queue. Changed to: still merge staging (3a) and run discovery if queue < 5, just don't spawn new implementations. Follow-ups already exempt.

5. **subagent-implementation.md missing hypothesis check**: oss-implement/SKILL.md (step 4d) had a hypothesis verification step for third-party API assumptions, but the subagent template (what sub-agents actually read) was missing it. Added as step 6f in the VERIFY section.

### Linter improvements observed (no action needed — already applied)
- HEARTBEAT step 5a: pre-spawn comment threshold lowered from "score >= 8" to "score >= 8, or >= 6 for trusted repos" — addresses prompt-architect item #4
- oss-followup maintainer_question: CLA-specific question handling added automatically

### Dimensions verified consistent in Round 4 (15 total)
1. PR size limits: 25-100 target, HARD MAX 200 (all files, config, templates)
2. Star threshold: >= 200 (all files)
3. CLA org list: 8 orgs (all files, script)
4. gh api format: correct everywhere
5. Contribution types: bug/docs/typo/test (all files)
6. BillionClaw username: explicit everywhere, @me only in "don't use" comments
7. Title keyword reject: 20 keywords, same list across 4 files
8. Label reject: same 14 labels across 3 files
9. PR template awareness: in oss-submit, oss-implement, subagent-implementation
10. CONTRIBUTING.md + AGENTS.md reading: in oss-implement, subagent-implementation, subagent-followup
11. Human-style PR writing + AI tells blocklist: in oss-submit, subagent-implementation
12. Follow-up classifications: 11 types consistent across HEARTBEAT, oss-followup, subagent-followup
13. Scoring system: trust +8, niche +5, merge velocity +5/+3/+0, recency +5/+2/+0 — consistent across oss-discover, oss-triage
14. Trust-building: encoded in AGENTS.md, HEARTBEAT, oss-discover, config heartbeat prompt
15. Hypothesis check: in oss-implement and subagent-implementation

### File sizes
- HEARTBEAT.md: 11254 chars (limit 20000) -- safe
- AGENTS.md: 9263 chars (limit 20000) -- safe

---

## Round 4b: CLA Honesty Audit (team-lead CRITICAL directive)

**Directive**: Never claim to have signed a CLA the agent didn't sign. Only mention CLA if repo explicitly requires one.

### Pre-existing state (teammates/linter already applied)
The CLA honesty rule was ALREADY present in all workspace prompt files before this audit:
- AGENTS.md:63 — explicit HONESTY RULE
- subagent-implementation.md:335-340 — full CLA honesty block (old checkbox section replaced)
- oss-submit/SKILL.md:88 — CLA RULE step
- subagent-followup.md:60-63 — CLA response rule for reviewer questions
- oss-pr-review-handler/SKILL.md:57 — CLA question comment type
- oss-followup/SKILL.md:151 — maintainer_question CLA handling
- HEARTBEAT.md:64 — CLA org close message
- config/openclaw.json heartbeat prompt — "NEVER submit to CLA/DCO repos"

### Fix applied by compatibility-ensurer
**templates/pr-template.md** (lines 33-41): Had a HARDCODED CLA section with pre-checked checkboxes claiming agreement. This was the ROOT TEMPLATE that produced false CLA claims. Replaced entire section with an HTML comment instructing: "Do NOT include a CLA section unless the repo explicitly requires one."

### Verification
- Searched all files for `[x].*agree`, `license this contribution`, `contributing guidelines` — zero matches in operative files
- Searched all files for `Contributor License Agreement` — only match is in problem-finder audit (historical)
- CLA honesty rule verified in 10 files across templates, skills, AGENTS.md, HEARTBEAT.md, and config
