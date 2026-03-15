---
name: oss-triage
description: "Triage GitHub issues: assess feasibility, estimate complexity, check for duplicates, evaluate if issue matches agent capabilities. Used during daily discovery cron."
user-invocable: true
---

# OSS Issue Triage

Assess GitHub issues for contribution feasibility.

## Process
1. Read issue body and all comments thoroughly
2. Check labels and metadata
3. Assess complexity level:
   - **Simple**: single-file fix, clear repro steps, well-defined scope
   - **Medium**: 2-5 files, requires understanding component interactions
   - **Complex**: architectural changes, cross-cutting concerns, unclear scope
4. Check memory for similar past issues or prior attempts
5. Evaluate success probability based on:
   - Issue clarity and specificity
   - Repo's CI/test infrastructure quality
   - Our prior track record with this repo
   - Whether issue has a clear acceptance criteria

## Decision
- **Attempt**: simple/medium issues with clear scope, high success probability
- **Skip**: complex issues, unclear requirements, repos with high rejection rate
- **Defer**: medium issues that need more context — revisit after learning more about repo

## Output
Write triage assessment to memory with:
- Issue URL, repo, complexity rating
- Recommended action (attempt/skip/defer)
- Reasoning for the decision
