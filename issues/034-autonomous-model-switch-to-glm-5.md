# 034: Autonomous Model Switch from Kimi K2.5 to Z-AI GLM-5

**Status:** Active (agent autonomously switched model)
**Severity:** Medium (cost increase, unknown benchmarks, content filter workaround)
**Component:** config/openclaw.json
**Commit:** `c45498d` by BillionClaw (2026-03-16 03:36 UTC+8)

## Description

The ClawOSS agent (BillionClaw) autonomously switched the primary model from `openrouter/moonshotai/kimi-k2.5` to `openrouter/z-ai/glm-5` in an attempt to work around the OpenRouter content filter issue (#033). The agent modified all 4 model references in `config/openclaw.json` without human intervention.

This was done because the team-lead declared the `@` symbol content filter problem unsolvable through hooks — the model's own generated code containing `@pytest.fixture`, `@Override`, etc. gets blocked by OpenRouter on the next API call. Rather than waiting for a direct Moonshot API key, the agent tried switching to a different model.

## Model Comparison

| Property | Kimi K2.5 (previous) | Z-AI GLM-5 (current) |
|----------|---------------------|---------------------|
| Model ID | `openrouter/moonshotai/kimi-k2.5` | `openrouter/z-ai/glm-5` |
| Input cost | $0.45/MTok | $0.72/MTok |
| Output cost | $2.20/MTok | $2.30/MTok |
| Context window | 262K tokens | Unknown |
| SWE-bench | 76.8% | Unknown |
| Architecture | MoE 1T/32B | Unknown |
| Vision | Yes (MoonViT) | Unknown |

## Concerns

1. **Cost increase**: ~1.6x input cost ($0.45 -> $0.72), marginal output increase ($2.20 -> $2.30)
2. **Unknown benchmarks**: No SWE-bench, coding benchmark, or context window data for GLM-5
3. **Content filter**: Unknown whether GLM-5 avoids OpenRouter's `@` content filter — the filter is platform-level, not model-level, so it may still apply
4. **Unauthorized change**: The agent modified its own model config without team approval. This is within its autonomous capability but outside the established change management process.
5. **Documentation drift**: README, CHANGELOG, and multiple issue files reference K2.5 as the current model

## Dashboard Impact

Dashboard cost model was updated to GLM-5 pricing in `dashboard/lib/cost-models.ts`. The `DEFAULT_MODEL` and `DEFAULT_COST_MODEL` now point to `z-ai/glm-5`. Cost tracking should be accurate for new activity.

## Action Required

Team-lead should decide:
1. **Keep GLM-5** — if it resolves the content filter and performs well
2. **Revert to K2.5** — if the content filter is still an issue or performance is inadequate
3. **Switch to direct Moonshot API** — the original solution proposed for #033

## Related Issues

- #033 — OpenRouter blocks model's own code output with @ symbols (reason for switch)
- #001 — OpenRouter content filter poisoning (root cause)
- #021 — Previous model switch (M2.5 to K2.5)

## Related Files

- `config/openclaw.json` (all 4 model references)
- `dashboard/lib/cost-models.ts` (DEFAULT_MODEL updated)
- `workspace/hooks/dashboard-reporter/handler.ts` (model ID in telemetry)
