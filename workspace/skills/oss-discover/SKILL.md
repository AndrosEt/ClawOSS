---
name: oss-discover
description: "Discover FRESH open-source BUG reports on GitHub (last 3 days). Prioritize labels: bug, defect, regression, crash, error. Score by recency, reproducibility, severity, and fix feasibility."
user-invocable: true
---

# OSS Bug Discovery

Search GitHub for **fresh bug reports** (created in the last 3 days) that ClawOSS can fix. We respond to bugs in near-real-time, not by picking through stale backlog.

## Philosophy
ClawOSS fixes fresh bugs deeply and comprehensively. Every search query targets the most recent bug reports — issues filed in the last 3 days get top priority. We want to be the first responder to bugs, delivering high-quality fixes while the issue is still hot. Feature requests, enhancements, and refactors are explicitly out of scope.

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
2. Filter: unassigned, not in pr-ledger, repo not blocklisted, stars > 10, IS A BUG, created within time window
3. Score: recency (most important), reproducibility, severity, fix feasibility. Minimum score 5.
4. Return ranked top 5. Write full list to memory/today.md.

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

### Tier 2 — Recent Bugs (last 2 weeks — run if Tier 1 yields < 10 candidates)
```
gh search issues "is:issue is:open label:bug created:>$TWO_WEEKS_AGO sort:created-desc" --limit=50 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:bug label:good-first-issue created:>$TWO_WEEKS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:bug label:help-wanted created:>$TWO_WEEKS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
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

## SKIP Labels (never pick these)
- `enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`, `question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`, `docs`, `documentation`

If an issue has ANY skip label AND no bug label, discard it immediately.

## Age Limits (hard cutoffs)
- **< 3 days old**: Top priority — these are fresh and hot
- **3-14 days old**: Acceptable — still recent enough
- **14-30 days old**: Low priority — only pick if exceptionally clear and simple
- **> 30 days old**: SKIP ENTIRELY — too stale, likely stale for a reason

## Scoring (Recency + Bug-Weighted)
Score each candidate 1-14 based on:

### Recency (most important factor)
- **+4** Created in the last 24 hours (hot bug)
- **+3** Created in the last 3 days (fresh bug)
- **+1** Created in the last 2 weeks (recent)
- **-2** Created 2-4 weeks ago (getting stale)
- **-5** Created > 1 month ago (SKIP — do not add to queue)

### Bug Signals
- **+3** Has a `bug`, `defect`, `regression`, or `crash` label
- **+2** Title contains error keywords (crash, error, fix, broken, fails, exception, TypeError, etc.)
- **+2** Has stack trace, error message, or reproduction steps in summary
- **+1** Repo has > 100 stars (high impact)
- **+1** Has `good-first-issue` or `help-wanted` label (maintainer wants help)

### Negative Signals
- **-3** Has `enhancement`, `feature`, `refactor`, or `improvement` label
- **-2** Title suggests new feature ("add", "implement", "support", "new")
- **-2** Issue is vague or lacks specifics ("improve X", "better Y")
- **-1** No reproduction steps or error details visible

Minimum score 5 to enter work queue.

## Filters
- Stars > 10, recent commits (<6mo), not archived, max 3 issues per repo
- Skip if in pr-ledger.md. At daily limit (10 PRs)? Triage-only.
- MUST be a bug report — not a feature request, not a refactor, not an improvement
- **MUST be created within the last 30 days** — skip anything older

## Fast Mode (queue < 5 or empty slots)
Run 3+ parallel fresh-bug searches, score quickly, write 10-20 items immediately.
Even in fast mode, NEVER add feature requests or stale issues (>30 days) to the queue.
