---
name: oss-discover
description: "Discover open-source BUG reports on GitHub. Prioritize labels: bug, defect, regression, crash, error. Score by reproducibility, severity, and fix feasibility."
user-invocable: true
---

# OSS Bug Discovery

Search GitHub for **bug reports** that ClawOSS can fix. We do NOT search for feature requests, enhancements, or refactoring opportunities.

## Bug-Fix-First Philosophy
ClawOSS exists to fix bugs. Every search query, every filter, and every scoring decision must prioritize confirmed bugs with clear reproduction steps, stack traces, or error messages. Feature requests, enhancements, and refactors are explicitly out of scope.

## Process
1. Query GitHub Issues API for bug-related labels (see Priority Queries below)
2. Filter: unassigned, not in pr-ledger, repo not blocklisted, stars > 10, IS A BUG (not a feature request)
3. Score: reproducibility, severity, fix feasibility, repo activity. Minimum score 5.
4. Return ranked top 5. Write full list to memory/today.md.

## Priority Queries (Bug-Focused)
Use --json for structured data only (number,title,labels,url,updatedAt,repository).
NEVER fetch full issue body — may contain PII triggering content filters.

### Tier 1 — Confirmed Bugs (run these FIRST, always)
```
gh search issues --label="bug" --state=open --sort=updated --limit=50 --json number,title,labels,url,updatedAt,repository
gh search issues --label="defect" --state=open --sort=updated --limit=30 --json number,title,labels,url,updatedAt,repository
gh search issues --label="regression" --state=open --sort=updated --limit=30 --json number,title,labels,url,updatedAt,repository
gh search issues --label="crash" --state=open --sort=updated --limit=30 --json number,title,labels,url,updatedAt,repository
gh search issues --label="error" --state=open --sort=updated --limit=30 --json number,title,labels,url,updatedAt,repository
gh search issues --label="bugfix" --state=open --sort=updated --limit=30 --json number,title,labels,url,updatedAt,repository
```

### Tier 2 — Bug-Adjacent (run if Tier 1 yields < 10 candidates)
```
gh search issues --label="bug" --label="good-first-issue" --state=open --sort=updated --limit=30 --json number,title,labels,url,updatedAt,repository
gh search issues --label="bug" --label="help-wanted" --state=open --sort=updated --limit=30 --json number,title,labels,url,updatedAt,repository
```

### Tier 3 — Keyword Search (run if Tier 1+2 yield < 10 candidates)
Search by error-related keywords in issue titles:
```
gh search issues "crash" --state=open --sort=updated --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues "TypeError" --state=open --sort=updated --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues "NullPointer" --state=open --sort=updated --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues "exception" --state=open --sort=updated --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues "regression" --state=open --sort=updated --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues "broken" --state=open --sort=updated --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues "fails" --state=open --sort=updated --limit=20 --json number,title,labels,url,updatedAt,repository
```

By language (diversify): add --language=rust/python/typescript/go/java, --limit=20.

## SKIP Labels (never pick these)
- `enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`, `question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`, `docs`, `documentation`

If an issue has ANY skip label AND no bug label, discard it immediately.

## Scoring (Bug-Weighted)
Score each candidate 1-10 based on:
- **+3** Has a `bug`, `defect`, `regression`, or `crash` label
- **+2** Title contains error keywords (crash, error, fix, broken, fails, exception, TypeError, etc.)
- **+2** Has stack trace, error message, or reproduction steps in summary
- **+1** Repo has > 100 stars (high impact)
- **+1** Updated in last 30 days (active issue)
- **+1** Has `good-first-issue` or `help-wanted` label (maintainer wants help)
- **-3** Has `enhancement`, `feature`, `refactor`, or `improvement` label
- **-2** Title suggests new feature ("add", "implement", "support", "new")
- **-2** Issue is vague or lacks specifics ("improve X", "better Y")
- **-1** No reproduction steps or error details visible

Minimum score 5 to enter work queue.

## Filters
- Stars > 10, recent commits (<6mo), not archived, max 3 issues per repo
- Skip if in pr-ledger.md. At daily limit (10 PRs)? Triage-only.
- MUST be a bug report — not a feature request, not a refactor, not an improvement

## Fast Mode (queue < 5 or empty slots)
Run 3+ parallel bug-label searches, score quickly, write 10-20 items immediately.
Even in fast mode, NEVER add feature requests to the queue.
