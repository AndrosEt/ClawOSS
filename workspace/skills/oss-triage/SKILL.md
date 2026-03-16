---
name: oss-triage
description: "Triage GitHub bug reports: confirm it's a real bug (not a feature request), assess reproducibility, estimate fix complexity, check repo health (merge velocity, review rate). REJECT non-bug issues and issues in unhealthy repos."
user-invocable: true
---

# OSS Bug Triage (Merge-Optimized)

Assess GitHub issues for contribution feasibility. **Only bugs in healthy repos pass triage.**
Feature requests, refactors, enhancements, and issues in abandoned/unresponsive repos are rejected immediately.

## Step 0: Bug Gate (MANDATORY — do this FIRST)
Before any other assessment, determine if this is a genuine bug report.

### 0a. Title Keyword Hard Reject (FIRST CHECK — no exceptions)
**Auto-SKIP if the issue title matches ANY keyword as a WHOLE WORD (case-insensitive, word boundary `\b{keyword}\b`):**
`add`, `extend`, `enable`, `improve`, `document`, `enhance`, `new feature`, `request`,
`implement`, `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`,
`redesign`, `optimize`, `allow`, `provide`

**WORD BOUNDARY matching only — do NOT match substrings.**
- "Add dark mode" -> matches `add` -> SKIP
- "Unsupported operation crashes" -> does NOT match `support` -> KEEP
- "Provider connection fails" -> does NOT match `provide` -> KEEP
- "Document parser throws TypeError" -> does NOT match `document` as substring -> KEEP

**This is a HARD GATE. No override by labels, score, or any other factor.**
These keywords indicate feature requests, enhancements, or refactors — not bugs.
Write "SKIP: title keyword reject — title contains '[keyword]'" and move on.

### 0b. Label Hard Reject
**Auto-SKIP if labeled with ANY of these:**
`enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`,
`question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`,
`docs`, `documentation`

If the issue has ANY of these labels AND no `bug`/`defect`/`regression`/`crash` label, SKIP.
Write "SKIP: non-bug label — has '[label]'" and move on.

### 0c. Bug Confirmation
**IS a bug** (proceed to Step 0d):
- Reports incorrect behavior ("X does Y but should do Z")
- Contains error messages, stack traces, or crash logs
- Describes a regression ("X worked in v1.2 but broke in v1.3")
- Has reproduction steps showing something is broken
- Reports data corruption, incorrect output, or unexpected exceptions
- Labeled `bug`, `defect`, `regression`, `crash`, `error`

**NOT a bug** (SKIP immediately):
- Requests new functionality
- Asks for improvements without describing broken behavior
- Proposes refactoring or architectural changes
- Discussion/RFC/proposal issues
- Documentation improvements (unless documenting incorrect behavior)
- Performance optimizations without a concrete correctness bug
- No concrete broken behavior described anywhere in the issue

If the issue fails the Bug Gate, write "SKIP: not a bug — [reason]" and move on. Do NOT proceed further.

### 0d. Repo Health Gate (MANDATORY — check BEFORE scoring)
**We only contribute to repos that will actually review and merge our work.**

Quick-check the repo health (use cached results from `memory/repos/` if available and < 7 days old):

```bash
# 1. Last commit — SKIP if no commits in 2 weeks
gh api repos/{owner}/{repo} --jq '.pushed_at'

# 2. Merge velocity — SKIP if avg > 14 days or 0 merges in 30 days
gh pr list --repo {owner}/{repo} --state merged --json mergedAt,createdAt --limit 10

# 3. Review rate — SKIP if < 50% of PRs get review
gh pr list --repo {owner}/{repo} --state all --json comments,reviews --limit 20

# 4. Open PR backlog — SKIP if 50+ open PRs
gh pr list --repo {owner}/{repo} --state open --json number --jq 'length'

# 5. Stars + contributors — SKIP if < 50 stars or < 5 contributors
gh api repos/{owner}/{repo} --jq '.stargazers_count'
```

**HARD SKIP if ANY of these are true:**
- No commits in last 2 weeks
- 0 merged PRs in last 30 days
- Avg merge time > 14 days
- Review rate < 50%
- 50+ open PRs
- < 50 stars or < 5 contributors

Write "SKIP: repo health gate failed — {reason}" and cache the result.

## Step 1: Read & Analyze
1. Read issue body and all comments thoroughly
2. Check labels and metadata
3. Look for bug indicators:
   - Stack traces or error logs (strong signal)
   - "Expected vs actual" descriptions (strong signal)
   - Reproduction steps (strong signal)
   - Regression reports with version numbers (strong signal)
   - Screenshots showing broken UI/behavior (moderate signal)

## Step 2: Assess Complexity
- **Simple**: single-file fix, clear repro steps, well-defined scope, obvious root cause
- **Medium**: 2-5 files, requires understanding component interactions, but bug is reproducible
- **Complex**: architectural changes, cross-cutting concerns, unclear root cause, hard to reproduce

## Step 3: Evaluate Feasibility
1. Check memory for similar past issues or prior attempts
2. Evaluate success probability based on:
   - Bug clarity and specificity (has repro steps? has stack trace?)
   - Repo's CI/test infrastructure quality (can we run tests?)
   - Our prior track record with this repo
   - Whether the expected behavior is clearly defined
   - Whether existing tests cover the area (easier to verify fix)

## Step 4: Completeness Check
Before approving a bug for implementation, assess whether we can **fully resolve** it:
- Can the bug be completely fixed, not just partially addressed?
- Is the scope clear enough that we'll know when it's done?
- **If the bug is too complex to fix completely: SKIP it.** A partial fix is worse than no fix — it wastes maintainer review time and may cause confusion.
- One excellent, complete fix is worth more than five shallow ones.

## Bug Quality Score
Score each bug 1-20:

### Recency (most important)
- **+5** Created in the last 3 days (fresh — we're first responders)
- **+2** Created 3-7 days ago (recent)
- **+0** Created 7-14 days ago (acceptable)
- **-3** Created 14-30 days ago (getting stale — low priority)
- **SKIP** Created > 30 days ago (do NOT attempt — too stale)

### Repo Health (merge probability — from step 0d)
- **+5** Repo avg merge time < 3 days (fast reviewers — highest merge chance)
- **+3** Repo avg merge time < 7 days (responsive)
- **+0** Repo avg merge time < 14 days (acceptable)
- **-5** Repo avg merge time > 14 days (should have been filtered at 0d)
- **+3** Repo review rate > 80% (very responsive maintainers)
- **-3** Repo review rate 50-60% (barely passing)

### Bug Signals
- **+3** Has clear reproduction steps
- **+2** Has stack trace or error message
- **+2** Has "expected vs actual" description
- **+1** Labeled `bug` or `defect` by maintainer (confirmed bug)
- **+1** Has maintainer engagement (comments from repo owners)
- **+1** Repo has good CI/test infrastructure
- **+2** Has `good-first-issue` or `help-wanted` label (maintainers seeking help)

### Negative Signals
- **-2** Vague description, no repro steps
- **-2** Might be a feature request disguised as a bug
- **-2** Bug seems too complex to fully resolve (would result in partial fix)
- **-1** Repo has history of rejecting external PRs
- **-5** Repo has 0 merged PRs in last 30 days (should have been filtered)
- **-3** Repo has 30+ open PRs (reviewer overwhelmed)

Minimum score 5 to attempt.

## Decision
- **Attempt**: Simple/medium bugs with score >= 5, in healthy repos (merge time < 14d, review rate > 50%), created recently (< 2 weeks), clear repro steps, can be FULLY resolved, high fix probability
- **Skip**: Non-bugs, stale issues (> 1 month), complex issues that can't be fully resolved, unclear requirements, unhealthy repos (0 merges in 30d, 50+ open PRs, < 50 stars), score < 5
- **Defer**: Medium bugs that need more context — revisit after learning more about repo (but only if < 2 weeks old)

## Output
Write triage assessment to memory with:
- Issue URL, repo, complexity rating
- Bug Gate result: PASS (confirmed bug) or FAIL (not a bug)
- **Repo Health Gate result: PASS or FAIL (with reason)**
- **Repo health metrics: merge velocity, review rate, open PR count**
- Issue age and recency assessment
- Completeness assessment: can this be fully resolved? (yes/no/uncertain)
- Bug quality score with breakdown
- Recommended action (attempt/skip/defer)
- Reasoning for the decision
