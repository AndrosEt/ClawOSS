---
name: oss-discover
description: "Discover open-source work: search GitHub for issues labeled good-first-issue, help-wanted, or bug across target repositories. Score and rank candidates by feasibility, impact, and prior success rate."
user-invocable: true
---

# OSS Work Discovery

Search GitHub for actionable open-source contribution opportunities.

## Process
1. Query GitHub Issues API via `gh` CLI for target labels
2. Filter by: unassigned, no prior failed attempts (check memory), repo not blocklisted
3. Score candidates: complexity (prefer small), repo activity, prior success rate, impact
4. Return ranked list with top 5 candidates
5. Write full candidate list to memory/today.md

## Content Filter Protection
When querying GitHub issues, use --json to get structured data only (number, title, labels, url, updatedAt).
NEVER fetch full issue body text — it may contain PII that triggers content filters.
If an issue title contains email/phone patterns, skip it.

## Discovery Queries (cast a WIDE net)
Search across ALL of GitHub, not just a few repos. Use --json for structured data only.

### By label (primary discovery)
```
gh search issues --label="good-first-issue" --state=open --sort=updated --limit=50 --json number,title,labels,url,updatedAt,repository
gh search issues --label="help-wanted" --state=open --sort=updated --limit=50 --json number,title,labels,url,updatedAt,repository
gh search issues --label="bug" --label="good-first-issue" --state=open --limit=30 --json number,title,labels,url,updatedAt,repository
```

### By topic (secondary discovery)
```
gh search issues "test coverage" --label="good-first-issue" --state=open --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues "documentation" --label="help-wanted" --state=open --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues "dependency update" --label="good-first-issue" --state=open --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues "security vulnerability" --label="good-first-issue" --state=open --limit=20 --json number,title,labels,url,updatedAt,repository
```

### By language (diversify across ecosystems)
```
gh search issues --label="good-first-issue" --state=open --language=rust --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues --label="good-first-issue" --state=open --language=python --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues --label="good-first-issue" --state=open --language=typescript --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues --label="good-first-issue" --state=open --language=go --limit=20 --json number,title,labels,url,updatedAt,repository
gh search issues --label="good-first-issue" --state=open --language=java --limit=20 --json number,title,labels,url,updatedAt,repository
```

## Repo Quality Filters
- Skip repos with < 10 stars
- Skip repos with no recent commits (>6 months)
- Skip archived repos
- Prefer repos with active maintainers (recent issue responses)
- Diversify: max 3 issues from the same repo per discovery cycle

## Scoring Criteria
- Estimated complexity (prefer small, well-defined tasks)
- Repo activity level (prefer active repos with responsive maintainers)
- Prior success rate with this repo (check memory)
- Potential impact (bug fixes > docs > refactors)
- Clear reproduction steps or acceptance criteria (required)

## Fast Mode (when filling slots urgently)
When work queue < 5 items or sub-agent slots are empty:
- Run 3+ parallel gh search queries across different languages
- Score quickly: stars > 10, updated < 6 months, not in pr-ledger = score 5+
- Write 10-20 items to work queue immediately
- Don't over-analyze — speed matters when slots are empty
- Prioritize repos you've already successfully contributed to (higher acceptance rate)

## Anti-Spam
Check memory/pr-ledger.md and memory/wake-state.md before selecting work.
If at daily PR limit (10), switch to triage-only mode.
Skip any issue that already appears in pr-ledger.md.
