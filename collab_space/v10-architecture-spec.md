# V10 Architecture Spec — Intelligence + Throughput

**Author**: team-lead
**Date**: 2026-03-17
**Status**: APPROVED with amendments from team debate

---

## V9 Gaps This Addresses

1. **"Already fixed" check too weak** — llama_index ban: subagent didn't check if someone merged a fix between discovery and implementation
2. **Binary gates, no intelligence** — 15 pass/fail gates but no probabilistic scoring of "will this PR actually merge?"
3. **Scout doesn't understand codebase direction** — runs GitHub API searches, scores by stars/labels, doesn't read recent commits or maintainer priorities
4. **Throughput ceiling** — 7 slots, 5-min heartbeat, but main agent still bottlenecks on orchestration

---

## V10 Design: 3 Major Changes

### Change 1: Lobster Deterministic Pipeline (replaces LLM-driven orchestration)

**Problem**: The main agent uses its LLM context to decide what to do each cycle. This is slow (LLM inference on 60k+ tokens), unreliable (context bloat causes timeouts), and non-deterministic (different decisions each cycle).

**Solution**: Use [Lobster](https://github.com/openclaw/lobster) — OpenClaw's native workflow engine — for the heartbeat pipeline. Lobster runs YAML workflows deterministically: no LLM decides the flow, LLMs only do creative work within steps.

**Architecture**:
```yaml
# workspace/workflows/heartbeat.lobster.yaml
name: heartbeat-v10
steps:
  - id: health-check
    tool: bash
    args: |
      curl -s https://clawoss-dashboard.vercel.app/api/agent/health-check
    output: health_data

  - id: check-subagents
    tool: sessions_list
    args: { activeMinutes: 30 }
    output: active_sessions

  - id: respawn-always-on
    tool: sessions_spawn
    condition: "!active_sessions.find(s => s.label.startsWith('scout'))"
    args:
      task: "@file:templates/subagent-scout.md"
      label: "scout-tier0"
      mode: session
      thread: true
      runTimeoutSeconds: 3600

  - id: respawn-pr-monitor
    tool: sessions_spawn
    condition: "!active_sessions.find(s => s.label === 'pr-monitor')"
    args:
      task: "@file:templates/subagent-pr-monitor.md"
      label: "pr-monitor"
      mode: session
      thread: true
      runTimeoutSeconds: 3600

  - id: process-followup-staging
    tool: bash
    args: |
      cat memory/followup-staging.md 2>/dev/null || echo "empty"
    output: followup_items

  - id: spawn-followups
    tool: subagent
    for_each: "followup_items.filter(i => i.action === 'code_change')"
    args:
      task: "@file:templates/subagent-followup.md"
      label: "followup-{{item.repo}}#{{item.pr}}"

  - id: process-work-queue
    tool: bash
    args: |
      cat memory/work-queue.md 2>/dev/null | head -5
    output: work_items

  - id: spawn-implementations
    tool: subagent
    for_each: "work_items.slice(0, available_slots)"
    args:
      task: "@file:templates/subagent-implementation.md"
      label: "impl-{{item.repo}}#{{item.issue}}"
    approval: false  # no human approval needed
```

**Benefits**:
- Main agent context stays small (Lobster handles orchestration, not the LLM)
- Deterministic: same state → same actions every time
- Resumable: if interrupted, picks up where it left off
- Faster: no LLM inference for orchestration decisions

**Implementation**: Builder creates `workspace/workflows/heartbeat.lobster.yaml`, installs Lobster plugin, updates openclaw.json heartbeat to call the Lobster workflow instead of the LLM prompt.

---

### Change 2: Merge Probability Scoring (replaces binary gates)

**Problem**: 15 binary pass/fail gates but no probabilistic ranking. An issue at a 50k-star repo with a help-wanted label and fast merge velocity scores the same as an issue at a 201-star repo with no labels and 14-day merge time — as long as both pass the gates.

**Solution**: Replace the current scoring system with a weighted merge probability model trained on our own data (63 closed PRs + 3 merges).

**Merge Probability Formula** (0-100 score):
```
P(merge) =
  + 25 * task_type_score        # docs/typo=1.0, test=0.75, bug=0.5, feature=0
  + 20 * size_score              # <30 lines=1.0, 30-100=0.7, 100-200=0.3, >200=0
  + 15 * repo_responsiveness     # merge<3d=1.0, 3-7d=0.7, 7-14d=0.3, >14d=0
  + 15 * trust_score             # merged before=1.0, positive engagement=0.7, new=0.3, hostile=0
  + 10 * freshness               # <1d=1.0, 1-3d=0.8, 3-7d=0.5, 7-14d=0.2, >14d=0
  + 10 * contributor_fit         # help-wanted=1.0, good-first-issue=0.8, bug=0.5, none=0.3
  + 5  * competition_score       # no other PRs=1.0, 1 competing=0.3, 2+=0
```

**Threshold**: Only spawn implementation if P(merge) >= 40. Below 40 is not worth the API cost.

**Where it runs**: In the PR Analyst (daily, updates `memory/pr-strategy.md` with per-repo scores) and in the scout/triage (real-time scoring of new candidates).

**Data source**: PR Analyst computes actual merge rates per repo, per task type, per size bracket from our own history. Over time, this becomes a self-improving model.

---

### Change 3: Deep Codebase Direction Analysis (scout upgrade)

**Problem**: Scout discovers issues by GitHub API search (stars + labels). It doesn't understand WHERE a codebase is heading — what maintainers are working on, what the roadmap looks like, what areas are active vs frozen.

**Solution**: Before greenlighting any issue, the scout (or a dedicated analysis step) reads the repo's recent activity to assess alignment:

**Direction Analysis Checklist** (added to scout template):
```bash
# 1. What are maintainers working on RIGHT NOW?
gh api "repos/{repo}/commits?per_page=20" --jq '.[].commit.message'
# → Extract themes: which modules/areas are being actively changed?

# 2. What issues are maintainers engaging with?
gh api "repos/{repo}/issues?state=open&sort=comments&direction=desc&per_page=10" --jq '.[] | {number, title, comments}'
# → High-comment issues = maintainer priority areas

# 3. What PRs are maintainers reviewing?
gh api "repos/{repo}/pulls?state=open&sort=updated&direction=desc&per_page=10" --jq '.[] | {number, title, user: .user.login}'
# → Shows what external contributions get attention

# 4. Is there a CHANGELOG or roadmap?
gh api "repos/{repo}/contents/CHANGELOG.md" --jq '.content' | base64 -d | head -50
# → Recent releases show direction

# 5. What labels are actively used?
gh api "repos/{repo}/labels?per_page=50" --jq '.[] | select(.name | test("priority|p0|critical|next|planned"; "i")) | .name'
# → Priority labels = maintainer focus areas
```

**Decision logic**: Only greenlight issues that:
- Are in modules/areas with recent commit activity (not frozen code)
- Align with issues maintainers are engaging with (not ignored areas)
- Don't conflict with active PRs from other contributors
- Have labels that suggest maintainer wants help (bug, help-wanted, good-first-issue)

**Where it runs**: In the enhanced scout template. The scout writes a "direction summary" for each repo to `memory/repos/{owner}_{repo}.md`, which implementation subagents read before starting work.

---

## Throughput Maximization

### Current: 7 slots, 5-min heartbeat
- 2 always-on (scout + PR monitor)
- 5 impl/followup
- Main agent spends ~2-3 min per cycle on orchestration
- Effective throughput: ~5 PRs per hour (limited by slot count + cycle time)

### V10 Target: 10 slots, 3-min heartbeat, Lobster orchestration
- 3 always-on (scout + PR monitor + PR analyst as persistent)
- 7 impl/followup
- Lobster orchestration: <30 sec per cycle (no LLM inference for routing)
- Effective throughput: ~10-15 PRs per hour

### Config changes:
```json
{
  "agents.defaults.subagents.maxConcurrent": 10,
  "agents.defaults.subagents.maxChildrenPerAgent": 15,
  "heartbeat.every": "3m"
}
```

### Stacked PRs pattern (from research):
- Break large fixes into small, dependent PRs that merge in sequence
- Shopify reported 33% more PRs merged per developer with stacked PRs
- Small diffs (< 30 lines) get reviewed faster and merge more often
- Target: docs/typo PRs < 10 lines, bug fixes < 50 lines

---

## Files to Create/Modify

| File | Action | Owner |
|------|--------|-------|
| `workspace/workflows/heartbeat.lobster.yaml` | CREATE | builder |
| `workspace/templates/subagent-scout.md` | MAJOR REWRITE — direction analysis | builder |
| `workspace/templates/subagent-pr-analyst.md` | ADD merge probability model | builder |
| `workspace/skills/oss-triage/SKILL.md` | REPLACE scoring with P(merge) formula | builder |
| `workspace/skills/oss-discover/SKILL.md` | REPLACE scoring with P(merge) formula | builder |
| `config/openclaw.json` | maxConcurrent 10, heartbeat 3m, Lobster plugin | builder |
| `workspace/HEARTBEAT.md` | THIN DOWN — delegate to Lobster | builder |
| `memory/pr-strategy.md` | CREATE — analyst writes strategy here | PR analyst subagent |

---

## Migration Path

**Phase 1** (immediate — builder + critique):
- Fix the 3 V9 gaps (already-fixed check ✓, scoring model, direction analysis)
- Add merge probability scoring to triage and discover
- Enhance scout with direction analysis
- Increase maxConcurrent to 10

**Phase 2** (next session — builder):
- Install Lobster plugin
- Create heartbeat.lobster.yaml workflow
- Migrate HEARTBEAT.md to Lobster calls
- Make PR Analyst persistent (always-on)

**Phase 3** (ongoing — PR Analyst):
- Self-improving merge probability model based on actual outcomes
- Repo direction summaries auto-updated weekly
- Blocklist auto-maintained from rejection patterns

---

## Success Metrics

| Metric | V9 Current | V10 Target |
|--------|-----------|------------|
| Merge rate | 4.8% | 20%+ |
| PRs per hour | ~5 | ~15 |
| Time to follow-up | 5-10 min | <3 min |
| False positive rate (submit to hostile repo) | ~7% | <1% |
| Duplicate submissions | ~25% | <2% |
| Context timeout incidents | frequent | zero (Lobster) |
