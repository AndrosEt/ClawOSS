#!/usr/bin/env bash
# repo-profile.sh — Full repo intelligence: health + direction + trust + CONTRIBUTING
# Usage: repo-profile.sh <owner/repo> [--write]
# --write: save profile to workspace/memory/repos/<owner>_<repo>.md
# Exit 0 = healthy, Exit 1 = unhealthy

REPO="${1:?Usage: repo-profile.sh <owner/repo> [--write]}"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
WRITE_PROFILE=""

shift
while [ $# -gt 0 ]; do
  case "$1" in
    --write) WRITE_PROFILE="true"; shift ;;
    *) shift ;;
  esac
done

# ─── 1. Basic repo metadata ───
REPO_DATA=$(gh api "repos/${REPO}" --jq '{
  stars: .stargazers_count,
  forks: .forks_count,
  open_issues: .open_issues_count,
  language: .language,
  default_branch: .default_branch,
  license: (.license.spdx_id // "none"),
  archived: .archived,
  pushed_at: .pushed_at,
  topics: .topics,
  description: .description
}' 2>/dev/null || echo '{}')

STARS=$(echo "$REPO_DATA" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("stars",0))' 2>/dev/null || echo 0)
ARCHIVED=$(echo "$REPO_DATA" | python3 -c 'import json,sys; print(str(json.load(sys.stdin).get("archived",False)).lower())' 2>/dev/null || echo "false")
DEFAULT_BRANCH=$(echo "$REPO_DATA" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("default_branch","main"))' 2>/dev/null || echo "main")

# ─── 2. Health gates ───
HEALTHY="true"
HEALTH_REASON="ok"

[ "$ARCHIVED" = "true" ] && HEALTHY="false" && HEALTH_REASON="Repository is archived"
[ "$STARS" -lt 200 ] && HEALTHY="false" && HEALTH_REASON="Stars ($STARS) below 200 minimum"

# Last push staleness
PUSHED_AT=$(echo "$REPO_DATA" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("pushed_at",""))' 2>/dev/null || echo "")
DAYS_SINCE_PUSH=0
if [ -n "$PUSHED_AT" ]; then
  PUSH_TS=$(date -jf "%Y-%m-%dT%H:%M:%SZ" "$PUSHED_AT" +%s 2>/dev/null || date -d "$PUSHED_AT" +%s 2>/dev/null || echo 0)
  NOW_TS=$(date +%s)
  DAYS_SINCE_PUSH=$(( (NOW_TS - PUSH_TS) / 86400 ))
  [ "$DAYS_SINCE_PUSH" -gt 90 ] && HEALTHY="false" && HEALTH_REASON="No push in ${DAYS_SINCE_PUSH} days"
fi

# ─── 3. Responsiveness (median PR merge time) ───
MEDIAN_MERGE_DAYS=$(gh pr list --repo "$REPO" --state merged --limit 5 --json mergedAt,createdAt --jq '[.[] | {c: .createdAt, m: .mergedAt}]' 2>/dev/null | python3 -c "
import json,sys
from datetime import datetime
prs = json.load(sys.stdin)
if not prs: print(0)
else:
    deltas = []
    for pr in prs:
        try:
            c = datetime.fromisoformat(pr['c'].replace('Z','+00:00'))
            m = datetime.fromisoformat(pr['m'].replace('Z','+00:00'))
            deltas.append((m-c).days)
        except: pass
    print(sorted(deltas)[len(deltas)//2] if deltas else 0)
" 2>/dev/null || echo 0)

# ─── 4. CONTRIBUTING.md ───
CONTRIBUTING=$(curl -sL "https://raw.githubusercontent.com/${REPO}/${DEFAULT_BRANCH}/CONTRIBUTING.md" 2>/dev/null | head -200)
HAS_CONTRIBUTING="false"
HAS_CLA="false"
CLA_TYPE="none"
ANTI_BOT="false"

if [ -n "$CONTRIBUTING" ] && ! echo "$CONTRIBUTING" | head -1 | grep -q "^404"; then
  HAS_CONTRIBUTING="true"
  echo "$CONTRIBUTING" | grep -qiE "contributor license agreement|dco|signed-off-by" && HAS_CLA="true"
  echo "$CONTRIBUTING" | grep -qiE "developer certificate of origin|dco|signed-off-by" && CLA_TYPE="dco"
  echo "$CONTRIBUTING" | grep -qiE "contributor license agreement" && [ "$CLA_TYPE" = "none" ] && CLA_TYPE="cla-assistant"
  echo "$CONTRIBUTING" | grep -qiE "no (bot|ai[- ]generated|automated)|human[- ]only" && ANTI_BOT="true" && HEALTHY="false" && HEALTH_REASON="Anti-bot policy"
fi

# ─── 5. Trust score ───
TRUST_FILE="$PROJECT_DIR/workspace/memory/trust-repos.md"
TRUST_SCORE=5
TRUST_STATUS="unknown"
if [ -f "$TRUST_FILE" ]; then
  ACTIVE_LINE=$(awk '/^## Active/,/^## /' "$TRUST_FILE" | grep -i "${OWNER}/${REPO_NAME}" || true)
  DEPRI_LINE=$(awk '/^## Deprioritized/,/^## /' "$TRUST_FILE" | grep -i "${OWNER}/${REPO_NAME}" || true)
  if [ -n "$ACTIVE_LINE" ]; then
    TRUST_STATUS="active"
    TRUST_SCORE=$(echo "$ACTIVE_LINE" | grep -oE '[0-9]+' | head -1)
    TRUST_SCORE="${TRUST_SCORE:-7}"
  elif [ -n "$DEPRI_LINE" ]; then
    TRUST_STATUS="deprioritized"
    TRUST_SCORE=0
  fi
fi

# ─── 6. Recent commit themes ───
RECENT_COMMITS=$(gh api "repos/${REPO}/commits?per_page=20" --jq '[.[].commit.message | split("\n")[0]]' 2>/dev/null || echo "[]")

# ─── 7. Write profile if requested ───
if [ "$WRITE_PROFILE" = "true" ]; then
  PROFILE_DIR="$PROJECT_DIR/workspace/memory/repos"
  mkdir -p "$PROFILE_DIR"
  cat > "$PROFILE_DIR/${OWNER}_${REPO_NAME}.md" <<EOMD
# ${REPO} Profile
Updated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

- Stars: ${STARS} | Language: $(echo "$REPO_DATA" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("language","?"))' 2>/dev/null)
- Default branch: ${DEFAULT_BRANCH} | Merge time: ${MEDIAN_MERGE_DAYS}d
- CLA: ${HAS_CLA} (${CLA_TYPE}) | Anti-bot: ${ANTI_BOT}
- Trust: ${TRUST_STATUS} (${TRUST_SCORE})
EOMD
fi

# ─── 8. Output JSON ───
cat <<ENDJSON
{
  "repo": "$REPO",
  "healthy": $HEALTHY,
  "health_reason": $(echo "$HEALTH_REASON" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo '"ok"'),
  "metrics": {"stars": $STARS, "days_since_push": $DAYS_SINCE_PUSH, "median_merge_days": $MEDIAN_MERGE_DAYS},
  "repo_data": $REPO_DATA,
  "contributing": {"has_contributing": $HAS_CONTRIBUTING, "has_cla": $HAS_CLA, "cla_type": "$CLA_TYPE", "anti_bot": $ANTI_BOT},
  "trust": {"status": "$TRUST_STATUS", "score": ${TRUST_SCORE:-5}},
  "default_branch": "$DEFAULT_BRANCH",
  "recent_commits": $RECENT_COMMITS
}
ENDJSON

[ "$HEALTHY" = "true" ] && exit 0 || exit 1
