#!/usr/bin/env bash
# repo-health-check.sh — Deterministic repo health scoring
# Usage: ./repo-health-check.sh owner/repo [threshold]
# Exit 0 = healthy (score >= threshold), exit 1 = skip
# Outputs JSON with health metrics + composite score + failure_reason category
#
# Designed to be called from HEARTBEAT step 3g, oss-discover, oss-triage,
# and subagent-scout. API calls are minimized (single repos/ call for metadata).

set -euo pipefail

if [ $# -lt 1 ]; then
  echo '{"error": "Usage: repo-health-check.sh owner/repo [threshold]"}' >&2
  exit 1
fi

REPO="$1"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
THRESHOLD="${2:-5}"  # minimum composite score, default 5

# Date calculations (macOS + Linux compatible)
if date -v-1d +%Y-%m-%d &>/dev/null; then
  TWO_WEEKS_AGO=$(date -v-14d +%Y-%m-%dT00:00:00Z)
  THIRTY_DAYS_AGO=$(date -v-30d +%Y-%m-%dT00:00:00Z)
else
  TWO_WEEKS_AGO=$(date -d "14 days ago" +%Y-%m-%dT00:00:00Z)
  THIRTY_DAYS_AGO=$(date -d "30 days ago" +%Y-%m-%dT00:00:00Z)
fi

score=0
reasons=()
warnings=()

# Helper: emit JSON and exit with failure
fail() {
  local reason="$1"
  local category="$2"
  local reasons_json="[]"
  if [ ${#reasons[@]} -gt 0 ]; then
    reasons_json=$(printf '%s\n' "${reasons[@]}" | jq -R . | jq -s .)
  fi
  local warnings_json="[]"
  if [ ${#warnings[@]} -gt 0 ]; then
    warnings_json=$(printf '%s\n' "${warnings[@]}" | jq -R . | jq -s .)
  fi
  cat <<ENDJSON
{
  "pass": false,
  "score": ${score},
  "threshold": ${THRESHOLD},
  "repo": "${REPO}",
  "reason": $(echo "$reason" | jq -R .),
  "failure_reason": $(echo "$category" | jq -R .),
  "reasons": ${reasons_json},
  "warnings": ${warnings_json}
}
ENDJSON
  exit 1
}

# ─── Single repo metadata call (stars, pushed_at, description, topics, archived) ───
REPO_DATA=$(gh api "repos/${REPO}" --jq '{
  stars: .stargazers_count,
  pushed_at: .pushed_at,
  description: (.description // ""),
  topics: (.topics // []),
  archived: .archived
}' 2>/dev/null || echo '{}')

if [ "$REPO_DATA" = '{}' ]; then
  fail "cannot fetch repo metadata" "tool_error: gh api repos/${REPO} failed"
fi

STARS=$(echo "$REPO_DATA" | jq -r '.stars // 0')
PUSHED_AT=$(echo "$REPO_DATA" | jq -r '.pushed_at // ""')
DESCRIPTION=$(echo "$REPO_DATA" | jq -r '.description // ""' | tr '[:upper:]' '[:lower:]')
TOPICS=$(echo "$REPO_DATA" | jq -r '.topics // [] | join(" ")' | tr '[:upper:]' '[:lower:]')
ARCHIVED=$(echo "$REPO_DATA" | jq -r '.archived // false')

# ─── 0. Archived check ───
if [ "$ARCHIVED" = "true" ]; then
  fail "repo is archived" "repo_health_fail: archived"
fi

# ─── 1. Stars ───
if [ "$STARS" -lt 200 ]; then
  reasons+=("stars=${STARS} (<200)")
  fail "stars=${STARS} (<200)" "repo_health_fail: stars ${STARS} below 200 minimum"
fi
if [ "$STARS" -ge 5000 ]; then
  score=$((score + 3))
elif [ "$STARS" -ge 1000 ]; then
  score=$((score + 2))
else
  score=$((score + 1))
fi

# ─── 2. Last push (activity check) ───
if [ -z "$PUSHED_AT" ]; then
  fail "cannot read pushed_at" "tool_error: pushed_at field missing"
fi

if [[ "$PUSHED_AT" < "$TWO_WEEKS_AGO" ]]; then
  reasons+=("last_push=${PUSHED_AT} (>2 weeks)")
  fail "last push ${PUSHED_AT} older than 2 weeks" "repo_health_fail: no activity in 2+ weeks"
fi
score=$((score + 1))

# ─── 3. Merged PRs in last 30 days ───
RECENT_MERGES=$(gh api "repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=50" \
  --jq "[.[] | select(.merged_at != null and .merged_at > \"$THIRTY_DAYS_AGO\")] | length" 2>/dev/null || echo "0")

if [ "$RECENT_MERGES" -eq 0 ]; then
  reasons+=("0 merged PRs in 30 days")
  fail "0 merged PRs in last 30 days" "repo_health_fail: zero merge velocity"
fi
if [ "$RECENT_MERGES" -ge 10 ]; then
  score=$((score + 3))
elif [ "$RECENT_MERGES" -ge 3 ]; then
  score=$((score + 2))
else
  score=$((score + 1))
fi

# ─── 3b. Average days to merge (from last 10 merged PRs) ───
AVG_MERGE_DAYS=0
MERGE_DATA=$(gh api "repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=10" \
  --jq '[.[] | select(.merged_at != null) | {created: .created_at, merged: .merged_at}]' 2>/dev/null || echo "[]")

if [ "$MERGE_DATA" != "[]" ]; then
  AVG_MERGE_DAYS=$(echo "$MERGE_DATA" | jq '
    [.[] |
      (((.merged | split("T")[0] | split("-") | .[0] + .[1] + .[2]) | tonumber) -
       ((.created | split("T")[0] | split("-") | .[0] + .[1] + .[2]) | tonumber))
    ] | if length > 0 then (add / length) else 0 end | floor
  ' 2>/dev/null || echo "0")
  # Fallback: use simpler epoch-based calculation if jq date math fails
  if [ "$AVG_MERGE_DAYS" = "0" ] || [ -z "$AVG_MERGE_DAYS" ]; then
    AVG_MERGE_DAYS=$(echo "$MERGE_DATA" | jq -r '
      [.[] | {c: .created, m: .merged}] |
      if length > 0 then
        [.[] | ((.m[:10] | split("-") | (.[0]|tonumber)*365 + (.[1]|tonumber)*30 + (.[2]|tonumber)) -
               ((.c[:10] | split("-") | (.[0]|tonumber)*365 + (.[1]|tonumber)*30 + (.[2]|tonumber))))] |
        add / length | floor
      else 0 end
    ' 2>/dev/null || echo "0")
  fi
fi

# Hard skip if avg merge time > 14 days
if [ "$AVG_MERGE_DAYS" -gt 14 ] 2>/dev/null; then
  reasons+=("avg_merge_days=${AVG_MERGE_DAYS} (>14)")
  fail "avg merge time ${AVG_MERGE_DAYS} days (>14d)" "repo_health_fail: avg merge time ${AVG_MERGE_DAYS}d exceeds 14d limit"
fi
# Score bonus for fast merge
if [ "$AVG_MERGE_DAYS" -le 3 ] 2>/dev/null; then
  score=$((score + 3))
elif [ "$AVG_MERGE_DAYS" -le 7 ] 2>/dev/null; then
  score=$((score + 2))
elif [ "$AVG_MERGE_DAYS" -le 14 ] 2>/dev/null; then
  score=$((score + 1))
fi

# ─── 4. Open PR backlog ───
OPEN_PRS=$(gh api "repos/${REPO}/pulls?state=open&per_page=100" --jq 'length' 2>/dev/null || echo "0")
if [ "$OPEN_PRS" -ge 50 ]; then
  reasons+=("open_prs=${OPEN_PRS} (>=50)")
  fail "${OPEN_PRS} open PRs (>=50, overwhelmed)" "repo_health_fail: ${OPEN_PRS} open PRs, maintainers overwhelmed"
fi
if [ "$OPEN_PRS" -lt 10 ]; then
  score=$((score + 2))
elif [ "$OPEN_PRS" -lt 30 ]; then
  score=$((score + 1))
fi

# ─── 5. PR review rate (% of last 20 PRs with review comments) ───
TOTAL_PRS=0
REVIEWED_PRS=0
REVIEW_DATA=$(gh api "repos/${REPO}/pulls?state=all&sort=updated&direction=desc&per_page=20" \
  --jq '[.[] | {comments: .comments, review_comments: .review_comments}]' 2>/dev/null || echo "[]")

if [ "$REVIEW_DATA" != "[]" ]; then
  TOTAL_PRS=$(echo "$REVIEW_DATA" | jq 'length')
  REVIEWED_PRS=$(echo "$REVIEW_DATA" | jq '[.[] | select(.comments > 0 or .review_comments > 0)] | length')
fi

if [ "$TOTAL_PRS" -gt 0 ]; then
  REVIEW_RATE=$((REVIEWED_PRS * 100 / TOTAL_PRS))
else
  REVIEW_RATE=0
fi

if [ "$REVIEW_RATE" -lt 50 ]; then
  reasons+=("review_rate=${REVIEW_RATE}% (<50%)")
  fail "review rate ${REVIEW_RATE}% (<50%)" "repo_health_fail: review rate ${REVIEW_RATE}% below 50% minimum"
fi
if [ "$REVIEW_RATE" -ge 80 ]; then
  score=$((score + 3))
elif [ "$REVIEW_RATE" -ge 60 ]; then
  score=$((score + 2))
else
  score=$((score + 1))
fi

# ─── 6. External contributor merges (do they merge outside PRs?) ───
EXTERNAL_MERGES=$(gh api "repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=30" \
  --jq '[.[] | select(.merged_at != null)] | [.[] | select(.author_association != "OWNER" and .author_association != "MEMBER" and .author_association != "COLLABORATOR")] | length' 2>/dev/null || echo "0")

if [ "$EXTERNAL_MERGES" -gt 0 ]; then
  score=$((score + 2))
else
  warnings+=("0 external contributor merges in recent 30 closed PRs")
fi

# ─── 7. CONTRIBUTING.md check (welcoming signal) ───
CONTRIBUTING=$(gh api "repos/${REPO}/contents/CONTRIBUTING.md" --jq '.content' 2>/dev/null || echo "")
HAS_CONTRIBUTING=false
if [ -n "$CONTRIBUTING" ]; then
  HAS_CONTRIBUTING=true
  score=$((score + 1))  # has CONTRIBUTING.md = welcoming
fi

# ─── 8. Niche fit (agentic AI) ───
REPO_LOWER=$(echo "$REPO" | tr '[:upper:]' '[:lower:]')

NICHE_FIT=false
for kw in agent agentic llm "large language model" rag "retrieval augmented" embedding "vector store" prompt chain "tool-use" "function-calling" ai-assistant copilot chatbot inference transformer fine-tuning mlops langchain langgraph llama-index autogen crewai semantic-kernel haystack dspy instructor openai anthropic ollama vllm litellm chromadb weaviate qdrant milvus pinecone lancedb; do
  if echo "$DESCRIPTION $TOPICS $REPO_LOWER" | grep -qi "$kw"; then
    NICHE_FIT=true
    score=$((score + 3))
    break
  fi
done

# ─── 10. Bot-friendly signals ───
HAS_CI=$(gh api "repos/${REPO}/contents/.github/workflows" --jq 'length' 2>/dev/null || echo "0")
if [ "$HAS_CI" -gt 0 ]; then
  score=$((score + 1))
fi

GFI_COUNT=$(gh api "repos/${REPO}/labels" --jq '[.[] | select(.name == "good first issue" or .name == "good-first-issue" or .name == "help wanted" or .name == "help-wanted")] | length' 2>/dev/null || echo "0")
if [ "$GFI_COUNT" -gt 0 ]; then
  score=$((score + 2))
fi

# ─── Final verdict ───
PASS=true
if [ "$score" -lt "$THRESHOLD" ]; then
  PASS=false
fi

# Build reasons/warnings JSON arrays
REASONS_JSON="[]"
if [ ${#reasons[@]} -gt 0 ]; then
  REASONS_JSON=$(printf '%s\n' "${reasons[@]}" | jq -R . | jq -s .)
fi
WARNINGS_JSON="[]"
if [ ${#warnings[@]} -gt 0 ]; then
  WARNINGS_JSON=$(printf '%s\n' "${warnings[@]}" | jq -R . | jq -s .)
fi

# Output JSON
cat <<ENDJSON
{
  "pass": ${PASS},
  "score": ${score},
  "threshold": ${THRESHOLD},
  "repo": "${REPO}",
  "reasons": ${REASONS_JSON},
  "warnings": ${WARNINGS_JSON},
  "metrics": {
    "stars": ${STARS},
    "pushed_at": "${PUSHED_AT}",
    "recent_merges_30d": ${RECENT_MERGES},
    "avg_merge_days": ${AVG_MERGE_DAYS:-0},
    "open_prs": ${OPEN_PRS},
    "review_rate_pct": ${REVIEW_RATE},
    "external_merges": ${EXTERNAL_MERGES},
    "niche_fit": ${NICHE_FIT},
    "archived": ${ARCHIVED},
    "has_ci": $([ "$HAS_CI" -gt 0 ] && echo true || echo false),
    "has_contributing": ${HAS_CONTRIBUTING},
    "has_gfi_labels": $([ "$GFI_COUNT" -gt 0 ] && echo true || echo false)
  }
}
ENDJSON

if [ "$PASS" = true ]; then
  exit 0
else
  exit 1
fi
