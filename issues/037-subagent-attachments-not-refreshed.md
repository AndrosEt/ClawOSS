# 037: Sub-Agent Attachment Files Not Refreshed Per-Spawn

**Status:** Open
**Severity:** Medium (stale context passed to sub-agents, potential wrong-repo work)
**Component:** workspace/HEARTBEAT.md (step 5), orchestrator runtime behavior

## Description

When the orchestrator spawns a sub-agent, HEARTBEAT.md step 5 instructs:

> Read memory files for repo conventions and issue details BEFORE spawning.
> Pass them as attachments since sub-agents cannot access memory tools.

In practice, the orchestrator reuses attachment content from a previous spawn cycle without re-reading the memory files. This means sub-agent N+1 may receive repo conventions and issue details that were prepared for sub-agent N's completely different task.

## Impact

1. **Wrong context**: A sub-agent working on a Python repo could receive conventions from a Rust repo's previous analysis
2. **Stale issue data**: If an issue was closed or updated between spawn cycles, the sub-agent works with outdated information
3. **Wasted compute**: Sub-agent produces a PR based on wrong assumptions, which gets rejected or is irrelevant
4. **Silent failure**: The sub-agent has no way to know its attachments are stale — it trusts what the orchestrator provides

## Root Cause

The orchestrator runs in a long-lived session with accumulating context. When spawning multiple sub-agents in rapid succession (filling 5 slots), it optimizes by reusing in-context data rather than re-reading files for each spawn. This is a natural LLM behavior — the model "remembers" the last attachment content and doesn't re-execute the file reads.

## Fix

1. **Explicit per-spawn read**: Add to HEARTBEAT.md step 5: "You MUST re-read repo conventions and issue details files immediately before EACH spawn. Do NOT reuse content from a previous spawn cycle. This is a fresh read, not a recall."
2. **Unique attachment naming**: Name attachment files with the issue ID (e.g., `issue-details-repo-123.md`) so the orchestrator can't accidentally reuse a generic `issue-details.md`
3. **Spawn template validation**: Add a line to the spawn task string: "Your issue is {repo}#{number}. If the attached context mentions a DIFFERENT repo or issue number, STOP and report 'stale-context' status."
4. **Programmatic attachment generation**: Create a `scripts/prepare-spawn.sh <repo> <issue>` that generates fresh attachment files and outputs their paths, ensuring the orchestrator always reads current data

## Related Issues

- None directly, but compounds issues #035 and #036 (wrong context leads to wrong PRs)

## Related Files

- `workspace/HEARTBEAT.md` (step 5 — spawn instructions)
- `workspace/memory/repos/` (repo convention files)
- `workspace/memory/issues/` (issue detail files)
