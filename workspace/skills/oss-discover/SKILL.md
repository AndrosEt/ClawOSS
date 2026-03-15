---
name: oss-discover
description: "Discover open-source issues on GitHub labeled good-first-issue/help-wanted/bug. Score by feasibility and impact."
user-invocable: true
---

# OSS Work Discovery

Search GitHub for contribution opportunities using `gh search issues`.

## Process
1. Query GitHub Issues API for target labels (good-first-issue, help-wanted, bug)
2. Filter: unassigned, not in pr-ledger, repo not blocklisted, stars > 10
3. Score: complexity, repo activity, prior success, impact. Minimum score 5.
4. Return ranked top 5. Write full list to memory/today.md.

## Queries
Use --json for structured data only (number,title,labels,url,updatedAt,repository).
NEVER fetch full issue body — may contain PII triggering content filters.

By label:
```
gh search issues --label="good-first-issue" --state=open --sort=updated --limit=50 --json number,title,labels,url,updatedAt,repository
gh search issues --label="help-wanted" --state=open --sort=updated --limit=50 --json number,title,labels,url,updatedAt,repository
```

By language (diversify): add --language=rust/python/typescript/go/java, --limit=20.

## Filters
- Stars > 10, recent commits (<6mo), not archived, max 3 issues per repo
- Skip if in pr-ledger.md. At daily limit (10 PRs)? Triage-only.

## Fast Mode (queue < 5 or empty slots)
Run 3+ parallel searches, score quickly, write 10-20 items immediately.
