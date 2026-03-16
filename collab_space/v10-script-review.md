# V10 Script Review

**Author**: critique agent
**Date**: 2026-03-17
**Reviewing**: 10 new scripts in scripts/ (7 requested + 3 bonus)

**Verdict**: Generally solid. 4 P1 bugs, 6 P2 issues, 5 P3 nits.

---

## P1 — Will break in production

### P1-1: workspace-setup.sh line 25 — piped grep always fails

```bash
if grep -qi "^\| *\`\?${OWNER}/${REPO_NAME}\`\?" "$TRUST_FILE" | grep -qi "permanent\|skip\|ban\|deprioritize" 2>/dev/null; then
```

The first `grep -qi` outputs nothing (quiet mode) so the second `grep` in the pipe ALWAYS sees empty input. This entire blocklist check is a no-op. The subsequent awk-based check on lines 27-31 does work, but the `if` condition on line 25 will never be true, so the awk block never executes.

**Fix**: Remove the outer `if` and just run the awk check directly:
```bash
IN_DEPRIORITIZED=$(awk '/^## Deprioritized/,/^## /' "$TRUST_FILE" | grep -i "${OWNER}/${REPO_NAME}" || true)
if [ -n "$IN_DEPRIORITIZED" ]; then
  fail "Repo ${REPO} is in blocklist (deprioritized in trust-repos.md)"
fi
```

### P1-2: workspace-setup.sh line 157 — HEALTH_RESULT may be empty

```bash
"stars": $(echo "$HEALTH_RESULT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("metrics",{}).get("stars",0))' 2>/dev/null || echo 0)
```

If the health check script is not executable (line 36 check fails) and the fallback star check runs instead, `HEALTH_RESULT` is never set. The python3 call gets empty input and fails. The `|| echo 0` catches it, but the JSON might get malformed if python3 outputs a partial error to stdout before failing.

**Fix**: Initialize `HEALTH_RESULT='{}'` at the top of the script.

### P1-3: heartbeat-status.sh line 11 — `grep -oP` not available on macOS

```bash
CONSECUTIVE=$(echo "$WAKE_STATE" | grep -oP 'consecutive_wakes: \K[0-9]+' || echo 0)
ERRORS=$(echo "$WAKE_STATE" | grep -oP 'errors_this_hour: \K[0-9]+' || echo 0)
```

macOS `grep` does not support `-P` (Perl regex) or `\K` (lookbehind reset). This will silently fail and always return 0.

**Fix**: Use `grep -oE` with sed, or use awk:
```bash
CONSECUTIVE=$(echo "$WAKE_STATE" | grep -oE 'consecutive_wakes: [0-9]+' | grep -oE '[0-9]+' || echo 0)
```

### P1-4: pr-portfolio-stats.sh line 8 — `--merged` flag for gh search prs

```bash
MERGED=$(gh search prs --author BillionClaw --merged --json number --jq 'length' 2>/dev/null || echo 0)
```

Same bug as the PR analyst template: `--merged` is not a valid flag for `gh search prs`. The valid approach is `--state merged` (if supported) or fetching closed PRs and checking `.merged` via API.

**Fix**: Use `gh search prs --author BillionClaw --is merged` or fall back to API-based count.

---

## P2 — Logic errors or edge cases

### P2-1: workspace-cleanup.sh line 18 — lock file matching is fragile

```bash
if grep -q "$(basename "$WORKDIR")" "$lockfile" 2>/dev/null; then
```

Lock files are written by workspace-setup.sh as: `{timestamp} | {repo}#{issue} | workspace-setup`. But `basename "$WORKDIR"` gives something like `clawoss-12345-1710648000`. This string does NOT appear in the lock file content, so the grep will never match, and lock files are never cleaned up by the cleanup script.

**Fix**: Lock files should also include the workspace path, OR cleanup should match by repo name extracted from the workspace directory name.

### P2-2: compute-merge-probability.sh line 176 — threshold is 30, spec says 40

```bash
"threshold": 30,
```

The V10 spec says "Only spawn implementation if P(merge) >= 40" but the script uses 30 as the threshold and shows `proceed` for scores >= 30. The `proceed_priority` threshold at 60 is reasonable but not in the spec either.

**Fix**: Align with spec — threshold should be 40.

### P2-3: scan-pr-reviews.sh lines 123-124 — bash string substitution for JSON booleans

```bash
"ci_failed": ${CI_FAILED/yes/true},
"is_stale": ${IS_STALE/yes/true},
```

If `CI_FAILED` is "no", `${CI_FAILED/yes/true}` outputs "no" (not "false"). The JSON will have `"ci_failed": no` which is invalid JSON.

**Fix**: Use proper ternary:
```bash
"ci_failed": $([ "$CI_FAILED" = "yes" ] && echo true || echo false),
"is_stale": $([ "$IS_STALE" = "yes" ] && echo true || echo false),
```

### P2-4: check-blocklist.sh line 17 — awk range terminator may miss entries

```bash
DEPRIORITIZED=$(awk '/^## Deprioritized/,/^$/' "$TRUST_FILE")
```

This stops at the first empty line after `## Deprioritized`. If the deprioritized section has entries separated by blank lines (common in markdown tables), only the first block is checked.

**Fix**: Use section-to-next-heading range: `awk '/^## Deprioritized/,/^## /' "$TRUST_FILE"`

### P2-5: compute-merge-probability.sh — responsiveness weight is 15, not 20

The script uses weight 15 for repo_responsiveness (line 96: `resp_val * 15 / 100`), but my adopted critique recommended 20. The adopted weights from team-lead were: trust 25, size 20, task_type 15, responsiveness 20 (was changed from 15), freshness 10, contributor_fit 10, competition 5. Only trust was confirmed changed.

**Fix**: Verify the final adopted weights with team-lead and align the script.

### P2-6: workspace-setup.sh — command injection via REPO argument

Lines 7-10:
```bash
REPO="${1:?Usage: workspace-setup.sh <owner/repo> <issue_number>}"
OWNER="${REPO%%/*}"
```

If someone passes a repo name containing shell metacharacters (e.g., `"; rm -rf /; echo "`), the `fail()` function on line 16 interpolates `$REPO` directly into a heredoc. While subagents won't pass malicious input, the `gh api` and `gh repo clone` commands also interpolate `$REPO` unquoted in some places.

**Fix**: Add input validation:
```bash
[[ "$REPO" =~ ^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$ ]] || { echo "Invalid repo format"; exit 1; }
[[ "$ISSUE" =~ ^[0-9]+$ ]] || { echo "Invalid issue number"; exit 1; }
```

---

## P3 — Minor issues

### P3-1: check-already-fixed.sh line 17 — regex may false-positive

```bash
--jq "[.[] | select((.title // \"\") + (.body // \"\") | test(\"#${ISSUE}\"; \"i\"))]
```

If issue number is `3`, this matches `#3` but also `#30`, `#300`, `#3456`, etc. Should use word boundary: `test(\"#${ISSUE}\\b\"; \"i\")`.

### P3-2: check-supersession.sh line 24 — "I'll take" regex may false-positive

```bash
test("I.ll take|I.m working|I will fix|working on a fix"; "i")
```

The `.` in `I.ll` and `I.m` matches any character, not just apostrophe. Could match "Ill take" or "I'll take" or "I-ll take". Probably fine in practice but worth noting.

### P3-3: analyze-repo-direction.sh — no error handling for base64 decode

Line 37: `base64 -d` on macOS may need `-D` flag (older versions). Modern macOS uses `base64 -d` which is fine, but if the CHANGELOG content is not base64-encoded (e.g., repo uses LFS), this silently produces garbage.

### P3-4: scan-pr-reviews.sh — stale threshold is 7 days, HEARTBEAT says 14

Line 84: `print('yes' if age >= 7 else 'no')` — but HEARTBEAT step 2 classifies stale as >14 days. The script uses 7 days, which would flag too many PRs as stale.

**Fix**: Change to `age >= 14`.

### P3-5: Multiple scripts use hardcoded PROJECT_DIR fallback

`${PROJECT_DIR:-/Users/kevinlin/clawOSS}` appears in workspace-setup.sh, workspace-cleanup.sh, heartbeat-status.sh, compute-merge-probability.sh. This makes the scripts non-portable. Consider reading from a config file or requiring the env var.

---

## Cross-Script Consistency

| Check | Status |
|-------|--------|
| All use `BillionClaw` not `@me` | CORRECT |
| All handle missing files gracefully | CORRECT (with exceptions noted above) |
| JSON output is parseable | P2-3 breaks JSON booleans in scan-pr-reviews.sh |
| Exit codes consistent (0=pass, 1=fail) | CORRECT |
| macOS compatible | P1-3 fails (grep -oP) |
| Scoring weights match adopted spec | P2-5 (responsiveness 15 vs 20) |
| Stale threshold matches HEARTBEAT | P3-4 (7 vs 14 days) |

---

## Testability Assessment (per team-lead directive)

### Good: all scripts are testable in isolation
- All accept CLI args (no interactive prompts)
- All output JSON (parseable by `jq .`)
- `PROJECT_DIR` / `WORKSPACE_DIR` are overridable via env vars — tests can point to a temp dir
- Exit codes are consistent (0=pass, 1=fail)

### Issues blocking clean testing

1. **workspace-setup.sh creates real workspaces in /tmp** — tests need cleanup hooks to rm the cloned repos
2. **workspace-cleanup.sh lock matching is broken** (P2-1) — integration tests will show lock files never getting cleaned
3. **No input validation** (P2-6) — tests with malformed args may produce confusing failures instead of clean error messages
4. **heartbeat-status.sh reads live state files** — tests need mock wake-state.md and work-queue.md in the test PROJECT_DIR
5. **pr-portfolio-stats.sh and scan-pr-reviews.sh make live API calls** — unit tests need to mock `gh` output or use known-stable PRs
6. **compute-merge-probability.sh reads trust-repos.md** — tests need a mock trust file with known tier entries

### Recommended test structure

```
scripts/tests/
  test-workspace-setup.sh      # unit: mock health check, known repo (e.g., badlogic/pi-mono)
  test-workspace-cleanup.sh    # unit: create temp workspace + lock, verify cleanup
  test-check-blocklist.sh      # unit: mock trust-repos.md with known entries
  test-check-already-fixed.sh  # unit: known closed issue + known open issue
  test-check-supersession.sh   # unit: known assigned issue + known unassigned
  test-pr-portfolio-stats.sh   # integration: just runs and validates JSON output
  test-heartbeat-status.sh     # unit: mock state files
  test-compute-merge-probability.sh  # unit: known repos, verify score ranges
  test-analyze-repo-direction.sh     # integration: known repo, validate JSON
  test-scan-pr-reviews.sh      # integration: known BillionClaw PR, validate classification
  test-json-validity.sh        # meta: runs ALL scripts and pipes output through jq .
```

Each test should:
- Set `PROJECT_DIR` to a temp directory
- Create mock state files as needed
- Run the script
- Validate exit code
- Validate JSON output via `jq .`
- Clean up temp files

---

## Round 2: New Script Review (14 scripts from commit 6d433f5)

### batch-close-invalid.sh
- **P1-5**: Line 78 — auto-closes stale PRs (>14 days, no reviews). Contradicts "never close PRs" policy. PR monitor says "Do NOT close, only bump." Stale check should be removed or changed to bump.

### respond-to-review.sh
- **P2-7**: Line 44 — identity response says "AI-assisted development tools". AGENTS.md forbids "AI assistance". Recommend: "automated tooling" instead.

### workspace-submit.sh
- **P1-6**: Line 49 — size gate is 500 lines, should be 200. All docs say HARD MAX 200.
- **P1-7**: Lines 85-96 — PR body missing required disclosure line from template.
- **P1-8**: Line 79 — dedup regex `#${ISSUE}` has no word boundary. `#3` matches `#30`, `#300`.
- **P2-8**: Line 100 — anti-slop filter deletes words mid-sentence, produces broken text.
- **P2-9**: No format-pr-description.sh integration despite template referencing it.

### scan-pr-reviews.sh (rewritten)
- FIXED: stale threshold issue (no longer in script)
- FIXED: JSON boolean issue (rewritten with Python)
- Minor: bash variable interpolation into Python (safe in practice)

---

## Summary

### P1 bugs (must fix before deploying):
1. **P1-1**: workspace-setup.sh blocklist check is a no-op (piped grep -q)
2. **P1-2**: workspace-setup.sh HEALTH_RESULT uninitialized in fallback
3. **P1-3**: heartbeat-status.sh `grep -oP` doesn't work on macOS
4. **P1-4**: pr-portfolio-stats.sh `--merged` flag doesn't exist for `gh search prs`
5. **P1-5**: batch-close-invalid.sh auto-closes stale PRs, contradicts "never close" policy
6. **P1-6**: workspace-submit.sh size gate 500→200
7. **P1-7**: workspace-submit.sh PR body missing disclosure line
8. **P1-8**: workspace-submit.sh dedup regex no word boundary

### P2 bugs:
1. **P2-1**: workspace-cleanup.sh lock matching never works
2. **P2-2**: compute-merge-probability.sh threshold 30 vs spec 40 (may be intentional)
3. **P2-5**: responsiveness weight 15 vs adopted 20 (may be intentional)
4. **P2-6**: No input validation on REPO argument
5. **P2-7**: respond-to-review.sh identity text too close to forbidden "AI assistance"
6. **P2-8**: workspace-submit.sh anti-slop filter breaks sentences
7. **P2-9**: workspace-submit.sh missing format-pr-description.sh integration

### Cross-file PATH bug (P0):
- HEARTBEAT.md, AGENTS.md, 3 skill files use relative `scripts/` paths
- Agent workspace is `/Users/kevinlin/clawoss/workspace/` — scripts resolve to wrong location
- ALL gate checks silently skipped. See collab_space/v10-critique-three-design-flaws.md.
