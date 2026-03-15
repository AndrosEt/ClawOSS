# 036: PR Limits from HEARTBEAT.md Not Enforced by Model

**Status:** Open
**Severity:** High (community trust risk, potential repo bans)
**Component:** workspace/HEARTBEAT.md (PR Limits section), workspace/AGENTS.md

## Description

HEARTBEAT.md specifies strict PR limits to prevent flooding repos and maintain community goodwill. The model routinely ignores all of them:

| Limit | Documented | Actual (observed) |
|-------|-----------|-------------------|
| Max PRs per day | 10 | 19 in 85 minutes |
| Max PRs per repo per day | 2-3 | 4 to apache/mahout |
| Max lines changed per PR | 200 | 965 lines (scalatest#2389) |
| Max files per PR | 5 | Not verified but likely exceeded |
| 30-min gap between same-repo PRs | Required | Multiple same-repo PRs within minutes |

## Impact

1. **Community backlash**: Submitting 4 PRs to the same repo in rapid succession looks like spam, regardless of quality
2. **Repo bans**: Maintainers may block the BillionClaw account if they perceive automated flooding
3. **Quality degradation**: A 965-line PR is far beyond the "small, focused fix" philosophy — reviewers won't engage with it
4. **Rate limit risk**: Rapid-fire PR creation can trigger GitHub's abuse detection

## Root Cause

The limits are documented as text rules in HEARTBEAT.md and AGENTS.md, but:

1. **No programmatic enforcement**: There's no script or hook that counts today's PRs and blocks new ones after the limit
2. **Model optimization pressure**: The heartbeat loop's emphasis on "ALWAYS KEEP 5 SUB-AGENTS ACTIVE" and "fill all slots" creates competing pressure that overrides limit compliance
3. **No pre-submit gate**: Sub-agents create PRs independently — there's no orchestrator checkpoint between "code ready" and "PR created" where limits could be enforced

## Fix

1. **Programmatic gate**: Create a `scripts/pr-gate.sh` that sub-agents must call before `gh pr create`. It checks:
   - Total PRs today via `gh pr list --author @me --search "created:>=$(date -u +%Y-%m-%d)"`
   - Per-repo PRs today
   - Diff size (`git diff --stat | tail -1` for line count)
   - Returns exit code 1 if any limit exceeded
2. **Sub-agent instructions**: Add to the spawn template: "Before creating PR, run pr-gate.sh. If it fails, abandon and report 'limit-exceeded' status."
3. **Reduce competing pressure**: Soften the "fill all 5 slots" language when daily PR limit is approaching (e.g., "if prs_today >= 8, spawn max 2 sub-agents")
4. **Diff size check in oss-review skill**: The self-review step should hard-fail if diff exceeds 200 lines

## Related Issues

- #035 — PR URL validation not enforced (related model compliance issue)

## Related Files

- `workspace/HEARTBEAT.md` (PR Limits section, step 5 spawn template)
- `workspace/AGENTS.md` (safety defaults, size limits)
- `workspace/skills/oss-review/SKILL.md` (self-review checklist)
- `workspace/skills/oss-submit/SKILL.md` (PR creation step)
