---
name: oss-triage
description: "Triage GitHub issues: confirm contribution type (bug/docs/typo/test), assess feasibility, check repo health (merge velocity, review rate). Merge-optimized scoring: +5 docs/typo, +3 tests, +5 fast merge repos. REJECT issues in unhealthy repos."
user-invocable: true
---

# OSS Issue Triage (Merge-Optimized)

Assess GitHub issues for contribution feasibility. **Optimize for merge probability.**
A merged typo fix > an unreviewed bug fix. Issues in abandoned/unresponsive repos
are rejected immediately. We accept bug fixes, docs fixes, typo fixes, and test additions.

## Step 0: Pre-Checks (MANDATORY — do these FIRST)

### 0a. Title Keyword Hard Reject (FIRST CHECK — no exceptions)
**Auto-SKIP if the issue title matches ANY keyword as a WHOLE WORD (case-insensitive, word boundary `\b{keyword}\b`):**
`add`, `extend`, `enable`, `improve`, `enhance`, `new feature`, `request`,
`implement`, `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`,
`redesign`, `optimize`, `allow`, `provide`

**WORD BOUNDARY matching only — do NOT match substrings.**
- "Add dark mode" -> matches `add` -> SKIP
- "Unsupported operation crashes" -> does NOT match `support` -> KEEP
- "Provider connection fails" -> does NOT match `provide` -> KEEP
- "Document parser throws TypeError" -> does NOT match `document` as substring -> KEEP

**This is a HARD GATE. No override by labels, score, or any other factor.**

### 0b. Label Hard Reject
**Auto-SKIP if labeled with ANY of these:**
`enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`,
`question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`

If the issue has ANY of these labels AND no `bug`/`defect`/`regression`/`crash`/`docs`/`documentation`/`typo`/`test` label, SKIP.

### 0c. Repo Health Gate (MANDATORY — check BEFORE spending triage tokens)
**We only contribute to repos that will actually review and merge our work.**

Run `scripts/repo-health-check.sh {owner}/{repo}` or quick-check via `gh api`
(use cached results from `memory/repos/` if available and < 7 days old):

```bash
# 1. Stars — SKIP if < 200
gh api repos/{owner}/{repo} --jq '.stargazers_count'

# 2. Last commit — SKIP if no commits in 2 weeks
gh api repos/{owner}/{repo} --jq '.pushed_at'

# 3. Merge velocity — SKIP if avg > 14 days or 0 merges in 30 days
gh pr list --repo {owner}/{repo} --state merged --json mergedAt,createdAt --limit 10

# 4. Review rate — SKIP if < 50% of PRs get review
gh pr list --repo {owner}/{repo} --state all --json comments,reviews --limit 20

# 5. Open PR backlog — SKIP if 50+ open PRs
gh pr list --repo {owner}/{repo} --state open --json number --jq 'length'
```

**HARD SKIP if `scripts/repo-health-check.sh` exits 1.** The script checks (with tiered thresholds for large repos):
- Stars < 200
- No commits in last 2 weeks
- 0 merged PRs in last 30 days
- Avg merge time exceeds limit (14d for <5000 stars, 30d for 5000+)
- Review rate below minimum (50% for <5000 stars, 30% for 5000+)
- Open PRs exceed limit (50 for <5000 stars, 500 for 5000+, 1000 for 20000+)
- Anti-bot/anti-AI policy in CONTRIBUTING.md
- Forking disabled
- Note: Automatable CLAs (CLA-assistant, DCO) are allowed. Non-automatable CLAs (apache, microsoft, google, meta-llama) are hard-skipped.

Write "SKIP: repo health gate failed — {reason}" and cache the result.

### 0d. Dedup Check
Run `gh search prs --author BillionClaw --repo {owner}/{repo} --state open --json number --jq 'length'`.
If > 0, SKIP: "already have an active PR on this repo — focus on follow-ups instead."

### 0e. Supersession Check (CRITICAL — prevents wasted cycles)
Before scoring, check if someone else is already working on this issue:

```bash
# Check for linked PRs (other contributors already submitted fixes)
LINKED_OPEN=$(gh api "repos/{owner}/{repo}/issues/{number}/timeline" --jq '[.[] | select(.event=="cross-referenced") | .source.issue | select(.pull_request != null and .state == "open")] | length' 2>/dev/null || echo 0)
if [ "$LINKED_OPEN" -gt 0 ]; then
  echo "SKIP: issue already has $LINKED_OPEN open linked PR(s)"
  exit 0
fi

# Check if issue is assigned
ASSIGNEE_COUNT=$(gh api "repos/{owner}/{repo}/issues/{number}" --jq '.assignees | length' 2>/dev/null || echo 0)
if [ "$ASSIGNEE_COUNT" -gt 0 ]; then
  echo "SKIP: issue is assigned to someone"
  exit 0
fi
```

```bash
# Check if issue is already closed
ISSUE_STATE=$(gh api "repos/{owner}/{repo}/issues/{number}" --jq '.state' 2>/dev/null || echo "open")
if [ "$ISSUE_STATE" = "closed" ]; then
  echo "SKIP: issue is already closed"
  exit 0
fi

# Check if a recently merged PR already fixes this issue
RECENT_FIXES=$(gh pr list --repo {owner}/{repo} --state merged --limit 20 --json title,body \
  --jq "[.[] | select(.body != null and (.body | test(\"#{number}\"; \"i\")) or .title != null and (.title | test(\"#{number}\"; \"i\")))] | length" 2>/dev/null || echo 0)
if [ "$RECENT_FIXES" -gt 0 ]; then
  echo "SKIP: issue #{number} appears already fixed in $RECENT_FIXES recently merged PR(s)"
  exit 0
fi
```

If linked PRs, assignees, closed state, or recent fixes found, SKIP with reason `superseded`, `assigned`, or `already_fixed_upstream`. Mark in pr-ledger.md so we don't re-check.

## Step 1: Contribution Type Assessment

Determine the contribution type (in order of merge probability):

### Documentation/Typo Fix (highest merge probability)
- Issue describes incorrect/outdated documentation
- Issue reports typos in code, docs, comments, or error messages
- Has labels: `docs`, `documentation`, `typo`
- These are near-guaranteed merges and should be prioritized

### Test Addition (high merge probability)
- Issue requests tests for uncovered code paths
- Has labels: `test`, `testing`, `test-coverage`
- Tests that demonstrate existing bugs are especially valuable

### Bug Fix (standard merge probability)
- Reports incorrect behavior ("X does Y but should do Z")
- Contains error messages, stack traces, or crash logs
- Describes a regression ("X worked in v1.2 but broke in v1.3")
- Has reproduction steps showing something is broken
- Has labels: `bug`, `defect`, `regression`, `crash`, `error`

### NOT a Valid Contribution (SKIP)
- Requests new functionality
- Asks for improvements without describing a concrete change
- Proposes refactoring or architectural changes
- Discussion/RFC/proposal issues
- Performance optimizations without a correctness bug
- No concrete actionable change described

If not a valid contribution type: "SKIP: not actionable — [reason]". Do NOT proceed.

## Step 2: Read & Analyze
1. Read issue body and all comments thoroughly
2. Check labels and metadata
3. Look for actionability signals:
   - For bugs: stack traces, error logs, reproduction steps, "expected vs actual"
   - For docs: specific incorrect content identified, correct content known
   - For typos: specific location of typo identified
   - For tests: specific code path identified, test approach clear

## Step 3: Assess Complexity
- **Simple**: single-file fix, clear scope, obvious fix
- **Medium**: 2-5 files, requires understanding component interactions
- **Complex**: architectural changes, cross-cutting concerns, unclear approach

For docs/typo fixes, almost everything is **Simple**.
For test additions, most are **Simple** to **Medium**.

## Step 4: Completeness Check
Can we FULLY resolve this in a clean, mergeable PR?
- For bug fixes: Can the bug be completely fixed? Is the scope clear?
- For docs fixes: Is the correct information known? Can we verify it?
- For typo fixes: Is the fix trivial and unambiguous?
- For test additions: Is the code path clear? Will the test be reliable?

**If the contribution is too complex to complete: SKIP it.** A partial fix wastes maintainer time.

## Merge-Optimized Quality Score
Score each issue 1-25:

### Contribution Type (merge probability — MOST important)
- **+5** Documentation/typo fix (near-guaranteed merge)
- **+3** Test addition (high merge rate)
- **+2** Bug fix with `good-first-issue`/`help-wanted` label
- **+1** Bug fix (standard)

### Recency
- **+5** Created in the last 3 days (fresh — we're first responders)
- **+2** Created 3-7 days ago (recent)
- **+0** Created 7-14 days ago (acceptable)
- **-3** Created 14-30 days ago (getting stale — low priority)
- **SKIP** Created > 30 days ago

### Trust Signal (MOST impactful — depth over breadth)
- **+8** Repo is in memory/trust-repos.md (we've had successful interactions before)
- **+5** Repo merged a previous PR from us (check pr-ledger.md)
- **+3** Repo engaged positively with a previous PR (approved, constructive feedback)
- **-5** Repo closed our PR without review in < 24h (check pr-ledger.md)

### Niche Fit (agentic AI repos = highest ROI)
- **+5** Repo is in the agentic AI / LLM niche (langchain, autogen, crewai, llama-index,
  semantic-kernel, haystack, dspy, chromadb, qdrant, vllm, ollama, litellm, instructor,
  openai-python, or matches keywords: agent, llm, rag, embedding, vector, inference)
- **+3** Repo has 1000+ stars (high-impact, visible contribution)
- **+2** Repo has 500-1000 stars (solid mid-size)
- **+1** Repo has 200-500 stars

### Repo Health (merge velocity — from step 0d)
- **+5** Repo avg merge time < 3 days (fast reviewers — highest merge chance)
- **+3** Repo avg merge time < 7 days (responsive)
- **+0** Repo avg merge time < 14 days (acceptable)
- **-5** Repo avg merge time > 14 days (should have been filtered)
- **+3** Repo review rate > 80% (very responsive maintainers)
- **-3** Repo review rate 50-60% (barely passing)

### Actionability Signals
- **+3** Has clear scope and known fix approach
- **+2** Has stack trace or error message (for bugs)
- **+2** Has "expected vs actual" description (for bugs)
- **+1** Labeled by maintainer (confirmed valid issue)
- **+1** Has maintainer engagement (comments from repo owners)
- **+2** Has `good-first-issue` or `help-wanted` label

### Negative Signals
- **-2** Vague description, unclear scope
- **-2** Might be a feature request disguised as a bug
- **-2** Too complex to fully resolve
- **-1** Repo has history of rejecting external PRs
- **-5** Repo has 0 merged PRs in last 30 days (should have been filtered)
- **-3** Repo has 30+ open PRs (reviewer overwhelmed)
- **-10** Repo has 100% closure rate on our PRs (check pr-ledger.md — if ALL our PRs to this repo were closed without merge, score -10; effectively never picked again but not hard-blocked)
- **SKIP** Repo failed health gate

Minimum score 5 to attempt.

## Decision
- **Attempt**: Score >= 5, in healthy repo (merge time < 14d, review rate > 50%), created recently (< 2 weeks), clear scope, can be fully resolved
- **Skip**: Score < 5, unhealthy repo, stale (> 30 days), too complex, unclear scope
- **Defer**: Medium issues that need more context — revisit only if < 2 weeks old

## Output
Write triage assessment to memory with:
- Issue URL, repo, **contribution type** (bug/docs/typo/test)
- Repo Health Gate result: PASS or FAIL (with reason)
- Repo health metrics: merge velocity, review rate, open PR count, stars
- Issue age and recency assessment
- Completeness assessment: can this be fully resolved? (yes/no/uncertain)
- **Merge-optimized quality score** with breakdown
- Recommended action (attempt/skip/defer)
- Reasoning for the decision
