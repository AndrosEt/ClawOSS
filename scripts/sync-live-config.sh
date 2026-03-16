#!/usr/bin/env bash
# sync-live-config.sh — Deep-merge config/openclaw.json into ~/.openclaw/openclaw.json
# Usage: sync-live-config.sh [--dry-run]
# Preserves gateway-managed sections (apiKeys, env) in live config
# Exit 0 = synced, Exit 1 = error

if [ "${1:-}" = "--help" ]; then
  echo "Usage: sync-live-config.sh [--dry-run]"
  echo "Deep-merges config/openclaw.json into ~/.openclaw/openclaw.json"
  echo "Preserves apiKeys and env sections from live config."
  exit 0
fi

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
REPO_CONFIG="$PROJECT_DIR/config/openclaw.json"
LIVE_CONFIG="$HOME/.openclaw/openclaw.json"
BACKUP_CONFIG="$HOME/.openclaw/openclaw.json.bak"

if [ ! -f "$REPO_CONFIG" ]; then
  echo '{"synced": false, "error": "repo config not found: '"$REPO_CONFIG"'"}'
  exit 1
fi

if [ ! -f "$LIVE_CONFIG" ]; then
  echo '{"synced": false, "error": "live config not found: '"$LIVE_CONFIG"'"}'
  exit 1
fi

# Deep merge: take all keys from repo config, but preserve sensitive sections from live config
MERGED=$(python3 -c "
import json, copy

with open('$REPO_CONFIG') as f:
    repo = json.load(f)
with open('$LIVE_CONFIG') as f:
    live = json.load(f)

# Start from repo config
merged = copy.deepcopy(repo)

# Preserve gateway-managed sections from live config
PRESERVE_KEYS = ['apiKeys', 'env', 'gateway']

for key in PRESERVE_KEYS:
    if key in live:
        merged[key] = live[key]

# Deep merge nested objects (like 'agent' settings)
def deep_merge(base, overlay):
    for key, value in overlay.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            deep_merge(base[key], value)
        else:
            base[key] = value

# Merge live agent settings into repo agent settings (repo takes precedence for non-sensitive)
if 'agent' in live and 'agent' in merged:
    # Repo config wins for behavioral settings, live wins for runtime settings
    if 'sessions' in live.get('agent', {}):
        # Preserve session-specific runtime state from live
        pass  # repo config sessions take precedence (maxConcurrent, etc.)

# Ensure env section has all keys from live (secrets)
if 'env' in live:
    if 'env' not in merged:
        merged['env'] = {}
    for k, v in live['env'].items():
        if k not in merged['env']:
            merged['env'][k] = v

print(json.dumps(merged, indent=2, ensure_ascii=False))
" 2>/dev/null)

if [ -z "$MERGED" ]; then
  echo '{"synced": false, "error": "merge failed"}'
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  echo "$MERGED"
  echo '---'
  echo '{"synced": false, "dry_run": true, "would_write": "'"$LIVE_CONFIG"'"}'
  exit 0
fi

# Backup live config
cp "$LIVE_CONFIG" "$BACKUP_CONFIG" 2>/dev/null || true

# Write merged config
echo "$MERGED" > "$LIVE_CONFIG"

# Verify JSON is valid
if ! python3 -c "import json; json.load(open('$LIVE_CONFIG'))" 2>/dev/null; then
  # Restore backup
  cp "$BACKUP_CONFIG" "$LIVE_CONFIG" 2>/dev/null || true
  echo '{"synced": false, "error": "merged config is invalid JSON, restored backup"}'
  exit 1
fi

# Count changes
CHANGES=$(python3 -c "
import json
with open('$REPO_CONFIG') as f:
    repo = json.load(f)
with open('$LIVE_CONFIG') as f:
    live = json.load(f)

def count_diff(a, b, prefix=''):
    diffs = []
    all_keys = set(list(a.keys()) + list(b.keys()))
    for k in all_keys:
        path = f'{prefix}.{k}' if prefix else k
        if k not in a:
            diffs.append(f'added: {path}')
        elif k not in b:
            diffs.append(f'removed: {path}')
        elif a[k] != b[k]:
            if isinstance(a[k], dict) and isinstance(b[k], dict):
                diffs.extend(count_diff(a[k], b[k], path))
            else:
                diffs.append(f'changed: {path}')
    return diffs

# We can't meaningfully diff since we just wrote the merged version
# Just confirm write succeeded
print(json.dumps({'synced': True, 'live_config': '$LIVE_CONFIG', 'backup': '$BACKUP_CONFIG'}))
" 2>/dev/null || echo '{"synced": true}')

echo "$CHANGES"
exit 0
