# 017: Dashboard Cost Model Uses Wrong Model ID

**Status:** Fixed (cost-models.ts and handler.ts updated to Kimi K2.5)
**Severity:** High (was Medium — upgraded when model switched, then fixed)
**Component:** dashboard/lib/cost-models.ts, workspace/hooks/dashboard-reporter/handler.ts

## Description

The dashboard's cost model registry and the dashboard-reporter hook both reference `minimax/MiniMax-M1-80k` as the model identifier. However, the primary model has been switched from Minimax M2.5 to **Moonshot Kimi K2.5** (`openrouter/moonshotai/kimi-k2.5`).

This means:
1. Cost calculations use Minimax M2.5 pricing ($0.25-0.27/MTok input) instead of Kimi K2.5 pricing ($0.45/MTok input, $2.20/MTok output)
2. The dashboard-reporter hook sends the wrong model ID with every telemetry payload
3. Dashboard model display shows "MiniMax M2.5" instead of "Kimi K2.5"

## Root Cause

The model was switched in `config/openclaw.json` but the dashboard code and hooks were not updated to match. Originally the ID mismatch was just a variant naming issue (`MiniMax-M1-80k` vs `minimax-m2.5`); now it's an entirely different model and provider.

## Impact

- **Cost tracking is wrong** — underestimates actual cost by ~67% on input, ~100% on output
- **Model attribution is wrong** — dashboard shows Minimax when using Moonshot
- **Metrics are misleading** — cost/PR calculations based on incorrect token prices

## Recommended Fix

Update `dashboard/lib/cost-models.ts`:

```typescript
"moonshotai/kimi-k2.5": {
  name: "Kimi K2.5",
  provider: "openrouter",
  inputCostPerToken: 0.45 / 1_000_000,
  outputCostPerToken: 2.20 / 1_000_000,
},
```

Update `workspace/hooks/dashboard-reporter/handler.ts` to send `moonshotai/kimi-k2.5` as model ID (lines 244, 263).

Set `DEFAULT_MODEL` to `"moonshotai/kimi-k2.5"` in cost-models.ts.

## Related Files

- `dashboard/lib/cost-models.ts` (lines 13-19, 40)
- `workspace/hooks/dashboard-reporter/handler.ts` (lines 244, 263)
- `config/openclaw.json` (model: `openrouter/moonshotai/kimi-k2.5`)
- Issue #021 (model switch tracking)
