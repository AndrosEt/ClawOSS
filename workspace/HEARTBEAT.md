# Heartbeat Checklist

On each heartbeat (every 60 minutes):

1. **Check active PRs**: Use `gh pr list --author @me` to check for review comments
   - If reviews received, trigger oss-followup skill
2. **Check PR CI status**: Any failing checks on open PRs?
   - If CI failing on our PR, investigate and push fix
3. **Find new work**: If no active PRs need attention, trigger oss-discover skill
4. **Report status**: Send heartbeat data to dashboard via dashboard-reporter skill
5. **Memory maintenance**: If memory/today.md is empty, write a status summary

If nothing needs attention: HEARTBEAT_OK
