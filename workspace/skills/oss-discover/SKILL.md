---
name: oss-discover
description: "Discover FRESH open-source BUG reports in WELL-MAINTAINED repos (last 3 days). Optimize for MERGED PRs: target repos with fast review cycles, responsive maintainers, and <50 open PRs. Score by recency, reproducibility, severity, and repo health."
user-invocable: true
---

# OSS Bug Discovery (Merge-Optimized)

Search GitHub for **fresh bug reports** (created in the last 3 days) in **well-maintained repos**
that ClawOSS can fix AND that will actually get reviewed and merged.

## Philosophy
Our goal is MERGED bug fixes, not submitted PRs. 50 unreviewed PRs = 0 impact.
We target repos with responsive maintainers and fast merge cycles. Every search query
targets the most recent bug reports in repos that will actually review our work.
Feature requests, enhancements, and refactors are explicitly out of scope.

## Date Calculation
Before running queries, compute the date cutoffs:
```bash
THREE_DAYS_AGO=$(date -v-3d +%Y-%m-%d)    # macOS
TWO_WEEKS_AGO=$(date -v-14d +%Y-%m-%d)    # macOS
# Linux: date -d "3 days ago" +%Y-%m-%d
```
All Tier 1 queries use `created:>$THREE_DAYS_AGO`. Tier 2 extends to 2 weeks. Issues older than 1 month are SKIPPED entirely.

## Process
1. Query GitHub Issues API for bug-related labels with `created:>` date filter (see Priority Queries)
2. Filter: unassigned, not in pr-ledger, repo not blocklisted, stars >= 50, IS A BUG, created within time window
3. **Repo health pre-filter** (BEFORE scoring): quick-check each candidate's repo health. SKIP repos that fail.
4. Score: recency (most important), reproducibility, severity, fix feasibility, **repo health**. Minimum score 5.
5. Return ranked top 5. Write full list to memory/today.md.

## Priority Queries (Fresh Bugs First)
Use --json for structured data only (number,title,labels,url,createdAt,updatedAt,repository).
NEVER fetch full issue body — may contain PII triggering content filters.
**All queries sort by created-desc to get the freshest bugs first.**

### Tier 1 — Fresh Confirmed Bugs (last 3 days — run these FIRST, always)
```
gh search issues "is:issue is:open label:bug created:>$THREE_DAYS_AGO sort:created-desc" --limit=50 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:defect created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:regression created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:crash created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:error created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:bugfix created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
```

### Tier 1b — Community-Prioritized Bugs (high reactions = maintainer attention)
```
gh search issues "is:issue is:open label:bug sort:reactions-+1-desc created:>$TWO_WEEKS_AGO" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
```
Issues with many thumbs-up reactions get more maintainer attention — higher chance of quick review.

### Tier 1c — Maintainer-Requested Help (highest merge probability)
```
gh search issues "is:issue is:open label:bug label:help-wanted created:>$TWO_WEEKS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:bug label:good-first-issue created:>$TWO_WEEKS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
```
`help-wanted` and `good-first-issue` signals: maintainers are actively seeking contributions. These have the highest merge probability.

### Tier 2 — Recent Bugs (last 2 weeks — run if Tier 1 yields < 10 candidates)
```
gh search issues "is:issue is:open label:bug created:>$TWO_WEEKS_AGO sort:created-desc" --limit=50 --json number,title,labels,url,createdAt,updatedAt,repository
```

### Tier 3 — Keyword Search (run if Tier 1+2 yield < 10 candidates)
Search by error-related keywords, still filtered to recent:
```
gh search issues "crash created:>$TWO_WEEKS_AGO" --state=open --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "TypeError created:>$TWO_WEEKS_AGO" --state=open --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "NullPointer created:>$TWO_WEEKS_AGO" --state=open --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "exception created:>$TWO_WEEKS_AGO" --state=open --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "regression created:>$TWO_WEEKS_AGO" --state=open --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "broken created:>$TWO_WEEKS_AGO" --state=open --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "fails created:>$TWO_WEEKS_AGO" --state=open --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
```

By language (diversify): add `language:rust`/`language:python`/`language:typescript`/`language:go`/`language:java` to the search query.

## Repo Health Pre-Filter (MANDATORY — before scoring)
For each candidate issue, quick-check the repo:
1. **Stars >= 50** — `repository.stargazers_count` from search result JSON. Skip if < 50.
2. **Open PR count < 50** — `gh pr list --repo {owner}/{repo} --state open --json number --jq 'length'`. Skip if >= 50.
3. **Recent merges** — `gh pr list --repo {owner}/{repo} --state merged --limit 5 --json mergedAt`. Skip if 0 merged PRs in last 30 days.
4. **Prefer repos where our PR would be one of few open PRs** — less competition for reviewer attention.
5. **Prefer repos with cached health score >= 5** in `memory/repos/`. Skip repos with cached health failures (< 14 days old).

If a repo fails the pre-filter, SKIP all issues from that repo. Do not score them.
Cache the failure so we don't re-check on the next cycle.

## SKIP Labels (never pick these)
- `enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`, `question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`, `docs`, `documentation`

If an issue has ANY skip label AND no bug label, discard it immediately.

## Age Limits (hard cutoffs)
- **< 3 days old**: Top priority — these are fresh and hot
- **3-14 days old**: Acceptable — still recent enough
- **14-30 days old**: Low priority — only pick if exceptionally clear and simple
- **> 30 days old**: SKIP ENTIRELY — too stale, likely stale for a reason

## Scoring (Recency + Repo Health + Bug Signals)
Score each candidate 1-20 based on:

### Recency (most important factor)
- **+5** Created in the last 3 days (fresh bug — top priority)
- **+2** Created 3-7 days ago (recent)
- **+0** Created 7-14 days ago (acceptable)
- **-3** Created 14-30 days ago (getting stale — low priority)
- **SKIP** Created > 30 days ago (do NOT add to queue — too stale)

### Repo Health (merge probability)
- **+5** Repo avg merge time < 3 days (fast reviewers — highest merge chance)
- **+3** Repo avg merge time < 7 days (responsive)
- **+0** Repo avg merge time < 14 days (acceptable)
- **-5** Repo avg merge time > 14 days or unknown (low merge chance — SKIP if possible)
- **+3** Repo review rate > 80% (very responsive maintainers)
- **-3** Repo review rate < 50% (maintainers not reviewing — should have been filtered)
- **+2** Has `good-first-issue` or `help-wanted` label (maintainers seeking contributions)
- **+1** Repo has < 10 open PRs (less competition for reviewer attention)

### Bug Signals
- **+3** Has a `bug`, `defect`, `regression`, or `crash` label
- **+2** Title contains error keywords (crash, error, fix, broken, fails, exception, TypeError, etc.)
- **+2** Has stack trace, error message, or reproduction steps in summary
- **+1** Has `good-first-issue` or `help-wanted` label (maintainer wants help)

### Negative Signals
- **-3** Has `enhancement`, `feature`, `refactor`, or `improvement` label
- **-2** Title suggests new feature ("add", "implement", "support", "new" — word boundary match)
- **-2** Issue is vague or lacks specifics ("improve X", "better Y")
- **-1** No reproduction steps or error details visible
- **-5** Repo has 0 merged PRs in last 30 days (dead — should have been filtered)

Minimum score 5 to enter work queue.

## Title Keyword Hard Reject (apply to EVERY candidate — no exceptions)
**Auto-SKIP if the issue title matches ANY keyword as a WHOLE WORD (case-insensitive, word boundary `\b{keyword}\b`):**
`add`, `extend`, `enable`, `improve`, `document`, `enhance`, `new feature`, `request`,
`implement`, `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`,
`redesign`, `optimize`, `allow`, `provide`

**WORD BOUNDARY matching only — do NOT match substrings.**
- "Add dark mode" -> matches `add` -> SKIP
- "Unsupported operation crashes" -> does NOT match `support` -> KEEP
- "Provider connection fails" -> does NOT match `provide` -> KEEP
- "Additional logging breaks startup" -> does NOT match `add` -> KEEP

**This is a HARD GATE applied BEFORE scoring.** These keywords indicate feature requests,
enhancements, or refactors — not bugs. DISCARD matches. Do not add to queue. Do not score.

## Filters
- **Title keyword hard reject (above) — applied first, before any other filter**
- **Repo health pre-filter — applied second, before scoring**
- Stars >= 50, recent commits (<2wk), not archived, max 3 issues per repo
- Skip if in pr-ledger.md. At daily limit (10 PRs)? Triage-only.
- MUST be a bug report — not a feature request, not a refactor, not an improvement
- **MUST be created within the last 30 days** — skip anything older

## Fast Mode (queue < 5 or empty slots)
Run 3+ parallel fresh-bug searches, score quickly, write 10-20 items immediately.
Even in fast mode, NEVER add feature requests, stale issues (>30 days), or issues from unhealthy repos to the queue.
