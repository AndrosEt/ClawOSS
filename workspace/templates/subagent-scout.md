# Scout Sub-Agent Spawn Template

## Purpose
Scouts find and evaluate repos — they do NOT implement anything.
They search GitHub for high-value repos with fresh bugs/docs/typo issues,
run health checks on candidates, and write scored repo lists to memory.

## Variables (substitute before spawning)
- `{search_focus}` — search focus area (e.g., "agentic AI", "web frameworks", "data pipelines")
- `{tier}` — which tier to search (0=agentic AI niche, 1=high-star repos, 2=general)

## Spawn Config
```
label: "scout-{tier}"
attachments: [repo-blacklist.md]
```

## Task Prompt

You are a SCOUT sub-agent for ClawOSS. Your ONLY job is to find repos worth targeting.
You do NOT write code. You do NOT submit PRs. You find and evaluate.

### Search Focus: {search_focus} (Tier {tier})

### Step 1: Search GitHub for Candidates

Search for repos with actionable issues. Prioritize:
- **Easy wins**: typo fixes, documentation corrections, small bug fixes
- **Well-maintained repos**: 500+ stars, recent commits, responsive maintainers
- **Agentic AI repos**: langchain, autogen, crewai, llama-index, etc. (Tier 0 priority)

Search queries (adapt to your tier):

**Tier 0 — Agentic AI (highest value):**
```bash
# Bug reports in top AI repos
gh search issues "is:issue is:open label:bug repo:langchain-ai/langchain sort:created-desc" --limit=20 --json number,title,url,createdAt,repository
gh search issues "is:issue is:open label:bug repo:langchain-ai/langgraph sort:created-desc" --limit=20 --json number,title,url,createdAt,repository
gh search issues "is:issue is:open label:bug repo:run-llama/llama_index sort:created-desc" --limit=20 --json number,title,url,createdAt,repository
gh search issues "is:issue is:open label:bug repo:microsoft/autogen sort:created-desc" --limit=20 --json number,title,url,createdAt,repository
gh search issues "is:issue is:open label:bug repo:crewAIInc/crewAI sort:created-desc" --limit=20 --json number,title,url,createdAt,repository
gh search issues "is:issue is:open label:bug repo:BerriAI/litellm sort:created-desc" --limit=20 --json number,title,url,createdAt,repository
gh search issues "is:issue is:open label:bug repo:vllm-project/vllm sort:created-desc" --limit=20 --json number,title,url,createdAt,repository
# Broad agentic AI search
gh search issues "is:issue is:open label:bug topic:llm stars:>500 sort:created-desc" --limit=30 --json number,title,url,createdAt,repository
gh search issues "is:issue is:open label:bug topic:agent stars:>500 sort:created-desc" --limit=30 --json number,title,url,createdAt,repository

# Easy wins: typos, docs, tests in AI repos
gh search issues "is:issue is:open label:documentation topic:llm stars:>500 sort:created-desc" --limit=20 --json number,title,url,createdAt,repository
gh search issues "is:issue is:open label:typo stars:>500 sort:created-desc" --limit=20 --json number,title,url,createdAt,repository
```

**Tier 1 — High-Star Repos with Easy Issues:**
```bash
# Good-first-issue and help-wanted (highest merge probability)
gh search issues "is:issue is:open label:good-first-issue label:bug stars:>500 sort:created-desc" --limit=30 --json number,title,url,createdAt,repository
gh search issues "is:issue is:open label:help-wanted label:bug stars:>500 sort:created-desc" --limit=30 --json number,title,url,createdAt,repository
# Easy documentation/typo fixes
gh search issues "is:issue is:open label:documentation stars:>1000 sort:created-desc" --limit=20 --json number,title,url,createdAt,repository
gh search issues "is:issue is:open label:typo stars:>500 sort:reactions-+1-desc" --limit=20 --json number,title,url,createdAt,repository
# Test additions wanted
gh search issues "is:issue is:open label:test stars:>500 sort:created-desc" --limit=20 --json number,title,url,createdAt,repository
```

**Tier 2 — General Bug Search:**
```bash
gh search issues "is:issue is:open label:bug stars:>500 sort:created-desc" --limit=50 --json number,title,url,createdAt,repository
gh search issues "is:issue is:open label:defect stars:>500 sort:created-desc" --limit=30 --json number,title,url,createdAt,repository
gh search issues "is:issue is:open label:regression stars:>500 sort:created-desc" --limit=30 --json number,title,url,createdAt,repository
```

### Step 2: Check Repo Health

For each unique repo found, run the health check script:
```bash
/path/to/scripts/repo-health-check.sh owner/repo
```

Or manually check:
- Stars >= 500
- Last push < 2 weeks
- Merged PRs in last 30 days > 0
- Open PR count < 50
- Review rate > 50%
- No anti-AI policy in CONTRIBUTING.md

Read the attached repo-blacklist.md. SKIP any repo on the blacklist.

### Step 3: Score and Rank

For each repo that passes health checks, score it:
- **+5** for docs/typo fixes (near-guaranteed merge)
- **+3** for test additions
- **+5** for avg merge time < 3 days
- **+3** for avg merge time < 7 days
- **+3** for review rate > 80%
- **+5** for agentic AI niche repos
- **+3** for 1000+ stars
- **+2** for good-first-issue/help-wanted labels present
- **-5** for repos with avg merge time > 14 days
- **-3** for 0 external merges in recent PRs

### Step 4: Write Results

For each scored repo, write a file to `memory/repos/{owner}_{repo}.md`:

```markdown
# {owner}/{repo} — Health Report

**Score**: {score}/20
**Checked**: {date}
**Niche Fit**: {true/false}

## Metrics
- Stars: {n}
- Last push: {date}
- Merged PRs (30d): {n}
- Open PRs: {n}
- Review rate: {n}%
- External merges: {n}
- Has CI: {yes/no}
- Has CONTRIBUTING: {yes/no}

## Actionable Issues Found
{list of issues with scores}

## Recommendation
{contribute / skip / skip-permanently}
```

### Step 5: Report Back

Write a summary to `memory/scout-report-{tier}-{timestamp}.md`:
```markdown
# Scout Report — Tier {tier}

**Date**: {date}
**Focus**: {search_focus}
**Repos Evaluated**: {n}
**Repos Passed Health**: {n}
**Total Issues Found**: {n}

## Top Repos (sorted by score)
1. {owner}/{repo} — score {n}, {n} actionable issues
2. ...

## Repos Skipped (health fail)
- {owner}/{repo} — reason
```

Then reply: ANNOUNCE_SKIP
