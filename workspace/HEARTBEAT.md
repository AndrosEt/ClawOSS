# Heartbeat -- Autonomous Work Loop

## CRITICAL: DO NOT JUST REPLY HEARTBEAT_OK
You MUST execute ALL steps below. Reading this file is NOT enough.
If the work queue has items, you MUST pick one and spawn a sub-agent.
Only reply HEARTBEAT_OK if ALL of these are true:
- Work queue is completely empty
- No PRs need follow-up
- No stalled sub-agents
- oss-discover found zero new issues
Otherwise: PICK WORK AND DO IT. Never be idle.

## ALWAYS KEEP 5 SUB-AGENTS ACTIVE
Your #1 job is to keep all 5 sub-agent slots filled at ALL times.
- If active sub-agents < 5: IMMEDIATELY discover and spawn more
- Do NOT wait for the next heartbeat — self-wake and fill slots NOW
- An empty slot is wasted throughput. Fill it.
- After ANY sub-agent completes: check slots, discover if needed, spawn replacement
- The work queue should always have 10+ items ready. If < 5, run oss-discover IMMEDIATELY.

## PRIORITY ORDER: Follow-ups FIRST, then new work
Follow-up sub-agents (responding to PR reviewers) get PRIORITY over implementation sub-agents.
- ALWAYS spawn follow-up sub-agents BEFORE spawning new implementation sub-agents
- A reviewer waiting for a response is more important than starting a new fix
- Follow-ups and implementation sub-agents share the same 5-slot concurrent pool
- If 3 slots are used by follow-ups, only 2 slots remain for new implementations

## Rules (always in effect -- AGENTS.md is NOT loaded in lightContext mode)

### Safety (non-negotiable)
- NEVER push to main/master or default branches directly
- NEVER force-push to any branch
- NEVER commit secrets, credentials, API keys, or .env files
- NEVER modify CI/CD pipelines in contributed repos without explicit approval
- GitHub token scope must be public_repo (least privilege)

### PR Limits
- Max 200 lines changed, max 5 files per PR
- Max 2-3 PRs per repo per day, 30-min gap between same-repo PRs
- Max 10 PRs total per day across all repos
- Max 5 active PRs across all repos at any time
- Max 3 follow-up revision rounds per PR -- after 3, politely disengage
- Do NOT submit trivial PRs (whitespace-only, comment-only unless meaningful)
- ALWAYS use branch naming: clawoss/{type}/<description> (type = fix, docs, test, or typo)

### Quality (non-negotiable)
- **We only contribute to repos that will actually review our work** -- repo health gate is mandatory
- **Our goal is MERGED PRs, not submitted PRs** -- 50 unreviewed PRs = 0 impact
- **A merged typo fix > an unreviewed bug fix** -- optimize for merge rate, not submission count
- **Mix: 60% easy wins (docs, typos, tests) + 40% substantive bug fixes** at responsive repos
- **Every PR must FULLY resolve its scope** -- no partial fixes. Skip rather than submit half-baked work.
- **Prefer FRESH issues in HEALTHY repos** -- repos with 500+ stars, merge time < 14d, review rate > 50%
- Read CONTRIBUTING.md before first PR to any repo
- Understand the repo architecture BEFORE writing any code
- Every code change must include a test proving the bug existed and is now fixed
- Every PR description must include ROOT CAUSE ANALYSIS: what was broken, WHY it was broken, how this fixes it
- Commit messages: Conventional Commits format -- {type}(scope): description (type = fix, docs, or test — must match contribution)
- Code style must match the target repo's existing conventions
- No AI-slop: no unnecessary comments, no over-engineering, no "I" statements
- No scope creep: address ONLY the reported issue, nothing else
- Multi-file fixes are fine when the root cause demands it -- correctness over minimalism
- If tests fail after 2 fix attempts, abandon task
- If self-review fails 3+ checks, abandon task
- If issue turns out to be a feature request during implementation, ABANDON immediately
- If the bug is too complex to fully resolve, ABANDON -- one excellent PR > five shallow ones

### Content Filter Safety (OpenRouter blocks emails in file contents)
- OpenRouter blocks PII patterns (emails, phones) even inside file contents the model reads
- Clone repos freely — but when reading files, avoid ones with author emails:
  - For package.json: use `jq '{name, version, scripts, dependencies}' package.json` (skips author field)
  - Skip lock files (package-lock.json, yarn.lock) — they contain maintainer emails
  - For setup.py/Cargo.toml/pyproject.toml: use grep to extract only relevant fields
- You CAN freely read source code, test files, config files, docs — those rarely have emails
- If you get a 403 content filter error: skip that specific file, not the whole task
- Try alternative approaches: read a different file, use grep to find what you need
- Only skip the entire task after 3 consecutive 403 errors on the same repo

### Context Management
- Before spawning a sub-agent, check orchestrator context with session_status
- If orchestrator context > 60%, flush state to memory and trigger compaction before spawning
- Sub-agents take as long as they need -- no hard timeout, quality over speed
- After each heartbeat cycle, if context > 50%, write important state to memory and compact
- NEVER start new work if context > 70% -- compact first

### Available Tools
- web_search: Use to research issues, find related fixes, check upstream discussions before implementing
- web_fetch: Use to read documentation URLs, changelogs, or linked resources from issues
- image: GLM-5 has vision -- use to analyze screenshots attached to issues
- apply_patch: Use for multi-file structured patches instead of individual edits
- loop-detection: Automatically guards against tool-call loops -- enabled globally

### Failure Handling
- All failures MUST use a standard `failure_reason` category from the taxonomy
  in `templates/subagent-result-schema.md`. Format: `"category: optional details"`.
- If a contribution is rejected, log `failure_reason` with category and adapt
- If repo's CI is broken (not our fault): `ci_incompatible`, skip and move to next
- If rate-limited by GitHub API: `api_rate_limited`, back off and wait
- Track failures in `memory/failure-log.md` — 3+ same-category failures/day → adapt strategy
- Never get stuck in retry loops -- fail fast and move forward

## 0a. Context Health
Call session_status. If percentUsed > 70%, flush state to memory files and run /compact before proceeding.
- percentUsed > 70%: STOP. Write wake-state, pipeline-state, and any in-flight task context to memory files. Run /compact. After compaction, re-read memory/wake-state.md and memory/pipeline-state.md to restore state. Then continue to 0b.
- percentUsed > 50%: Proceed with this cycle, but compact before next cycle.
- percentUsed <= 50%: Proceed normally.

## 0b. Circuit Breakers
Read memory/wake-state.md. Reply HEARTBEAT_OK if:
- consecutive_wakes >= 50 (mandatory cooldown — high limit for sustained throughput)
- errors_this_hour >= 2
- If hourly_reset is stale (>1hr), reset hourly counters first.

## 1. Stall Recovery
Check if a sub-agent session is active from a previous cycle:
- If sub-agent session exists but has no new messages for >5 minutes: it's stalled
- Kill the stalled session (sessions_send with cancel/abort if available, or just ignore it)
- Flush any partial state to memory
- Re-queue the task at the TOP of memory/work-queue.md with note "retry - previous attempt stalled"
- Spawn a FRESH sub-agent for the same task on the next cycle
- Increment errors_this_hour in memory/wake-state.md
- After 2 consecutive stalls on the same task, SKIP it and move to the next item

## 2. PR Follow-ups (HIGHEST PRIORITY — before any new work)

### 2a. Detect PRs Needing Attention
```bash
gh pr list --author @me --state open --json number,title,url,updatedAt,reviewDecision,statusCheckRollup,comments
```
For each open PR, fetch inline comments (`gh api repos/.../pulls/{n}/comments`) and
general comments (`gh api repos/.../issues/{n}/comments`).

### 2b. Classify Each PR
Read pr-followup-state.md. **SPAWNED_PENDING GUARD:** skip PRs with status `spawned_pending`.

| Classification | Condition | Action |
|---|---|---|
| `changes_requested` | CHANGES_REQUESTED or new change-request comments | Spawn follow-up if round < 3 |
| `comment_only` | Questions/discussion, not change requests | Spawn follow-up to respond |
| `approved` | reviewDecision=APPROVED | Log success, no sub-agent |
| `ci_failing` | CI failures that are our fault | Spawn follow-up (like changes_requested) |
| `stale` | No activity >7 days | Close with polite comment, update state |
| `merged` | PR was merged | Log success |

### 2c. Spawn Follow-up Sub-Agent
Write context to `memory/subagent-inputs/followup-{repo}-{pr}.md` (PR details, comments, diff).
Use `templates/subagent-followup.md`. Set status to `spawned_pending` immediately after spawn.
**Max 2 follow-up sub-agents per cycle.** Follow-ups get priority over implementations.
Then continue to step 3.

## 3. Merge Staging Files & Pick Work (up to 5 concurrent tasks)

### 3-ZERO. DAILY PR LIMIT HARD GATE (check FIRST — before anything else in step 3)
Read memory/wake-state.md and check `prs_today` total.
**If prs_today >= 10: STOP. Reply HEARTBEAT_OK immediately.**
Do NOT spawn any new implementation sub-agents. Do NOT discover new issues.
Follow-up sub-agents (step 2) are exempt — responding to reviewers is not submitting new PRs.
This gate is NON-NEGOTIABLE. 10 PRs/day is the hard ceiling. No exceptions.

### 3a. Merge Staging Files
Merge any new items from memory/work-queue-staging.md and memory/followup-staging.md into memory/work-queue.md, then clear the staging files. (This prevents race conditions with concurrent cron writes.)

**DEDUP when merging:** Before adding any item from staging to the work queue, check if an item
with the same issue URL already exists in work-queue.md. If it does, skip the duplicate.
Also remove any duplicate entries already in work-queue.md (same issue URL appearing twice).

### 3b. Count and Pick
Count active sub-agents via sessions_list (exclude main session and stale sessions >30min).
**Include both follow-up and implementation sub-agents in the count.**
Read memory/work-queue.md, memory/wake-state.md prs_today_by_repo, and memory/pr-ledger.md.
- If active sub-agents >= 5: skip to step 6 (check results).
- If active sub-agents < 5 AND work queue has items:
  Pick the next task (urgent first, then top item with score >= 5).
  BEFORE spawning, apply these filters:
  a0. **BLACKLIST GATE (FIRST -- before ANY tokens):** Read `memory/repo-blacklist.md`. If repo is listed: SKIP. Remove from queue. No exceptions.
  a. **DEDUP GATE (3 checks — must pass ALL):**
     - SKIP if issue number + repo name already appears in memory/pr-ledger.md
       (Note: pr-ledger entries may have empty issue fields — match on BOTH repo name
       AND issue number. If either field is empty in the ledger row, match on the other.)
     - SKIP if we already have an OPEN PR for this repo:
       `gh pr list --author @me --repo {owner}/{repo} --state open --json number,title`
       If any open PR exists for the same repo, SKIP to avoid piling PRs.
     - SKIP if issue URL appears anywhere in memory/subagent-result-*.md files
       (a sub-agent is already working on it or already attempted it)
  b. SKIP if repo already has 3 PRs today (per-repo daily limit)
  c. Prefer different repos across concurrent sub-agents when possible
  d. **CONTRIBUTION TYPE CHECK: Verify the issue is an actionable contribution** — bug fixes,
     documentation fixes, typo fixes, or test additions. Feature requests and large refactors are out of scope.
     For non-bug issues (docs, typos, tests), verify the repo is receptive to such contributions.
  f. **TITLE KEYWORD HARD REJECT: SKIP if title matches any keyword as a WHOLE WORD
     (word boundary match, case-insensitive).** Do NOT match substrings — "Unsupported" must NOT
     match "support", "Additional" must NOT match "add", "Document" as noun must NOT match "document" as verb.
     Keywords: `add`, `extend`, `enable`, `improve`, `document`, `enhance`, `new feature`, `request`,
     `implement`, `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`,
     `redesign`, `optimize`, `allow`, `provide`
     Match pattern: `\b{keyword}\b` (regex word boundary) or keyword appears at start of title
     followed by a space/punctuation. Examples: "Add dark mode" matches, "Unsupported operation crashes" does NOT.
  g. **REPO HEALTH GATE:** Run `bash scripts/repo-health-check.sh {owner}/{repo}`.
     Exit 1 = SKIP (remove from queue). Use cached results from memory/repos/ if < 7 days old.
     Prefer repos with `good-first-issue`/`help-wanted` labels (+2 priority).
  Go to step 4 (triage) then step 5 (spawn).
  After spawning, LOOP BACK here to pick another task.
  Keep spawning until 5 sub-agents are active or queue is empty.
- Queue has < 5 items --> run oss-discover (see skill for search strategy: Tier 0 niche AI repos,
  Tier 1 good-first-issue/help-wanted, Tier 2 general bugs). Health-verify before queuing.
  Target 20-30 candidates. Score >= 5 to enter queue. If nothing found, HEARTBEAT_OK.
  Consider spawning a scout sub-agent (templates/subagent-scout.md) if slots available.
- Queue has >= 10 items --> skip discovery, drain the queue first.

## 4. Triage (in main session, < 3 min)

### 4-ZERO. Health Gate
Run `bash scripts/repo-health-check.sh {owner}/{repo}`. Exit 0 = pass, exit 1 = skip.
The script checks: stars, activity, merge velocity, review rate, open PRs, external merges,
niche fit, and **anti-AI/anti-bot policy detection** (CONTRIBUTING.md, README, maintainer comments).
If JSON output contains `"anti_ai_policy": true`: add repo to `memory/repo-blacklist.md` permanently.
Use cached results from memory/repos/ if < 7 days old. On failure: remove from queue, cache, go to step 3.
Save JSON output to `memory/repos/{owner}_{repo}.md`.

### 4a. Contribution Type Assessment
Determine the contribution type:
- **Bug fix**: Has bug/defect/regression/crash labels, error messages, stack traces, "expected vs actual"
- **Documentation fix**: Incorrect/outdated documentation, has docs/documentation label
- **Typo fix**: Typo in code/docs/comments, has typo label
- **Test addition**: Missing tests, has test label, uncovered code paths

**TITLE KEYWORD HARD REJECT** (`\b{keyword}\b`, case-insensitive): `add`, `extend`, `enable`,
  `improve`, `enhance`, `new feature`, `request`, `implement`, `support`, `introduce`, `create`,
  `propose`, `migrate`, `upgrade`, `refactor`, `redesign`, `optimize`, `allow`, `provide`

**LABEL HARD REJECT:** `enhancement`, `feature`, `feature-request`, `improvement`, `refactor`,
  `discussion`, `question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`
  (Note: `docs`, `documentation`, `typo`, `test` labels are VALID.)

### 4b. Quality Gate
Run oss-triage: confirm open, unassigned, actionable (bug/docs/typo/test), well-scoped.
Prefer issues < 3 days old. Skip > 30 days. Skip "wontfix"/"duplicate"/"invalid".

### 4c. Merge-Optimized Scoring
+5 docs/typo, +3 tests, +5 fast-merge repos (<3d), +3 review rate >80%, +2 good-first-issue/help-wanted.
-5 slow repos (>14d merge). SKIP if 0 merges in 30d or >50 open PRs.

### 4d. Quick Research
Use web_search for upstream context, CVEs. Use image tool for screenshots.

## 5. Spawn Implementation Sub-Agent
Read `templates/subagent-implementation.md`. Substitute `{repo}`, `{issue}`, `{title}`.
Attach repo conventions + issue details from memory (sub-agents can't access memory tools).
Do NOT implement in the main session.

- Results: `memory/subagent-result-{repo}-{issue}.md` (YAML per `templates/subagent-result-schema.md`)
- Reply ANNOUNCE_SKIP after writing. maxConcurrent: 5. No hard timeout.
- Sub-agents clean own `/tmp/clawoss-*` workdirs. Orchestrator NEVER deletes them.
- Stale sessions (>30 min): ignore, spawn fresh.

## 6. Handle Sub-Agent Results
Check sessions_list. Parse result files (YAML frontmatter per `templates/subagent-result-schema.md`):

### 6a. Implementation Results (`memory/subagent-result-*.md`, excluding followup-*)
- **success**: Validate `pr_url` is present and valid (`https://github.com/.../pull/...`).
  If missing: re-queue once, then mark failed. If valid: update pipeline-state.md,
  remove from work-queue.md, add to pr-followup-state.md (status: `pending_review`, round 0).
  pr-ledger.md is AUTO-SYNCED by pr-ledger-sync.sh — do NOT manually edit.
- **failure/abandoned**: Log `failure_reason` (must use taxonomy category) in work-queue.md
  and failure-log.md. Cache `repo_health_fail` reasons in memory/repos/ for 7 days.
- **already_fixed**: Remove from work-queue.md.
- Delete result file after processing.

### 6b. Follow-up Results (`memory/subagent-result-followup-*.md`)
- Update pr-followup-state.md: increment round, update timestamp, set status from `followup_outcome`.
- Terminal states: `closed_scope_concern`, `closed_rejected`, `disengaged_max_rounds` — no more sub-agents.
- Round >= 3: mark `disengaged`. Closed PRs: remove from pipeline-state.md.
- Delete result file after processing.

## 7. Report & Loop
Run dashboard-reporter. Update wake-state.md counters. Remove completed items from work-queue.md.

If active sub-agents < 5 AND work queue has items: go back to step 3.
If active sub-agents < 5 AND work queue empty: run oss-discover, then step 3.
HEARTBEAT_OK only if all 5 slots full OR queue empty + discovery found nothing.
Always self-wake: `exec: openclaw system event --text "cycle-complete" --mode now`
