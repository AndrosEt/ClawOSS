#!/usr/bin/env bash
# repo-health-check.sh — Deterministic repo health scoring
# Usage: ./repo-health-check.sh owner/repo
# Exit 0 = healthy (score >= threshold), exit 1 = skip
# Outputs JSON with health metrics + composite score

set -euo pipefail

if [ $# -lt 1 ]; then
  echo '{"error": "Usage: repo-health-check.sh owner/repo"}' >&2
  exit 1
fi

REPO="$1"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
THRESHOLD="${2:-5}"  # minimum composite score, default 5

# Date calculations (macOS + Linux compatible)
if date -v-1d +%Y-%m-%d &>/dev/null; then
  # macOS
  TWO_WEEKS_AGO=$(date -v-14d +%Y-%m-%dT00:00:00Z)
  SIX_MONTHS_AGO=$(date -v-180d +%Y-%m-%dT00:00:00Z)
  THIRTY_DAYS_AGO=$(date -v-30d +%Y-%m-%dT00:00:00Z)
else
  # Linux
  TWO_WEEKS_AGO=$(date -d "14 days ago" +%Y-%m-%dT00:00:00Z)
  SIX_MONTHS_AGO=$(date -d "180 days ago" +%Y-%m-%dT00:00:00Z)
  THIRTY_DAYS_AGO=$(date -d "30 days ago" +%Y-%m-%dT00:00:00Z)
fi

score=0
reasons=()
warnings=()

# ─── 1. Stars ───
STARS=$(gh api "repos/${REPO}" --jq '.stargazers_count' 2>/dev/null || echo "0")
if [ "$STARS" -lt 500 ]; then
  reasons+=("stars=${STARS} (<500)")
  echo "{\"pass\": false, \"score\": 0, \"reason\": \"stars=${STARS} (<500)\", \"repo\": \"${REPO}\"}"
  exit 1
fi
if [ "$STARS" -ge 5000 ]; then
  score=$((score + 3))
elif [ "$STARS" -ge 1000 ]; then
  score=$((score + 2))
else
  score=$((score + 1))
fi

# ─── 2. Last push (activity check) ───
PUSHED_AT=$(gh api "repos/${REPO}" --jq '.pushed_at' 2>/dev/null || echo "")
if [ -z "$PUSHED_AT" ]; then
  echo "{\"pass\": false, \"score\": 0, \"reason\": \"cannot read pushed_at\", \"repo\": \"${REPO}\"}"
  exit 1
fi

# Compare pushed_at to TWO_WEEKS_AGO
if [[ "$PUSHED_AT" < "$TWO_WEEKS_AGO" ]]; then
  reasons+=("last_push=${PUSHED_AT} (>2 weeks)")
  echo "{\"pass\": false, \"score\": 0, \"reason\": \"last push ${PUSHED_AT} older than 2 weeks\", \"repo\": \"${REPO}\"}"
  exit 1
fi
score=$((score + 1))

# ─── 3. Merged PRs in last 30 days ───
RECENT_MERGES=$(gh api "repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=50" \
  --jq "[.[] | select(.merged_at != null and .merged_at > \"$THIRTY_DAYS_AGO\")] | length" 2>/dev/null || echo "0")

if [ "$RECENT_MERGES" -eq 0 ]; then
  reasons+=("0 merged PRs in 30 days")
  echo "{\"pass\": false, \"score\": 0, \"reason\": \"0 merged PRs in last 30 days\", \"repo\": \"${REPO}\"}"
  exit 1
fi
if [ "$RECENT_MERGES" -ge 10 ]; then
  score=$((score + 3))
elif [ "$RECENT_MERGES" -ge 3 ]; then
  score=$((score + 2))
else
  score=$((score + 1))
fi

# ─── 4. Open PR backlog ───
OPEN_PRS=$(gh api "repos/${REPO}/pulls?state=open&per_page=100" --jq 'length' 2>/dev/null || echo "0")
if [ "$OPEN_PRS" -ge 50 ]; then
  reasons+=("open_prs=${OPEN_PRS} (>=50)")
  echo "{\"pass\": false, \"score\": 0, \"reason\": \"${OPEN_PRS} open PRs (>=50, overwhelmed)\", \"repo\": \"${REPO}\"}"
  exit 1
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
  echo "{\"pass\": false, \"score\": 0, \"reason\": \"review rate ${REVIEW_RATE}% (<50%)\", \"repo\": \"${REPO}\"}"
  exit 1
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

# ─── 7. Anti-AI policy check (CONTRIBUTING.md) ───
CONTRIBUTING=$(gh api "repos/${REPO}/contents/CONTRIBUTING.md" --jq '.content' 2>/dev/null || echo "")
if [ -n "$CONTRIBUTING" ]; then
  # Decode base64 and check for anti-AI patterns
  DECODED=$(echo "$CONTRIBUTING" | base64 -d 2>/dev/null || echo "")
  if echo "$DECODED" | grep -iqE '(no ai|no llm|no bot|no automated|ban ai|ban bot|ai.generated.*not.*accept|ai.assisted.*not.*accept|chatgpt|copilot.*ban|llm.*ban|ai.*pr.*reject|machine.generated.*reject)'; then
    echo "{\"pass\": false, \"score\": 0, \"reason\": \"anti-AI policy detected in CONTRIBUTING.md\", \"repo\": \"${REPO}\"}"
    exit 1
  fi
  score=$((score + 1))  # has CONTRIBUTING.md = welcoming
fi

# ─── 8. Niche fit (agentic AI) ───
REPO_META=$(gh api "repos/${REPO}" --jq '{description: .description, topics: .topics}' 2>/dev/null || echo '{}')
DESCRIPTION=$(echo "$REPO_META" | jq -r '.description // ""' | tr '[:upper:]' '[:lower:]')
TOPICS=$(echo "$REPO_META" | jq -r '.topics // [] | join(" ")' | tr '[:upper:]' '[:lower:]')
REPO_LOWER=$(echo "$REPO" | tr '[:upper:]' '[:lower:]')

NICHE_FIT=false
for kw in agent agentic llm "large language model" rag "retrieval augmented" embedding "vector store" prompt chain "tool-use" "function-calling" ai-assistant copilot chatbot inference transformer fine-tuning mlops langchain langgraph llama-index autogen crewai semantic-kernel haystack dspy instructor openai anthropic ollama vllm litellm chromadb weaviate qdrant milvus pinecone lancedb; do
  if echo "$DESCRIPTION $TOPICS $REPO_LOWER" | grep -qi "$kw"; then
    NICHE_FIT=true
    score=$((score + 3))
    break
  fi
done

# ─── 9. Bot-friendly signals ───
# Check for issue templates, CI workflows
HAS_CI=$(gh api "repos/${REPO}/contents/.github/workflows" --jq 'length' 2>/dev/null || echo "0")
if [ "$HAS_CI" -gt 0 ]; then
  score=$((score + 1))
fi

# Check for good-first-issue / help-wanted labels
GFI_COUNT=$(gh api "repos/${REPO}/labels" --jq '[.[] | select(.name == "good first issue" or .name == "good-first-issue" or .name == "help wanted" or .name == "help-wanted")] | length' 2>/dev/null || echo "0")
if [ "$GFI_COUNT" -gt 0 ]; then
  score=$((score + 2))
fi

# ─── Final verdict ───
PASS=true
if [ "$score" -lt "$THRESHOLD" ]; then
  PASS=false
fi

# Output JSON
cat <<ENDJSON
{
  "pass": ${PASS},
  "score": ${score},
  "threshold": ${THRESHOLD},
  "repo": "${REPO}",
  "metrics": {
    "stars": ${STARS},
    "pushed_at": "${PUSHED_AT}",
    "recent_merges_30d": ${RECENT_MERGES},
    "open_prs": ${OPEN_PRS},
    "review_rate_pct": ${REVIEW_RATE},
    "external_merges": ${EXTERNAL_MERGES},
    "niche_fit": ${NICHE_FIT},
    "has_ci": $([ "$HAS_CI" -gt 0 ] && echo true || echo false),
    "has_contributing": $([ -n "$CONTRIBUTING" ] && echo true || echo false),
    "has_gfi_labels": $([ "$GFI_COUNT" -gt 0 ] && echo true || echo false)
  }
}
ENDJSON

if [ "$PASS" = true ]; then
  exit 0
else
  exit 1
fi
