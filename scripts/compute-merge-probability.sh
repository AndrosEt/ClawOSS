#!/usr/bin/env bash
# compute-merge-probability.sh — Compute P(merge) 0-100 using V10 weighted formula
# Usage: ./compute-merge-probability.sh owner/repo [issue_number] [--type bug|docs|typo|test] [--size small|medium|large]
# Outputs JSON: {"score": 65, "breakdown": {...}, "recommendation": "proceed|skip"}
# Exit 0 always (score in JSON)

if [ "${1:-}" = "--help" ]; then
  echo "Usage: compute-merge-probability.sh <owner/repo> [issue_number] [--type bug|docs|typo|test] [--size small|medium|large]"
  echo "Outputs JSON with P(merge) score 0-100"
  exit 0
fi
if [ $# -lt 1 ]; then
  echo "Usage: compute-merge-probability.sh <owner/repo> [issue_number]" >&2
  exit 1
fi

REPO="$1"
ISSUE="${2:-}"
TYPE="bug"
SIZE="medium"
WORKSPACE_DIR="${WORKSPACE_DIR:-/Users/kevinlin/clawOSS/workspace}"

# Parse optional flags
shift
shift 2>/dev/null || true
while [ $# -gt 0 ]; do
  case "$1" in
    --type) TYPE="$2"; shift 2 ;;
    --size) SIZE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Date calculations
if date -v-1d +%Y-%m-%d &>/dev/null; then
  THREE_DAYS_AGO=$(date -v-3d +%Y-%m-%dT00:00:00Z)
  SEVEN_DAYS_AGO=$(date -v-7d +%Y-%m-%dT00:00:00Z)
  FOURTEEN_DAYS_AGO=$(date -v-14d +%Y-%m-%dT00:00:00Z)
  THIRTY_DAYS_AGO=$(date -v-30d +%Y-%m-%dT00:00:00Z)
else
  THREE_DAYS_AGO=$(date -d "3 days ago" +%Y-%m-%dT00:00:00Z)
  SEVEN_DAYS_AGO=$(date -d "7 days ago" +%Y-%m-%dT00:00:00Z)
  FOURTEEN_DAYS_AGO=$(date -d "14 days ago" +%Y-%m-%dT00:00:00Z)
  THIRTY_DAYS_AGO=$(date -d "30 days ago" +%Y-%m-%dT00:00:00Z)
fi

# --- Factor 1: task_type_score (weight: 15) ---
case "$TYPE" in
  docs|typo|documentation) task_type=100 ;;
  test) task_type=75 ;;
  bug|fix) task_type=50 ;;
  *) task_type=0 ;;
esac
task_type_weighted=$(( task_type * 15 / 100 ))

# --- Factor 2: size_score (weight: 20) ---
case "$SIZE" in
  small) size_val=100 ;;    # <30 LOC
  medium) size_val=70 ;;    # 30-100 LOC
  large) size_val=30 ;;     # 100-200 LOC
  *) size_val=0 ;;          # >200 LOC
esac
size_weighted=$(( size_val * 20 / 100 ))

# --- Factor 3: repo_responsiveness (weight: 15) ---
# Check avg merge time from recent merged PRs
AVG_MERGE_DAYS=14  # default
MERGED_DATA=$(gh pr list --repo "$REPO" --state merged --limit 10 --json createdAt,mergedAt 2>/dev/null || echo "[]")
if [ "$MERGED_DATA" != "[]" ] && [ -n "$MERGED_DATA" ]; then
  # Count merged PRs to check if any exist
  MERGE_COUNT=$(echo "$MERGED_DATA" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
  if [ "$MERGE_COUNT" -gt 0 ] 2>/dev/null; then
    AVG_MERGE_DAYS=$(echo "$MERGED_DATA" | python3 -c "
import json, sys
from datetime import datetime
prs = json.load(sys.stdin)
total = 0
count = 0
for pr in prs:
    try:
        created = datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00'))
        merged = datetime.fromisoformat(pr['mergedAt'].replace('Z', '+00:00'))
        total += (merged - created).days
        count += 1
    except: pass
print(total // count if count > 0 else 14)
" 2>/dev/null || echo 14)
  fi
fi

if [ "$AVG_MERGE_DAYS" -le 3 ] 2>/dev/null; then
  resp_val=100
elif [ "$AVG_MERGE_DAYS" -le 7 ] 2>/dev/null; then
  resp_val=70
elif [ "$AVG_MERGE_DAYS" -le 14 ] 2>/dev/null; then
  resp_val=30
else
  resp_val=0
fi
resp_weighted=$(( resp_val * 15 / 100 ))

# --- Factor 4: trust_score (weight: 25) ---
trust_val=30  # default: new repo
TRUST_FILE="${WORKSPACE_DIR}/memory/trust-repos.md"
if [ -f "$TRUST_FILE" ]; then
  # Check if repo is in Tier 1 (proven — merged before)
  if grep -qi "Tier 1" "$TRUST_FILE" 2>/dev/null && grep -qi "$REPO" <(sed -n '/Tier 1/,/Tier 2/p' "$TRUST_FILE" 2>/dev/null); then
    trust_val=100
  # Check if repo is in Tier 2 (engaged — positive interaction)
  elif grep -qi "Tier 2" "$TRUST_FILE" 2>/dev/null && grep -qi "$REPO" <(sed -n '/Tier 2/,/Tier 3/p' "$TRUST_FILE" 2>/dev/null); then
    trust_val=70
  # Check if repo is in Deprioritized/blocklist
  elif grep -qi "Deprioritized\|Blocklist" "$TRUST_FILE" 2>/dev/null && grep -qi "$REPO" <(sed -n '/Deprioritized\|Blocklist/,$p' "$TRUST_FILE" 2>/dev/null); then
    trust_val=0
  fi
fi
trust_weighted=$(( trust_val * 25 / 100 ))

# --- Factor 5: freshness (weight: 10) ---
fresh_val=50  # default
if [ -n "$ISSUE" ]; then
  CREATED_AT=$(gh api "repos/${REPO}/issues/${ISSUE}" --jq '.created_at' 2>/dev/null || echo "")
  if [ -n "$CREATED_AT" ]; then
    DAYS_OLD=$(python3 -c "
from datetime import datetime, timezone
created = datetime.fromisoformat('${CREATED_AT}'.replace('Z', '+00:00'))
now = datetime.now(timezone.utc)
print((now - created).days)
" 2>/dev/null || echo 7)
    if [ "$DAYS_OLD" -le 1 ] 2>/dev/null; then
      fresh_val=100
    elif [ "$DAYS_OLD" -le 3 ] 2>/dev/null; then
      fresh_val=80
    elif [ "$DAYS_OLD" -le 7 ] 2>/dev/null; then
      fresh_val=50
    elif [ "$DAYS_OLD" -le 14 ] 2>/dev/null; then
      fresh_val=20
    else
      fresh_val=0
    fi
  fi
fi
fresh_weighted=$(( fresh_val * 10 / 100 ))

# --- Factor 6: contributor_fit (weight: 10) ---
fit_val=30  # default: no labels
if [ -n "$ISSUE" ]; then
  LABELS=$(gh api "repos/${REPO}/issues/${ISSUE}" --jq '[.labels[].name] | join(",")' 2>/dev/null || echo "")
  if echo "$LABELS" | grep -qi "help-wanted"; then
    fit_val=100
  elif echo "$LABELS" | grep -qi "good-first-issue"; then
    fit_val=80
  elif echo "$LABELS" | grep -qi "bug\|defect\|regression"; then
    fit_val=50
  fi
fi
fit_weighted=$(( fit_val * 10 / 100 ))

# --- Factor 7: competition_score (weight: 5) ---
comp_val=100  # default: no competition
if [ -n "$ISSUE" ]; then
  COMPETING=$(gh api "repos/${REPO}/issues/${ISSUE}/timeline" --paginate \
    --jq '[.[] | select(.event=="cross-referenced") | .source.issue | select(.pull_request != null and .state == "open")] | length' 2>/dev/null || echo 0)
  if [ "$COMPETING" -ge 2 ] 2>/dev/null; then
    comp_val=0
  elif [ "$COMPETING" -eq 1 ] 2>/dev/null; then
    comp_val=30
  fi
fi
comp_weighted=$(( comp_val * 5 / 100 ))

# --- Compute total P(merge) ---
TOTAL=$(( task_type_weighted + size_weighted + resp_weighted + trust_weighted + fresh_weighted + fit_weighted + comp_weighted ))

# Recommendation
if [ "$TOTAL" -ge 60 ]; then
  RECOMMENDATION="proceed_priority"
elif [ "$TOTAL" -ge 30 ]; then
  RECOMMENDATION="proceed"
else
  RECOMMENDATION="skip"
fi

# Output JSON
cat <<EOF
{
  "score": ${TOTAL},
  "recommendation": "${RECOMMENDATION}",
  "threshold": 30,
  "breakdown": {
    "task_type": {"raw": ${task_type}, "weighted": ${task_type_weighted}, "weight": 15, "input": "${TYPE}"},
    "size": {"raw": ${size_val}, "weighted": ${size_weighted}, "weight": 20, "input": "${SIZE}"},
    "repo_responsiveness": {"raw": ${resp_val}, "weighted": ${resp_weighted}, "weight": 15, "avg_merge_days": ${AVG_MERGE_DAYS}},
    "trust": {"raw": ${trust_val}, "weighted": ${trust_weighted}, "weight": 25},
    "freshness": {"raw": ${fresh_val}, "weighted": ${fresh_weighted}, "weight": 10},
    "contributor_fit": {"raw": ${fit_val}, "weighted": ${fit_weighted}, "weight": 10},
    "competition": {"raw": ${comp_val}, "weighted": ${comp_weighted}, "weight": 5}
  }
}
EOF
