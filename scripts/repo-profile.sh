#!/usr/bin/env bash
# repo-profile.sh — Full repo intelligence in one call
# Usage: repo-profile.sh <owner/repo> [--write]
# Combines: health check + direction analysis + trust score + CONTRIBUTING parsing + CLA + anti-AI
# --write flag: writes complete profile to memory/repos/{owner}_{repo}.md
# Outputs JSON with all data. Exit 0 = healthy, Exit 1 = skip

if [ "${1:-}" = "--help" ]; then
  echo "Usage: repo-profile.sh <owner/repo> [--write]"
  echo "Full repo intelligence: health, direction, trust, CLA, anti-AI, merge patterns."
  exit 0
fi

REPO="${1:?Usage: repo-profile.sh <owner/repo> [--write]}"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
SCRIPTS="$PROJECT_DIR/scripts"
WRITE_PROFILE=false

shift 1 2>/dev/null || true
while [ $# -gt 0 ]; do
  case "$1" in
    --write) WRITE_PROFILE=true; shift ;;
    *) shift ;;
  esac
done

# ─── 1. Health check ───
HEALTH_JSON=$(bash "$SCRIPTS/repo-health-check.sh" "$REPO" 2>/dev/null)
HEALTH_EXIT=$?

if [ $HEALTH_EXIT -ne 0 ]; then
  # Unhealthy — output health result and exit
  echo "$HEALTH_JSON"
  exit 1
fi

# ─── 2. Direction analysis ───
DIRECTION_JSON=$(bash "$SCRIPTS/analyze-repo-direction.sh" "$REPO" 2>/dev/null || echo '{}')

# ─── 3. Trust score ───
TRUST_FILE="$PROJECT_DIR/workspace/memory/trust-repos.md"
TRUST_TIER="unknown"
TRUST_SCORE=0.3
if [ -f "$TRUST_FILE" ]; then
  if awk '/^## Tier 1/,/^## /' "$TRUST_FILE" | grep -qi "$REPO"; then
    TRUST_TIER="tier1"
    TRUST_SCORE=1.0
  elif awk '/^## Tier 2/,/^## /' "$TRUST_FILE" | grep -qi "$REPO"; then
    TRUST_TIER="tier2"
    TRUST_SCORE=0.7
  elif awk '/^## Deprioritized/,/^## /' "$TRUST_FILE" | grep -qi "$REPO"; then
    TRUST_TIER="deprioritized"
    TRUST_SCORE=0.0
  else
    TRUST_TIER="new"
    TRUST_SCORE=0.3
  fi
fi

# ─── 4. CONTRIBUTING.md analysis ───
CONTRIB_JSON=$(bash "$SCRIPTS/check-contributing-guide.sh" "$REPO" 2>/dev/null || echo '{}')

# ─── 5. CLA detection ───
CLA_JSON=$(bash "$SCRIPTS/sign-cla.sh" "$REPO" 2>/dev/null || echo '{"cla_type": "unknown"}')
CLA_EXIT=$?

# ─── 6. Blocklist check ───
BLOCKLIST_JSON=$(bash "$SCRIPTS/check-blocklist.sh" "$REPO" 2>/dev/null || echo '{"blocked": false}')
IS_BLOCKED=$(echo "$BLOCKLIST_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('blocked', False))" 2>/dev/null || echo "False")

# ─── 7. Combine into full profile ───
PROFILE=$(python3 -c "
import json, sys

health = json.loads('''$(echo "$HEALTH_JSON" | python3 -c "import json,sys; print(json.dumps(json.loads(sys.stdin.read())))" 2>/dev/null || echo '{}')''')
direction = json.loads('''$(echo "$DIRECTION_JSON" | python3 -c "import json,sys; print(json.dumps(json.loads(sys.stdin.read())))" 2>/dev/null || echo '{}')''')
contrib = json.loads('''$(echo "$CONTRIB_JSON" | python3 -c "import json,sys; print(json.dumps(json.loads(sys.stdin.read())))" 2>/dev/null || echo '{}')''')
cla = json.loads('''$(echo "$CLA_JSON" | python3 -c "import json,sys; print(json.dumps(json.loads(sys.stdin.read())))" 2>/dev/null || echo '{}')''')

profile = {
    'repo': '$REPO',
    'healthy': True,
    'health_score': health.get('score', 0),
    'trust_tier': '$TRUST_TIER',
    'trust_score': $TRUST_SCORE,
    'is_blocked': $IS_BLOCKED,
    'health_metrics': health.get('metrics', {}),
    'direction': {
        'active_modules': direction.get('active_modules', [])[:5],
        'priority_labels': direction.get('priority_labels', []),
        'latest_release': direction.get('latest_release', {}),
        'default_branch': direction.get('default_branch', 'main'),
    },
    'contributing': {
        'has_contributing': contrib.get('has_contributing', False),
        'target_branch': contrib.get('target_branch', 'main'),
        'commit_convention': contrib.get('commit_convention', 'none'),
        'ai_disclosure': contrib.get('ai_disclosure', 'none'),
        'anti_ai_policy': contrib.get('anti_ai_policy', False),
    },
    'cla': {
        'type': cla.get('cla_type', 'none'),
        'signed': cla.get('signed', True),
    },
}
print(json.dumps(profile, indent=2))
" 2>/dev/null || echo '{"repo": "'"$REPO"'", "error": "profile generation failed"}')

echo "$PROFILE"

# ─── 8. Write to memory if requested ───
if [ "$WRITE_PROFILE" = true ]; then
  PROFILE_DIR="$PROJECT_DIR/workspace/memory/repos"
  mkdir -p "$PROFILE_DIR"
  PROFILE_FILE="$PROFILE_DIR/${OWNER}_${REPO_NAME}.md"

  cat > "$PROFILE_FILE" <<PROFILE_EOF
# Repo Profile: $REPO
**Generated**: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Health
$(echo "$HEALTH_JSON" | python3 -c "
import json,sys
d = json.load(sys.stdin)
m = d.get('metrics', {})
print(f'- Score: {d.get(\"score\", 0)}')
print(f'- Stars: {m.get(\"stars\", 0)}')
print(f'- Merge velocity: {m.get(\"recent_merges_30d\", 0)} merges/30d, avg {m.get(\"avg_merge_days\", 0)}d')
print(f'- Review rate: {m.get(\"review_rate_pct\", 0)}%')
print(f'- Open PRs: {m.get(\"open_prs\", 0)}')
print(f'- Niche fit: {m.get(\"niche_fit\", False)}')
" 2>/dev/null || echo "- Health data unavailable")

## Trust
- Tier: $TRUST_TIER
- Score: $TRUST_SCORE

## Direction
$(echo "$DIRECTION_JSON" | python3 -c "
import json,sys
d = json.load(sys.stdin)
mods = d.get('active_modules', [])
print(f'- Default branch: {d.get(\"default_branch\", \"main\")}')
if mods:
    print(f'- Active modules: {', '.join(m[\"module\"] for m in mods[:5])}')
labels = d.get('priority_labels', [])
if labels:
    print(f'- Priority labels: {', '.join(labels)}')
rel = d.get('latest_release', {})
if rel.get('tag'):
    print(f'- Latest release: {rel[\"tag\"]} ({rel.get(\"date\", \"unknown\")})')
" 2>/dev/null || echo "- Direction data unavailable")

## Contributing
$(echo "$CONTRIB_JSON" | python3 -c "
import json,sys
d = json.load(sys.stdin)
print(f'- Target branch: {d.get(\"target_branch\", \"main\")}')
print(f'- Commit convention: {d.get(\"commit_convention\", \"none\")}')
print(f'- CLA type: {d.get(\"cla_type\", \"none\")}')
print(f'- AI disclosure: {d.get(\"ai_disclosure\", \"none\")}')
print(f'- Anti-AI policy: {d.get(\"anti_ai_policy\", False)}')
" 2>/dev/null || echo "- Contributing data unavailable")
PROFILE_EOF
fi

exit 0
