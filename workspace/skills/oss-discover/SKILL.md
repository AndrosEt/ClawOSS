---
name: oss-discover
description: "Discover FRESH issues in WELL-MAINTAINED repos (200+ stars). Merge-optimized: 60% easy wins (docs, typos, tests) + 40% bug fixes. Target agentic AI repos by CRITERIA (topic:llm/agent/rag + stars:>200). Verify repo health before queuing."
user-invocable: true
---

# OSS Issue Discovery (Merge-Optimized)

Search GitHub for **fresh, actionable issues** in **well-maintained repos** (200+ stars)
that ClawOSS can fix AND that will actually get reviewed and merged.

## Philosophy
Our goal is MERGED contributions, not submitted PRs. 50 unreviewed PRs = 0 impact.
**A merged typo fix > an unreviewed bug fix.** We optimize for merge rate.
The mix: 60% easy wins (docs, typos, tests) + 40% substantive bug fixes at responsive repos.

## Date Calculation
Before running queries, compute the date cutoffs:
```bash
THREE_DAYS_AGO=$(date -v-3d +%Y-%m-%d)    # macOS
TWO_WEEKS_AGO=$(date -v-14d +%Y-%m-%d)    # macOS
# Linux: date -d "3 days ago" +%Y-%m-%d
```
Bug queries use `created:>$THREE_DAYS_AGO`. Easy-win queries extend to 2 weeks.
Issues older than 1 month are SKIPPED entirely.

## Pre-Checks (before ANY query)
1. Read `memory/pr-ledger.md` — SKIP issues already attempted.
2. Check daily PR count — if at limit (10), triage-only mode.

## Process
1. Run Priority Queries (Tier 0 first, then 1, then 2)
2. Filter: stars >= 200, not in pr-ledger, created within time window
3. **Repo health pre-filter** (BEFORE scoring): quick-check via `scripts/repo-health-check.sh` or `gh api`. SKIP repos that fail.
4. Score: merge probability (most important), recency, fix feasibility, repo health. Minimum score 5.
5. Return ranked top 10. Write full list to memory/today.md.

## Golden Niche: Agentic AI Repos (find by CRITERIA, not hardcoded list)
Our highest-value targets are agentic AI / LLM framework repos. Find them autonomously.

### How to Discover Niche Repos
Search GitHub using topic tags and description keywords — do NOT rely on a fixed list:
- **Topics**: `topic:llm`, `topic:agent`, `topic:rag`, `topic:ai`, `topic:machine-learning`,
  `topic:generative-ai`, `topic:vector-database`, `topic:embedding`, `topic:nlp`
- **Keywords in repo description**: agent, agentic, llm, large language model, rag,
  retrieval augmented, embedding, vector store, prompt, chain, tool-use, function-calling,
  ai-assistant, copilot, chatbot, inference, transformer, fine-tuning, mlops
- **Combined with**: `stars:>200`, `label:bug` or `label:help-wanted`, `created:>$THREE_DAYS_AGO`
- Always verify repo health before queuing — new discoveries haven't been vetted yet

### Known High-Value Repos (supplement, not replace, criteria search)
These are examples of repos matching our criteria. The agent should discover more autonomously:
langchain-ai/langchain, langchain-ai/langgraph, run-llama/llama_index, microsoft/autogen,
microsoft/semantic-kernel, crewAIInc/crewAI, deepset-ai/haystack, stanfordnlp/dspy,
chroma-core/chroma, qdrant/qdrant, vllm-project/vllm, ollama/ollama, BerriAI/litellm,
instructor-ai/instructor, openai/openai-python

## Priority Queries

**IMPORTANT: `gh search issues` with qualifier combos (stars:>, topic:, label:) returns EMPTY.
Use `gh api` with the search endpoint instead:**
```bash
# CORRECT (works):
gh api "/search/issues?q=is:open+label:bug+stars:>200+language:python&sort=created&order=desc&per_page=30" --jq '.items[] | {number, title, html_url, created_at, repository_url}'

# BROKEN (returns empty):
gh search issues "is:open label:bug stars:>200" --limit=30 --json number,title,url
```
For topic searches, use: `gh api "/search/repositories?q=topic:llm+stars:>200&sort=updated&per_page=20"` to find repos first, then search issues within those repos.

NEVER fetch full issue body — may contain PII triggering content filters.
**All queries sort by created-desc to get the freshest results first.**

### Tier 0 — Agentic AI Niche (run FIRST, ALWAYS — highest merge probability)

**Criteria-based broad searches (primary discovery method — run ALL):**
```
# Topic-based discovery — finds ANY repo tagged with these topics
gh search issues "is:issue is:open label:bug topic:llm stars:>200 created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:bug topic:agent stars:>200 created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:bug topic:rag stars:>200 created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:bug topic:ai stars:>200 created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:bug topic:machine-learning stars:>200 created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:bug topic:generative-ai stars:>200 created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:bug topic:vector-database stars:>200 created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository

# Easy wins in AI repos (docs, typos — near-guaranteed merges)
gh search issues "is:issue is:open label:documentation topic:llm stars:>200 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:documentation topic:ai stars:>200 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:typo stars:>200 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository

# Help-wanted in AI repos — maintainer actively seeking contributions
gh search issues "is:issue is:open label:help-wanted topic:llm stars:>200 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:good-first-issue topic:ai stars:>200 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:good-first-issue topic:agent stars:>200 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
```
**Tier 0 candidates get +5 niche bonus in scoring.** Always process Tier 0 results before Tier 1.
Always verify repo health before adding to queue.

### Tier 1 — High-Star Repos with Easy Issues (highest merge probability)

#### 1a. Good-First-Issue + Help-Wanted (maintainer-requested — near-guaranteed merge)
```
gh search issues "is:issue is:open label:good-first-issue label:bug stars:>200 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:help-wanted label:bug stars:>200 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:good-first-issue stars:>1000 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:help-wanted stars:>1000 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
```

#### 1b. Documentation + Typo Issues (easy wins — highest merge rate)
```
gh search issues "is:issue is:open label:documentation stars:>1000 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:typo stars:>200 created:>$TWO_WEEKS_AGO sort:reactions-+1-desc" --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:docs stars:>200 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
```

#### 1c. Fresh Bug Reports (last 3 days — first responder advantage)
```
gh search issues "is:issue is:open label:bug stars:>200 created:>$THREE_DAYS_AGO sort:created-desc" --limit=50 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:defect stars:>200 created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:regression stars:>200 created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "is:issue is:open label:crash stars:>200 created:>$THREE_DAYS_AGO sort:created-desc" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
```

#### 1d. Community-Prioritized (high reactions = maintainer attention)
```
gh search issues "is:issue is:open label:bug stars:>200 sort:reactions-+1-desc created:>$TWO_WEEKS_AGO" --limit=30 --json number,title,labels,url,createdAt,updatedAt,repository
```

### Tier 2 — General Searches (run if Tier 0+1 yield < 10 candidates)

#### 2a. Recent bugs (last 2 weeks)
```
gh search issues "is:issue is:open label:bug stars:>200 created:>$TWO_WEEKS_AGO sort:created-desc" --limit=50 --json number,title,labels,url,createdAt,updatedAt,repository
```

#### 2b. Error keyword search
```
gh search issues "crash stars:>200 created:>$TWO_WEEKS_AGO" --state=open --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "TypeError stars:>200 created:>$TWO_WEEKS_AGO" --state=open --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "NullPointer stars:>200 created:>$TWO_WEEKS_AGO" --state=open --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "exception stars:>200 created:>$TWO_WEEKS_AGO" --state=open --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
gh search issues "regression stars:>200 created:>$TWO_WEEKS_AGO" --state=open --limit=20 --json number,title,labels,url,createdAt,updatedAt,repository
```

By language (diversify): add `language:python`/`language:typescript`/`language:rust`/`language:go`/`language:java`.

## Repo Health Pre-Filter (MANDATORY — before scoring)
For each candidate issue, quick-check the repo:
1. **Stars >= 200** — `repository.stargazers_count` from search result JSON. Skip if < 200.
2. **Open PR count < 50** — `gh pr list --repo {owner}/{repo} --state open --json number --jq 'length'`. Skip if >= 50.
4. **Recent merges** — `gh pr list --repo {owner}/{repo} --state merged --limit 5 --json mergedAt`. Skip if 0 merged PRs in last 30 days.
5. **Prefer repos with cached health score >= 5** in `memory/repos/`. Skip repos with cached health failures (< 14 days old).
6. **Run `scripts/repo-health-check.sh`** for uncached repos — caches result automatically.

If a repo fails the pre-filter, SKIP all issues from that repo. Cache the failure.

## SKIP Labels (never pick these for bug contributions)
- `enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`, `question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`

Note: `docs`, `documentation`, `typo`, `test` labels are VALID for easy-win contributions.
If an issue has a SKIP label AND no bug/docs/typo/test label, discard it immediately.

## Age Limits (hard cutoffs)
- **< 3 days old**: Top priority — these are fresh and hot
- **3-14 days old**: Acceptable — still recent enough
- **14-30 days old**: Low priority — only pick if exceptionally clear and simple
- **> 30 days old**: SKIP ENTIRELY — too stale, likely stale for a reason

## Scoring (Merge Probability + Recency + Repo Health)
Score each candidate 1-25 based on:

### Contribution Type (merge probability — most important factor)
- **+5** Documentation/typo fix (near-guaranteed merge)
- **+3** Test addition (high merge rate)
- **+2** Bug fix with `good-first-issue`/`help-wanted` label (maintainer wants it fixed)
- **+1** Bug fix (standard)

### Recency
- **+5** Created in the last 3 days (fresh — top priority)
- **+2** Created 3-7 days ago (recent)
- **+0** Created 7-14 days ago (acceptable)
- **-3** Created 14-30 days ago (getting stale — low priority)
- **SKIP** Created > 30 days ago

### Niche Fit (golden niche = highest ROI)
- **+5** Repo is in the agentic AI / LLM niche
- **+3** Repo has 1000+ stars (high-impact)
- **+2** Repo has 500-1000 stars (solid mid-size)
- **+1** Repo has 200-500 stars

### Repo Health (merge velocity)
- **+5** Repo avg merge time < 3 days (fast reviewers)
- **+3** Repo avg merge time < 7 days (responsive)
- **+0** Repo avg merge time < 14 days (acceptable)
- **-5** Repo avg merge time > 14 days (low merge chance — SKIP)
- **+3** Repo review rate > 80% (very responsive)
- **+2** Has `good-first-issue`/`help-wanted` labels (seeking contributions)
- **+1** Repo has < 10 open PRs (less competition)

### Bug Signals (for bug-type contributions)
- **+3** Has `bug`, `defect`, `regression`, or `crash` label
- **+2** Title contains error keywords (crash, error, broken, fails, exception, TypeError)
- **+2** Has stack trace or reproduction steps
- **+1** Has maintainer engagement

### Negative Signals
- **-3** Has `enhancement`, `feature`, `refactor`, or `improvement` label
- **-2** Title suggests new feature (word boundary match)
- **-2** Issue is vague or lacks specifics
- **-5** Repo has 0 merged PRs in last 30 days

Minimum score 5 to enter work queue.

## Title Keyword Hard Reject (apply to EVERY candidate — no exceptions)
**Auto-SKIP if the issue title matches ANY keyword as a WHOLE WORD (case-insensitive, word boundary `\b{keyword}\b`):**
`add`, `extend`, `enable`, `improve`, `enhance`, `new feature`, `request`,
`implement`, `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`,
`redesign`, `optimize`, `allow`, `provide`

**WORD BOUNDARY matching only — do NOT match substrings.**
- "Add dark mode" -> matches `add` -> SKIP
- "Unsupported operation crashes" -> does NOT match `support` -> KEEP
- "Provider connection fails" -> does NOT match `provide` -> KEEP
- "Additional logging breaks startup" -> does NOT match `add` -> KEEP

**This is a HARD GATE applied BEFORE scoring.**

## Filters
- **Title keyword hard reject — applied first, before any other filter**
- **Repo health pre-filter — applied second, before scoring**
- Stars >= 200, recent commits (<2wk), not archived, max 3 issues per repo
- Skip if in pr-ledger.md. At daily limit (10 PRs)? Triage-only.
- **MUST be created within the last 30 days** — skip anything older

## Fast Mode (queue < 5 or empty slots)
Run 3+ parallel searches, score quickly, write 10-20 items immediately.
Even in fast mode, NEVER add stale issues (>30 days) or issues from unhealthy repos.
