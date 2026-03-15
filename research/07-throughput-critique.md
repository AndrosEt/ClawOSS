# Throughput Critique: Can ClawOSS Achieve 2-5 High-Quality Commits Per Hour?

**Verdict: NO -- not as stated. The target needs reframing.**

2-5 high-quality commits per hour from a single autonomous agent is unrealistic for meaningful OSS contributions. However, the underlying goal -- sustained, cost-effective autonomous OSS development -- IS achievable with the right metrics and architecture.

---

## 1. Minimax M2.5 Capability Assessment

### Benchmarks

| Benchmark | M2.5 | Claude Sonnet 4.6 | Claude Opus 4.6 | GPT-5.2 |
|-----------|-------|--------------------|------------------|---------|
| SWE-bench Verified | 80.2% | 79.6% | 80.8% | 80.0% |
| Multi-SWE-bench | 51.3% (best) | -- | -- | -- |

M2.5 is genuinely frontier-tier for coding. It matches or exceeds Claude Sonnet 4.6 on SWE-bench Verified while being **11x cheaper on input tokens and 16x cheaper on output tokens**. The coding capability is not the bottleneck.

### Architecture Advantage

M2.5 is a Mixture-of-Experts model: 230B total parameters, only 10B active during inference. This is why pricing works -- frontier capability without frontier compute costs.

### Inference Speed

- Standard M2.5: ~45-50 tokens/second
- M2.5-Lightning: ~100 tokens/second
- Time to first token: 2.41s (MiniMax API), as low as 0.49s via Together.ai
- This is adequate but not exceptional. A 2000-token response takes 20-40 seconds.

### Key Limitation

**SWE-bench measures isolated task completion, NOT agentic operation.** The 80.2% score assumes:
- A curated, well-described issue
- The exact repository state provided
- No need to discover or navigate to the right files
- No build system complexity
- No flaky tests

Real-world agentic success rate is likely **50-65%** on well-scoped issues, dropping to **15-30%** on complex or ambiguous ones.

---

## 2. The Pipeline Time Budget

For 5 commits/hour, each commit gets **12 minutes**. For 2 commits/hour, **30 minutes**.

Here is what ONE commit actually requires:

| Step | Optimistic Time | Realistic Time |
|------|----------------|----------------|
| Discover/select issue | 1-2 min | 3-5 min |
| Clone/checkout repo | 0.5-1 min | 1-3 min (cold) |
| Read and understand code | 2-3 min | 5-10 min |
| Implement fix | 2-5 min | 5-15 min |
| Run tests | 1-5 min | 2-15 min |
| Self-review | 1-2 min | 2-5 min |
| Commit + push + create PR | 1-2 min | 2-3 min |
| **Total** | **8-20 min** | **20-56 min** |

### Critical Observations

1. **OpenClaw's default agent run timeout is 600 seconds (10 minutes).** A single agent run may not be enough for a complete fix. Multi-turn operation adds coordination overhead.

2. **Test execution time is wildly variable.** A Python package's test suite might take 30 seconds. A Rust project might take 10 minutes. A monorepo might take 30+ minutes. The agent cannot control this.

3. **CI feedback loops are the real bottleneck.** If the agent waits for CI (5-15 minutes typical), 5 commits/hour is mathematically impossible. If it doesn't wait, it's shipping untested code.

4. **Network and API latency compounds.** Each agent turn involves: API call to OpenRouter (~2-5s TTFT + generation time), tool calls for file operations, git operations. At 3-5 turns per task, overhead alone is 2-5 minutes.

### Verdict on Time Budget

- **5 commits/hour (12 min each):** Only achievable for trivial changes (typo fixes, single-line bug fixes, dependency bumps). These are NOT "high-quality commits."
- **2 commits/hour (30 min each):** Achievable for small, well-scoped issues IF the repo is pre-cloned and issues are pre-curated.
- **1 commit/hour (60 min each):** Realistic for genuinely useful fixes on moderately complex issues.

---

## 3. Cost Analysis

### Per-Commit Token Budget (via OpenRouter)

| Scenario | Input Tokens | Output Tokens | Cost |
|----------|-------------|---------------|------|
| Trivial fix (1-2 turns) | 100K | 20K | $0.05 |
| Small fix (3-5 turns) | 300K | 75K | $0.17 |
| Medium fix (5-10 turns) | 600K | 150K | $0.33 |
| Complex fix (10+ turns) | 1M+ | 250K+ | $0.55+ |

### Daily/Monthly Projections

| Throughput Target | Daily Cost | Monthly Cost |
|-------------------|-----------|--------------|
| 2 commits/hour, 8 hrs | $2-5 | $60-150 |
| 5 commits/hour, 8 hrs | $5-12 | $150-360 |
| With failures/retries (2x) | $10-24 | $300-720 |

### The Good News

**Cost is NOT the constraint.** Even with a 50% failure rate and retries, M2.5 via OpenRouter keeps daily costs under $25. Compare this to Claude Sonnet 4.6 at the same throughput: $50-300/day. Or Claude Opus 4.6: $200-1000/day. The 10-16x cost advantage of M2.5 is the single strongest argument for this architecture.

### Heartbeat Token Tax

OpenClaw heartbeats consume tokens on every cycle (default 30 min). At ~10-50K tokens per heartbeat:
- 48 heartbeats/day x 30K tokens = 1.44M tokens/day
- Additional cost: ~$0.36 + $1.73 = ~$2.09/day in heartbeat overhead
- **Recommendation:** Set heartbeat interval to 55 minutes to keep prompt cache warm while minimizing overhead.

---

## 4. Quality Risks at High Throughput

### 4.1 The "Quantity Over Quality" Trap

If success is measured by commits/hour, the agent will naturally gravitate toward:
- README typo fixes and formatting changes
- Trivial dependency bumps
- Whitespace/linting fixes
- Copy-paste boilerplate additions

These inflate commit counts but contribute minimal value. Worse, they **annoy maintainers** who have to review them.

### 4.2 Context Pollution in Long Sessions

Running 5+ tasks through a single agent session creates context pollution:
- Residual context from task N bleeds into task N+1
- The model may reference files from the wrong repository
- Error patterns from one task may bias approaches to the next
- M2.5's 196K context window will fill quickly with multi-task history

**Recommendation:** Fresh session per task. Accept the cold-start overhead (cache warm-up, system prompt injection) rather than risk cross-task contamination.

### 4.3 Self-Review Blindspot

The same model that wrote the code cannot effectively review it. Known issues:
- Confirmation bias toward its own approach
- Inability to catch logic errors it wouldn't have made differently
- Tendency to approve its own work with superficial reasoning
- No second perspective on edge cases

**Recommendation:** Use a different model or prompting strategy for the review step, or accept that some PRs will have issues.

### 4.4 Repository Reputation Risk

This is the **highest-severity risk**. If ClawOSS submits 5 PRs/hour to various repos:
- Maintainers may block the bot account entirely
- The project gets flagged as a spam bot
- Other OSS projects may preemptively block AI-generated PRs
- One bad PR can undo the goodwill of dozens of good ones
- Some repos already have explicit policies against unsolicited AI PRs

**A single high-quality PR that fixes a real bug is worth more than 50 trivial commits.**

---

## 5. OpenRouter Rate Limits

OpenRouter does not publish explicit rate limits for paid M2.5, but:
- Free tier: 20 requests/minute, 200 requests/day (irrelevant for production)
- Paid tier: Generally permissive but subject to burst throttling
- No published SLA on latency guarantees
- Provider fallback: OpenRouter can route to multiple M2.5 providers (MiniMax, Together.ai, Fireworks, etc.)

**Risk:** During peak hours, OpenRouter latency could spike, degrading throughput. No SLA means no recourse.

**Mitigation:** Consider direct MiniMax API access for production workloads if rate limits become an issue.

---

## 6. Is "2-5 Commits Per Hour" Even the Right Metric?

**No. It optimizes for the wrong thing.**

### Why Commits/Hour Fails

1. **Volume != Value.** OSS maintainers don't care how fast you commit. They care if your PR solves a real problem.
2. **It incentivizes trivial work.** The easiest way to hit 5 commits/hour is to find 5 typos.
3. **It ignores the feedback loop.** A commit that gets rejected costs MORE than not committing at all (maintainer time wasted, reputation damaged).
4. **It measures output, not outcome.** The outcome is: merged PRs, satisfied maintainers, solved issues.

### Better Metrics

| Metric | Target | Why |
|--------|--------|-----|
| Merged PRs per day | 3-5 | Measures actual impact |
| PR acceptance rate | >70% | Measures quality |
| Mean time to merge | <48 hours | Measures relevance |
| Unique repos contributed to per week | 5-10 | Measures breadth |
| Issues resolved per day | 2-4 | Measures real value |
| Cost per merged PR | <$2 | Measures efficiency |

### Recommended Targets

- **Week 1-2 (Calibration):** 1-2 merged PRs/day, acceptance rate tracking
- **Week 3-4 (Ramp):** 3-5 merged PRs/day on curated repos
- **Month 2+ (Steady State):** 5-10 merged PRs/day across diverse repos, >70% acceptance rate
- **Aspirational:** 20+ merged PRs/day with multi-agent parallelism

---

## 7. Comparison to Industry Benchmarks

| System | Throughput | Context |
|--------|-----------|---------|
| Cursor multi-agent (research) | 1000 commits/hour | 10M tool calls, 10 agents, controlled environment |
| Claude Code (real-world) | 4% of GitHub public commits | Many human-in-loop users, not autonomous |
| Rakuten autonomous run | 12.5M lines modified in 7 hours | Single large codebase, not multi-repo |
| Realistic single-agent OSS | 1-3 commits/hour | Mixed success rate, pre-curated issues |
| ClawOSS target | 2-5 commits/hour | Ambitious for autonomous, single-agent |

The Anthropic 2026 Agentic Coding Trends Report notes: developers integrate AI into 60% of their work but fully delegate only 0-20% of tasks. This suggests the industry expectation for FULLY autonomous operation is still low.

---

## 8. Final Recommendations

### Must-Haves

1. **Redefine success metric** from "commits/hour" to "merged PRs/day with >70% acceptance rate"
2. **Quality gate before every PR submission:** lint, test, self-review with a different prompt/temperature
3. **Per-task sessions** to avoid context pollution
4. **Issue curation layer** that pre-filters for solvability, repo friendliness, and difficulty
5. **Cool-down per repo** -- no more than 2-3 PRs to the same repo per day to avoid appearing spammy

### Should-Haves

6. **Progressive difficulty ramp** -- start with trivial issues to build account reputation
7. **Maintainer relationship tracking** -- note which repos are receptive vs hostile to AI PRs
8. **Cost monitoring** -- track cost-per-merged-PR, not cost-per-commit
9. **Failure analysis** -- categorize why PRs get rejected to improve over time

### Nice-to-Haves

10. **Multi-agent parallelism** for independent repos (future scaling path)
11. **Secondary model review** -- use a different model to review before submission
12. **Automated repo compatibility scoring** -- predict likelihood of PR acceptance before starting work

---

## 9. Bottom Line

**M2.5 is the right model choice.** Its coding capability matches Claude Sonnet at 1/11th the cost. The value proposition is real.

**The throughput target is wrong.** 2-5 commits/hour optimizes for volume over value. The agent will either:
- (a) Hit the target by submitting trivial/low-quality work that damages reputation, or
- (b) Miss the target because real fixes take 20-60 minutes

**The correct target is 3-5 merged PRs per day at >70% acceptance rate and <$2/merged PR.** This is ambitious but achievable with M2.5, and it measures what actually matters: real impact on real projects.

**The cost math works beautifully.** At $5-15/day for sustained autonomous OSS contribution, ClawOSS could be one of the most cost-effective development tools ever built. Don't ruin that by chasing the wrong metric.
