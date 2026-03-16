---
name: oss-triage
description: "Triage GitHub bug reports: confirm it's a real bug (not a feature request), assess reproducibility, estimate fix complexity, check for duplicates. REJECT non-bug issues."
user-invocable: true
---

# OSS Bug Triage

Assess GitHub issues for contribution feasibility. **Only bugs pass triage.** Feature requests, refactors, and enhancements are rejected immediately.

## Step 0: Bug Gate (MANDATORY — do this FIRST)
Before any other assessment, determine if this is a genuine bug report:

**IS a bug** (proceed to Step 1):
- Reports incorrect behavior ("X does Y but should do Z")
- Contains error messages, stack traces, or crash logs
- Describes a regression ("X worked in v1.2 but broke in v1.3")
- Has reproduction steps showing something is broken
- Reports data corruption, incorrect output, or unexpected exceptions
- Labeled `bug`, `defect`, `regression`, `crash`, `error`

**NOT a bug** (SKIP immediately):
- Requests new functionality ("add support for X", "implement Y")
- Asks for improvements ("make X faster", "improve Y experience")
- Proposes refactoring ("rewrite X", "restructure Y", "clean up Z")
- Architectural changes ("migrate to X", "replace Y with Z")
- Enhancement requests ("support X format", "add option for Y")
- Discussion/RFC/proposal issues
- Documentation improvements (unless documenting incorrect behavior)
- Performance optimizations without a concrete correctness bug
- Labeled `enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`, `question`, `proposal`, `rfc`

If the issue fails the Bug Gate, write "SKIP: not a bug — [reason]" and move on. Do NOT proceed further.

## Step 1: Read & Analyze
1. Read issue body and all comments thoroughly
2. Check labels and metadata
3. Look for bug indicators:
   - Stack traces or error logs (strong signal)
   - "Expected vs actual" descriptions (strong signal)
   - Reproduction steps (strong signal)
   - Regression reports with version numbers (strong signal)
   - Screenshots showing broken UI/behavior (moderate signal)

## Step 2: Assess Complexity
- **Simple**: single-file fix, clear repro steps, well-defined scope, obvious root cause
- **Medium**: 2-5 files, requires understanding component interactions, but bug is reproducible
- **Complex**: architectural changes, cross-cutting concerns, unclear root cause, hard to reproduce

## Step 3: Evaluate Feasibility
1. Check memory for similar past issues or prior attempts
2. Evaluate success probability based on:
   - Bug clarity and specificity (has repro steps? has stack trace?)
   - Repo's CI/test infrastructure quality (can we run tests?)
   - Our prior track record with this repo
   - Whether the expected behavior is clearly defined
   - Whether existing tests cover the area (easier to verify fix)

## Bug Quality Score
Score each bug 1-10:
- **+3** Has clear reproduction steps
- **+2** Has stack trace or error message
- **+2** Has "expected vs actual" description
- **+1** Labeled `bug` or `defect` by maintainer (confirmed bug)
- **+1** Has maintainer engagement (comments from repo owners)
- **+1** Repo has good CI/test infrastructure
- **-2** Vague description, no repro steps
- **-2** Might be a feature request disguised as a bug
- **-1** Issue older than 6 months with no recent activity
- **-1** Repo has history of rejecting external PRs

Minimum score 5 to attempt.

## Decision
- **Attempt**: Simple/medium bugs with score >= 5, clear repro steps, high fix probability
- **Skip**: Non-bugs, complex issues, unclear requirements, repos with high rejection rate, score < 5
- **Defer**: Medium bugs that need more context — revisit after learning more about repo

## Output
Write triage assessment to memory with:
- Issue URL, repo, complexity rating
- Bug Gate result: PASS (confirmed bug) or FAIL (not a bug)
- Bug quality score with breakdown
- Recommended action (attempt/skip/defer)
- Reasoning for the decision
