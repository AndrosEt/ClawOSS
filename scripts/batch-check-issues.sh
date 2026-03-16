#!/usr/bin/env bash
# batch-check-issues.sh — Batch-check multiple issues for supersession, already-fixed, blocklist, health
# Usage: batch-check-issues.sh <issues_file>
# Input file: one "owner/repo#number" per line
# Also accepts stdin: echo "owner/repo#123" | batch-check-issues.sh -
# Outputs JSON array of results

if [ "${1:-}" = "--help" ]; then
  echo "Usage: batch-check-issues.sh <issues_file>"
  echo "Input: one 'owner/repo#number' per line"
  echo "Also accepts stdin: echo 'owner/repo#123' | batch-check-issues.sh -"
  exit 0
fi

PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
SCRIPTS="$PROJECT_DIR/scripts"
INPUT="${1:?Usage: batch-check-issues.sh <issues_file> (use - for stdin)}"

# Read input
if [ "$INPUT" = "-" ]; then
  ISSUES=$(cat)
else
  if [ ! -f "$INPUT" ]; then
    echo '{"error": "file not found: '"$INPUT"'"}'
    exit 1
  fi
  ISSUES=$(cat "$INPUT")
fi

# Process each issue
python3 -c "
import subprocess, json, sys, os

scripts_dir = os.environ.get('PROJECT_DIR', '/Users/kevinlin/clawOSS') + '/scripts'
lines = '''$ISSUES'''.strip().split('\n')
results = []

for line in lines:
    line = line.strip()
    if not line or line.startswith('#'):
        continue

    # Parse owner/repo#number
    if '#' not in line:
        results.append({'input': line, 'error': 'invalid format, expected owner/repo#number'})
        continue

    repo, number = line.rsplit('#', 1)
    repo = repo.strip().strip('-').strip('[').strip(']').strip()
    number = number.strip()

    if not repo or not number.isdigit():
        results.append({'input': line, 'error': 'invalid format'})
        continue

    result = {
        'repo': repo,
        'issue': int(number),
        'blocklist': 'pass',
        'health': 'pass',
        'supersession': 'pass',
        'already_fixed': 'pass',
        'overall': 'pass'
    }

    # 1. Blocklist (fastest — no API calls)
    try:
        r = subprocess.run(['bash', f'{scripts_dir}/check-blocklist.sh', repo],
                          capture_output=True, text=True, timeout=5)
        if r.returncode != 0:
            result['blocklist'] = 'fail'
            result['overall'] = 'fail'
            result['fail_reason'] = 'blocklisted'
            results.append(result)
            continue
    except: pass

    # 2. Health check
    try:
        r = subprocess.run(['bash', f'{scripts_dir}/repo-health-check.sh', repo],
                          capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            result['health'] = 'fail'
            result['overall'] = 'fail'
            try:
                d = json.loads(r.stdout)
                result['fail_reason'] = d.get('failure_reason', 'health check failed')
            except:
                result['fail_reason'] = 'health check failed'
            results.append(result)
            continue
    except: pass

    # 3. Already-fixed
    try:
        r = subprocess.run(['bash', f'{scripts_dir}/check-already-fixed.sh', repo, number],
                          capture_output=True, text=True, timeout=15)
        if r.returncode != 0:
            result['already_fixed'] = 'fail'
            result['overall'] = 'fail'
            result['fail_reason'] = 'already_fixed_upstream'
            results.append(result)
            continue
    except: pass

    # 4. Supersession
    try:
        r = subprocess.run(['bash', f'{scripts_dir}/check-supersession.sh', repo, number],
                          capture_output=True, text=True, timeout=15)
        if r.returncode != 0:
            result['supersession'] = 'fail'
            result['overall'] = 'fail'
            result['fail_reason'] = 'superseded'
            results.append(result)
            continue
    except: pass

    results.append(result)

print(json.dumps(results, indent=2))
" 2>/dev/null || echo '[]'

exit 0
