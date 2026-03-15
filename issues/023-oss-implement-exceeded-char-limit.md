# 023: oss-implement Skill Exceeded 2000 Char Limit After Rewrite

**Status:** Fixed (condensed from 3605 to 1895 chars)
**Severity:** Medium
**Component:** workspace/skills/oss-implement/SKILL.md

## Description

The `oss-implement` skill was rewritten to use a "reproduce-first" TDD-style workflow (reproduce bug, write failing test, implement minimal fix, verify fix, self-review with evidence). The rewrite expanded the skill from ~1172 chars to 3605 chars, exceeding the 2000 char limit enforced by `validate-config.mjs`.

## Fix Applied

Condensed the skill from 3605 to 1895 chars while preserving all reproduce-first workflow steps:
- Removed the full PR description template (replaced with inline format description)
- Condensed verbose explanations into terse instructions
- Merged related bullet points
- Kept all 6 workflow steps, constraints, and related skills references

## Also Noted

5 new "superpowers" skills were added to the workspace:
- `brainstorming` (10571 chars)
- `requesting-code-review` (2935 chars)
- `systematic-debugging` (9884 chars)
- `test-driven-development` (9867 chars)
- `verification-before-completion` (4201 chars)

These are NOT in the validator's `requiredSkills` list, so they don't fail validation. They appear to be OpenClaw built-in superpowers skills with different size constraints.

## Related Files

- `workspace/skills/oss-implement/SKILL.md`
- `scripts/validate-config.mjs` (char limit enforcement)
