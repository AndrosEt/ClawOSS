# V10 Dashboard Plan

**Author**: web_dashboard agent
**Date**: 2026-03-17
**Status**: PLANNED — waiting for builder to implement scoring model

---

## Current Dashboard State (V9 complete)

- **Production**: https://clawoss-dashboard.vercel.app
- **Stats**: 108 PRs, 4 merged (3.7%), 45 open, 60 closed
- **Health-check**: Blocklist active (llama_index, Playnite, micro, qdrant, apache/*)
- **All V9 fixes live**: rework policy, no rate limits, no CLA blocking, approved PRs detection

---

## V10 Dashboard Changes

### Phase 1: Merge Probability Scoring Display

**Schema change**: Add `mergeProbability` (real, nullable) to `pullRequests` table.
The agent reports P(merge) at spawn time via heartbeat ingest.

**New endpoint**: `GET /api/metrics/merge-probability`
```json
{
  "distribution": {
    "0-20": 5,
    "20-40": 12,
    "40-60": 28,
    "60-80": 15,
    "80-100": 3
  },
  "avgScore": 52.3,
  "accuracy": {
    "merged": { "avgPMerge": 68.2, "count": 4 },
    "closed": { "avgPMerge": 38.1, "count": 60 },
    "open": { "avgPMerge": 49.7, "count": 45 }
  },
  "weightValidation": {
    "task_type": { "currentWeight": 25, "empiricalCorrelation": 0.12 },
    "trust_score": { "currentWeight": 15, "empiricalCorrelation": 0.67 },
    "size_score": { "currentWeight": 20, "empiricalCorrelation": 0.45 }
  }
}
```

**New panel**: `merge-probability-panel.tsx`
- Distribution histogram of P(merge) scores
- Accuracy chart: predicted vs actual outcomes
- Weight calibration recommendations

**Updated panels**:
- `recent-prs-list.tsx` — P(merge) badge next to each PR
- `health-check` — `avgMergeProbability` in stats

### Phase 2: Throughput & Lobster Monitoring

- PRs/hour rate in overview (rolling 4-hour window)
- Slot utilization gauge (X/10 active)
- Lobster cycle latency tracking
- Cost efficiency trend (cost per merged PR over time)

### Phase 3: Direction Analysis

- Repo direction summaries (from scout's memory files)
- Low priority — requires heartbeat ingest pipeline change

---

## Pushback on V10 Scoring Weights

Based on our 4 merged PRs:

| PR | Type | Size | Repo Responsiveness | Time to Merge |
|----|------|------|---------------------|---------------|
| llama_index#21025 | bug fix | 63 lines | <6 hours | Same day |
| voice-satellite#23 | bug fix | 66 lines | <12 hours | Same day |
| pi-mono#2166 | docs fix | 11 lines | <22 hours | Next day |
| cmux#1444 | bug fix | 16 lines | <5 hours | Same day |

**Recommendation**: `trust_score` (repo responsiveness) should be 25%, `task_type` should be 15%. All 4 merges came from responsive maintainers, not from being docs fixes. 3/4 are bug fixes. The current spec over-weights easy PRs and under-weights maintainer engagement.

---

## Blocklist Status

Added to health-check as hard override. Maintained in code (not DB) for now.

| Repo | Reason | Merge Count | Status |
|------|--------|-------------|--------|
| run-llama/llama_index | Ban threat from logan-markewich (same person who merged #21025) | 1 merge | BLOCKED |
| JosefNemec/Playnite | "vibe coded slop" | 0 | BLOCKED |
| micro-editor/micro | "AI slop" | 0 | BLOCKED |
| qdrant/qdrant | AI disclosure policy | 0 | BLOCKED |
| apache/* | Non-automatable ICLA, probing for bots | 0 | BLOCKED (org) |
