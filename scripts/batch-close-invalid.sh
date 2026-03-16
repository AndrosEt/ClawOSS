#!/usr/bin/env bash
# batch-close-invalid.sh — Scan and close invalid BillionClaw PRs
# Usage: batch-close-invalid.sh [--dry-run]
# Identifies: low-star repos, feat: titles, self-fork PRs, true duplicates
# Outputs JSON summary of actions taken

if [ "${1:-}" = "--help" ]; then
  echo "Usage: batch-close-invalid.sh [--dry-run]"
  echo "Scans all open BillionClaw PRs and closes invalid ones."
  exit 0
fi

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

# Fetch all open PRs
OPEN_PRS=$(gh search prs --author BillionClaw --state open --limit 50 \
  --json repository,number,title,url 2>/dev/null || echo '[]')

python3 -c "
import json, sys, subprocess

dry_run = $( [ "$DRY_RUN" = true ] && echo 'True' || echo 'False' )
prs = json.loads('''$OPEN_PRS''')
actions = []

# Group PRs by repo to detect duplicates
repo_prs = {}
for pr in prs:
    repo = pr.get('repository', {})
    repo_name = repo.get('nameWithOwner', '') if isinstance(repo, dict) else str(repo)
    number = pr.get('number', 0)
    title = pr.get('title', '')
    url = pr.get('url', '')

    if not repo_name:
        continue

    if repo_name not in repo_prs:
        repo_prs[repo_name] = []
    repo_prs[repo_name].append({'number': number, 'title': title, 'url': url})

    # Check 1: feat: title (feature contribution)
    if title.lower().startswith(('feat:', 'feat(', 'feature:', 'chore:', 'refactor:')):
        reason = f'invalid_contribution: title starts with feature prefix'
        comment = 'Closing — this was submitted as a feature rather than a bug fix. Apologies for the noise.'
        if not dry_run:
            subprocess.run(['gh', 'pr', 'close', str(number), '--repo', repo_name,
                          '--comment', comment], capture_output=True, timeout=15)
        actions.append({'repo': repo_name, 'pr': number, 'action': 'closed', 'reason': reason, 'dry_run': dry_run})
        continue

    # Check 2: Self-fork (BillionClaw owns the repo)
    owner = repo_name.split('/')[0] if '/' in repo_name else ''
    if owner == 'BillionClaw':
        if not dry_run:
            subprocess.run(['gh', 'pr', 'close', str(number), '--repo', repo_name],
                          capture_output=True, timeout=15)
        actions.append({'repo': repo_name, 'pr': number, 'action': 'closed', 'reason': 'self_fork', 'dry_run': dry_run})
        continue

    # Check 3: Low-star repo
    try:
        r = subprocess.run(['gh', 'api', f'repos/{repo_name}', '--jq', '.stargazers_count'],
                          capture_output=True, text=True, timeout=10)
        stars = int(r.stdout.strip()) if r.stdout.strip().isdigit() else 0
        if stars < 200:
            comment = 'Closing — this was submitted in error. Apologies for the noise.'
            if not dry_run:
                subprocess.run(['gh', 'pr', 'close', str(number), '--repo', repo_name,
                              '--comment', comment], capture_output=True, timeout=15)
            actions.append({'repo': repo_name, 'pr': number, 'action': 'closed', 'reason': f'low_star_repo: {stars} stars', 'dry_run': dry_run})
            continue
    except:
        pass

# Check 4: Duplicate PRs (same repo, keep newest)
for repo_name, pr_list in repo_prs.items():
    if len(pr_list) > 1:
        # Keep the highest PR number (newest), close the rest
        sorted_prs = sorted(pr_list, key=lambda x: x['number'], reverse=True)
        keep = sorted_prs[0]
        for dup in sorted_prs[1:]:
            # Skip if already closed above
            if any(a['repo'] == repo_name and a['pr'] == dup['number'] for a in actions):
                continue
            comment = f'Closing in favor of #{keep[\"number\"]}.'
            if not dry_run:
                subprocess.run(['gh', 'pr', 'close', str(dup['number']), '--repo', repo_name,
                              '--comment', comment], capture_output=True, timeout=15)
            actions.append({'repo': repo_name, 'pr': dup['number'], 'action': 'closed',
                          'reason': f'duplicate_pr: keeping #{keep[\"number\"]}', 'dry_run': dry_run})

print(json.dumps({
    'total_scanned': len(prs),
    'actions_taken': len(actions),
    'actions': actions,
    'timestamp': '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
}, indent=2))
" 2>/dev/null || echo '{"error": "script failed"}'

exit 0
