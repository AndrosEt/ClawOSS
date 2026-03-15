# 010: Throughput Realistic Expectations — 5-12 Merged PRs/Day, Not 2-5/Hour

**Status:** Acknowledged (wontfix — informational)
**Severity:** Informational
**Component:** Architecture / Planning

## Description

The initial throughput target of "2-5 high-quality commits per hour" was identified as unrealistic and counterproductive by the throughput critique (`research/07-throughput-critique.md`). This metric incentivizes trivial work, damages repository reputation, and measures output instead of outcome.

## Root Cause

The original metric optimized for volume (commits/hour) rather than value (merged PRs/day). At 5 commits/hour, the agent would gravitate toward README typo fixes and whitespace changes — exactly the kind of AI slop that gets bots banned from repositories.

## Analysis

### Why Commits/Hour Fails
- Volume != Value: maintainers care about solving real problems, not commit frequency
- Incentivizes trivial work: easiest way to hit 5/hour is finding 5 typos
- Ignores feedback loop: rejected PRs cost MORE than not committing (maintainer time wasted)
- Measures output, not outcome

### Realistic Expectations

| Phase | Timeline | Target |
|-------|----------|--------|
| Calibration | Week 1-2 | 1-2 merged PRs/day |
| Ramp | Week 3-4 | 3-5 merged PRs/day |
| Steady state | Month 2+ | 5-10 merged PRs/day |
| Aspirational | Month 3+ | 10-15 merged PRs/day |

### Correct Metrics

| Metric | Target | Why |
|--------|--------|-----|
| Merged PRs per day | 3-5 (week 3+) | Measures actual impact |
| PR acceptance rate | >70% | Measures quality |
| Mean time to merge | <48 hours | Measures relevance |
| Cost per merged PR | <$2 | Measures efficiency |

### Monthly Projections
- **5-15 merged PRs per month** in early steady state
- **$200-500/month** in API costs
- **20-30% overall merge rate** (higher for docs, lower for code)

## Fix Applied

The v5 throughput architecture reframed success metrics from "commits/hour" to "merged PRs/day with >70% acceptance rate and <$2/merged PR." The README and HEARTBEAT.md reflect these corrected expectations.

## Related Files

- `research/07-throughput-critique.md` (detailed analysis)
- `research/06-throughput-architecture.md` (reframed architecture)
- `research/04-devils-advocate.md` (quality risks)
- `README.md` (realistic expectations section)
