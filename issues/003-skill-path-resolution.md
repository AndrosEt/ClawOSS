# 003: Skill Path Resolution — Symlinked Skills Get "Outside Root" Warnings

**Status:** Open
**Severity:** Low
**Component:** OpenClaw Skill Loader / Setup Script

## Description

When ClawOSS skills are symlinked from the project workspace into `~/.openclaw/skills/`, the OpenClaw skill loader may emit "outside root" warnings because the resolved symlink path falls outside the expected skill directory hierarchy.

The skills still load and function correctly, but the warnings clutter gateway logs.

## Observed During v5 Launch

- **Time:** 2026-03-16 17:52 UTC
- **Error:** `ENOENT: no such file or directory, access '/Users/kevinlin/.agents/skills/oss-discover/SKILL.md'`
- Skills existed in workspace but were NOT symlinked into `~/.openclaw/skills/`
- Agent could not invoke any custom skills
- **Fixed at 17:55 UTC** by adding symlink loop to `setup.sh`

## Root Cause

The `setup.sh` script creates symlinks from `~/.openclaw/skills/<skill-name>` pointing to `/path/to/clawOSS/workspace/skills/<skill-name>/`. OpenClaw's skill loader resolves symlinks and checks that the resolved path is within the expected root. Since the resolved path is in the ClawOSS project directory (not `~/.openclaw/`), warnings are emitted.

## Impact

- Log noise from repeated "outside root" warnings on every skill load
- No functional impact — skills load and execute correctly
- May obscure real errors in gateway logs

## Workaround

- Ignore the warnings (they are non-fatal)
- Alternatively, copy skills instead of symlinking (loses live-reload during development)
- The `skills.load.watch: true` config enables hot-reload for development

## Fix Applied

None — cosmetic issue. Could be addressed by OpenClaw adding symlink-aware path resolution, or by changing the setup script to copy instead of symlink for production use.

## Related Files

- `scripts/setup.sh` (creates skill symlinks, lines 89-95)
- `config/openclaw.json` (`skills.load.watch` setting)
- `workspace/skills/` (all 15 skill directories)

## Note: Re-run After Adding New Skills

The symlink loop in `setup.sh` must be re-run after adding new skills (e.g., the 5 superpowers skills added in commit `be9f2db`). Otherwise the new skills won't be accessible to the agent. Run `npm run setup` or manually symlink.
