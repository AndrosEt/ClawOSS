# V9 CLA Policy Audit — All References

**Date**: 2026-03-17
**Auditor**: critique agent
**Policy**: Nuanced — sign automatable CLAs (CLA-assistant, DCO), SKIP non-automatable (apache, microsoft, google, meta-llama)

---

## Current Policy (post-AGENTS.md update)

The CLA policy has evolved from "block all CLA orgs" to a nuanced approach:
- **CLA-assistant repos** (BerriAI, deepset-ai, iterative, Aider-AI, milvus-io): Sign via GitHub OAuth click. ALLOWED.
- **DCO repos**: Use `git commit -s`. ALLOWED.
- **Non-automatable CLA orgs** (apache, microsoft, google, meta-llama): Require identity verification, postal mail, or web forms a bot cannot complete. HARD SKIP.
- **All other CLA repos**: Sign and contribute.

---

## File-by-File Audit

### CONSISTENT with nuanced policy

| File | Line(s) | Content | Status |
|------|---------|---------|--------|
| `workspace/AGENTS.md` | 52-56 | Nuanced CLA policy with automatable vs non-automatable distinction | CORRECT |
| `workspace/HEARTBEAT.md` | 64 | "what CLA did you sign?" as example maintainer question | OK (contextual) |
| `workspace/HEARTBEAT.md` | 72 | CLA question example in maintainer_question classification | OK (contextual) |
| `workspace/HEARTBEAT.md` | 125 | "If repo requires CLA, sign it -- do NOT skip" | NEEDS UPDATE -- should mention non-automatable exception |
| `workspace/HEARTBEAT.md` | 135 | "pass key info (target branch, CLA, CI) to subagent" | OK (informational) |
| `workspace/skills/oss-submit/SKILL.md` | 85 | CLA honesty rule -- sign if required, don't lie | CORRECT |
| `workspace/skills/oss-followup/SKILL.md` | 148 | "what CLA did you sign?" as example question | OK (contextual) |
| `workspace/skills/oss-followup/SKILL.md` | 152 | CLA question response -- sign or confirm | CORRECT |
| `workspace/skills/oss-triage/SKILL.md` | 68 | "CLA/DCO repos are allowed" | NEEDS UPDATE -- should note non-automatable exception |
| `workspace/skills/oss-discover/SKILL.md` | 72, 81, 92 | CLA repo annotations "(CLA repo -- sign when prompted)" | NEEDS UPDATE -- microsoft repos should NOT say "sign when prompted" |
| `workspace/skills/oss-discover/SKILL.md` | 206 | "CLA/DCO repos are allowed" | NEEDS UPDATE -- should note non-automatable exception |
| `workspace/skills/oss-pr-review-handler/SKILL.md` | 57 | CLA question response guidance | CORRECT |
| `workspace/skills/repo-analyzer/SKILL.md` | 106 | "CLA/DCO repos are allowed" with full org list | NEEDS UPDATE -- should distinguish automatable vs non-automatable |
| `workspace/templates/subagent-implementation.md` | 77 | "CLA/DCO: If required, sign it" | CORRECT |
| `workspace/templates/subagent-implementation.md` | 78 | Non-automatable CLA orgs ABANDON list | CORRECT |
| `workspace/templates/subagent-implementation.md` | 348-349 | CLA rule for PR body | CORRECT |
| `workspace/templates/subagent-followup.md` | 75-78 | CLA question handling -- sign or confirm | CORRECT |
| `workspace/templates/subagent-scout.md` | 109 | "CLA/DCO repos are allowed" | NEEDS UPDATE -- should note non-automatable exception |
| `workspace/templates/subagent-result-schema.md` | 145 | `cla_signing_failed` outcome | CORRECT (new outcome for failed attempts) |
| `scripts/repo-health-check.sh` | 275-297 | Nuanced: non-automatable = hard fail, automatable = allowed | CORRECT |
| `scripts/restart.sh` | 370 | "Sign CLAs when prompted" in wake message | OK (general guidance) |
| `scripts/restart.sh` | 388 | "CLA auto-signing" in summary | OK |
| `config/cron-jobs.json` | 10 | "CLA/DCO repos are allowed" in discovery prompt | NEEDS UPDATE -- should note non-automatable exception |
| `config/openclaw.json` | 56 (heartbeat) | "Sign CLAs when prompted. For DCO, use git commit -s. Do NOT skip repos because of CLA requirements." | NEEDS UPDATE -- should mention non-automatable exception |

### Dashboard files (informational only -- not directives)

| File | Line(s) | Content | Status |
|------|---------|---------|--------|
| `dashboard/app/api/metrics/action-items/route.ts` | 155 | "CLA is no longer flagged" comment | OK |
| `dashboard/app/api/metrics/autonomy/route.ts` | 150, 196, 212, 289 | CLA comments -- all say "informational only" or "no longer a failure" | OK |

### CLAW_API_KEY references (NOT CLA-related -- false positives)

These are `CLAW_API_KEY` (dashboard auth token), not CLA:
- `dashboard/lib/auth-api.ts:6`, `dashboard/lib/github.ts:19`
- `workspace/hooks/dashboard-reporter/*.ts`, `workspace/hooks/audit-logger/*.ts`
- `scripts/setup.sh`, `scripts/restart.sh`, `scripts/dashboard-sync.sh`
- All HOOK.md files

---

## Files Needing Updates (7)

### 1. `workspace/HEARTBEAT.md` line 125
**Current**: `If repo requires CLA, sign it — do NOT skip.`
**Should be**: `If repo requires CLA, sign it — do NOT skip. Exception: non-automatable CLA orgs (apache, microsoft, google, meta-llama) are blocked by repo-health-check.sh.`

### 2. `workspace/skills/oss-triage/SKILL.md` line 68
**Current**: `CLA/DCO repos are allowed — the agent signs CLAs when prompted`
**Should be**: `CLA/DCO repos are allowed — the agent signs CLAs when prompted. Non-automatable CLAs (apache, microsoft, google, meta-llama) are blocked by repo-health-check.sh.`

### 3. `workspace/skills/oss-discover/SKILL.md` lines 72, 81, 92
**Current**: Microsoft repos annotated as `(CLA repo — sign when prompted)`
**Should be**: Remove microsoft annotations or change to `(Non-automatable CLA — SKIP)` for microsoft repos. Keep BerriAI/deepset-ai/etc annotations as-is.

### 4. `workspace/skills/oss-discover/SKILL.md` line 206
**Current**: `CLA/DCO repos are allowed — the agent signs CLAs when prompted.`
**Should be**: Same + non-automatable exception note.

### 5. `workspace/skills/repo-analyzer/SKILL.md` line 106
**Current**: Lists all CLA orgs together as "informational"
**Should be**: Split into automatable (sign) vs non-automatable (skip).

### 6. `workspace/templates/subagent-scout.md` line 109
**Current**: `CLA/DCO repos are allowed — the agent signs CLAs when prompted.`
**Should be**: Same + non-automatable exception note (or rely on health-check script to catch it).

### 7. `config/openclaw.json` heartbeat prompt (line 56)
**Current**: `Sign CLAs when prompted. For DCO, use git commit -s. Do NOT skip repos because of CLA requirements.`
**Should be**: Add: `Exception: apache/microsoft/google/meta-llama have non-automatable CLAs — repo-health-check.sh blocks these.`

Also update `~/.openclaw/openclaw.json` heartbeat prompt to match (dual config sync).

---

## Summary

- **17 files** contain CLA references
- **10 files** are already consistent with nuanced policy
- **7 files** need minor updates to add non-automatable exception note
- **0 files** have the old "block all CLA" policy (fully removed)
- The core logic is correct: `repo-health-check.sh` blocks non-automatable orgs, everything else is allowed
- The text updates are defense-in-depth -- the script catches these before they reach the agent

### Verification Checklist (for after builder applies fixes)

- [ ] HEARTBEAT.md line 125 mentions non-automatable exception
- [ ] oss-triage/SKILL.md line 68 mentions non-automatable exception
- [ ] oss-discover/SKILL.md lines 72, 81, 92 updated for microsoft
- [ ] oss-discover/SKILL.md line 206 mentions non-automatable exception
- [ ] repo-analyzer/SKILL.md line 106 split into automatable/non-automatable
- [ ] subagent-scout.md line 109 mentions non-automatable exception
- [ ] Both config/openclaw.json AND ~/.openclaw/openclaw.json heartbeat prompts updated
- [ ] `repo-health-check.sh` already correct (lines 275-297)
- [ ] `AGENTS.md` already correct (lines 52-56)
- [ ] `subagent-implementation.md` already correct (line 78)
