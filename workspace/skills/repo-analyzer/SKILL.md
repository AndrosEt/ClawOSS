---
name: repo-analyzer
description: "Analyze repo health and conventions BEFORE queuing any issue. MANDATORY health gate: stars >=500, last commit <2wk, merge time <14d, review rate >50%, open PRs <50. Use scripts/repo-health-check.sh for automation."
user-invocable: true
---

# Repository Analyzer

**We only contribute to repos that will actually review and merge our work.**
The repo health gate is MANDATORY — run it BEFORE any other analysis.

## Quick Check (use the script)
For fast automated health checks, run:
```bash
scripts/repo-health-check.sh {owner}/{repo}
```
Exit 0 = healthy, exit 1 = skip. Outputs JSON with metrics and composite score.

## Repo Health Gate (run FIRST — before queuing ANY issue)

These checks determine whether the repo is worth our tokens. A repo that fails
the health gate wastes resources — PRs go unreviewed, unmerged, zero impact.

### 1. Last Commit Date (activity check)
```bash
gh api repos/{owner}/{repo} --jq '.pushed_at'
```
- **SKIP** if no commits in the last 2 weeks — repo is inactive/abandoned

### 2. PR Merge Velocity (how fast do PRs get merged?)
```bash
gh pr list --repo {owner}/{repo} --state merged --json mergedAt,createdAt --limit 10
```
- Calculate average days from created to merged for the last 10 merged PRs
- **SKIP** if avg merge time > 14 days — too slow, our PR will sit for weeks
- **SKIP** if zero merged PRs in the last 30 days — repo is not merging anything
- **+5 score** if avg merge time < 3 days (fast reviewers)
- **+3 score** if avg merge time < 7 days (responsive)
- **+0 score** if avg merge time < 14 days (acceptable)

### 3. Maintainer Responsiveness (do PRs get reviewed?)
```bash
gh pr list --repo {owner}/{repo} --state all --json comments,reviews,createdAt --limit 20
```
- Count what % of the last 20 PRs received at least one review comment or review
- **SKIP** if < 50% of PRs get any review — maintainers are not reviewing
- **+3 score** if > 80% of PRs get review comments (very responsive)
- **-3 score** if 50-60% review rate (barely passing)

### 4. Open PR Backlog (is the repo overwhelmed?)
```bash
gh pr list --repo {owner}/{repo} --state open --json number --jq 'length'
```
- **SKIP** if 50+ open PRs — the repo is overwhelmed, our PR will be buried
- **SKIP** if 30+ open PRs AND avg merge time > 7 days — queue is growing, not draining

### 5. Stars + Contributors (is this an established project?)
```bash
gh api repos/{owner}/{repo} --jq '{stars: .stargazers_count}'
gh api repos/{owner}/{repo}/contributors --jq 'length'
```
- **SKIP** if < 500 stars — low-impact repo, not worth our time (raised from 50)
- **SKIP** if < 5 contributors — bus-factor risk, single maintainer may vanish

### 6. Niche Fit (golden niche = agentic AI repos)
Our highest-value targets are agentic AI / LLM framework repos. Check repo description and topics:
```bash
gh api repos/{owner}/{repo} --jq '{description: .description, topics: .topics}'
```
A repo is in the golden niche if its name, description, or topics match any of:
- **Repo names**: langchain, langgraph, llama-index, autogen, crewai, semantic-kernel,
  haystack, dspy, instructor, magentic, openai, anthropic, ollama, vllm, litellm,
  chromadb, weaviate, qdrant, milvus, pinecone, lancedb
- **Keywords**: agent, agentic, llm, large language model, rag, retrieval augmented,
  embedding, vector store, prompt, chain, tool-use, function-calling, ai-assistant,
  copilot, chatbot, inference, transformer, fine-tuning, mlops
- **Topics**: `llm`, `agent`, `ai`, `machine-learning`, `nlp`, `langchain`, `rag`,
  `vector-database`, `embedding`, `generative-ai`

Scoring:
- **+3 score** if repo is in the golden niche (agentic AI)
- **+3 score** if repo has 5000+ stars (very high-impact)
- **+2 score** if repo has 1000+ stars (high-impact)
- **+1 score** if repo has 500-1000 stars (medium impact)

Set `niche_fit: true/false` in the output. Niche repos get priority in the work queue.

### 7. Bot-Friendly Signals (does the repo welcome contributions?)
Check for presence of:
- `CONTRIBUTING.md` — **+1 score** (they've documented how to contribute)
- `.github/ISSUE_TEMPLATE/` or issue templates — **+1 score** (organized)
- `.github/workflows/` or CI config — **+1 score** (automated testing)
- Active issue labeling (> 50% of recent issues have labels) — **+1 score**
- `good-first-issue` or `help-wanted` labels in use — **+2 score** (actively seeking contributions)

### Health Gate Summary
A repo **MUST pass ALL** of these to be eligible:
1. Stars >= 500
2. Last commit within 2 weeks
3. Avg merge time < 14 days AND at least 1 merged PR in last 30 days
4. Review rate > 50%
5. Open PR count < 50
6. Contributors >= 5

**If ANY check fails: SKIP the repo entirely. Do not queue any issues from it.**
Write "SKIP: repo health gate failed — {reason}" and cache the result.

### Repo Health Score (1-16)
Sum the bonus scores from checks 2, 3, 6, 7 above:
- **12-16**: Excellent — prioritize issues from this repo (likely a golden niche repo)
- **8-11**: Good — standard priority
- **5-7**: Marginal — only pick exceptionally clear bugs
- **1-4**: Poor — skip (should have been caught by health gate)

**Niche repos (agentic AI) with health score >= 8 get PRIORITY in the work queue.**
When choosing between two issues of similar quality, always prefer the one from a niche repo.

## Process (after health gate passes)
1. Clone repo to /tmp/clawoss-workdir/<repo-name>/ (shallow clone)
2. Read contribution docs:
   - CONTRIBUTING.md
   - CODE_OF_CONDUCT.md
   - .github/PULL_REQUEST_TEMPLATE.md
   - .github/ISSUE_TEMPLATE/ (check for bug report templates)
3. Detect tech stack:
   - package.json, Cargo.toml, go.mod, pyproject.toml, etc.
4. Detect code style:
   - .editorconfig, .eslintrc, .prettierrc, rustfmt.toml, etc.
5. Detect test framework:
   - jest, pytest, go test, cargo test, etc.
6. Detect CI system:
   - .github/workflows/, .circleci/, Jenkinsfile, etc.
7. Check memory for cached repo conventions (skip re-analysis if recent)
8. Store repo analysis + health score in memory for reuse

## Output
Repo profile containing:
- **Repo health score** (1-16) and individual check results
- **Niche fit**: true/false — is this repo in the agentic AI / LLM golden niche?
- **Merge velocity**: avg days to merge, merged PRs in last 30 days
- **Review rate**: % of PRs that get review comments
- **Open PR backlog**: current count
- **Merge probability**: high (health >= 12 or niche + health >= 8) / medium (5-11) / low (< 5)
- Tech stack and language
- Code style configuration
- Test command to run
- Lint command to run
- CI expectations and required checks
- PR conventions and template
- Any special contribution requirements
- **Recommendation**: contribute / skip / skip-permanently (with reason)

## Caching
Cache repo health results in `memory/repos/{owner}_{repo}.md` for 7 days.
Re-run health check if cache is older than 7 days.
If a repo was previously skipped due to health gate failure, do NOT re-check
for 14 days (they won't improve that fast).
