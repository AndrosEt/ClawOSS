# 017: Dashboard Cost Model Uses Wrong Model ID

**Status:** Open
**Severity:** Medium
**Component:** dashboard/lib/cost-models.ts

## Description

The dashboard's cost model registry uses `minimax/MiniMax-M1-80k` as the model identifier for M2.5, while the OpenClaw config uses `openrouter/minimax/minimax-m2.5`. The model name in the cost registry says "MiniMax M2.5" but the key says "MiniMax-M1-80k".

This means when metrics come in with the actual model identifier from OpenRouter, the cost computation may fall through to the default, which happens to be the same model — so costs are correct by accident, not by design.

## Root Cause

The model ID was likely taken from an early OpenRouter listing. The MiniMax model IDs on OpenRouter may vary between `MiniMax-M1-80k`, `minimax-m2.5`, etc.

## Impact

- Cost attribution may not match the actual model used
- If OpenRouter changes model IDs or adds new M2.5 variants, cost tracking breaks
- Dashboard's model display may show incorrect names

## Recommended Fix

Update `dashboard/lib/cost-models.ts` to include the actual model ID used in `config/openclaw.json`:

```typescript
"minimax/minimax-m2.5": {
  name: "MiniMax M2.5",
  provider: "openrouter",
  inputCostPerToken: 0.27 / 1_000_000,
  outputCostPerToken: 1.10 / 1_000_000,
},
```

Also verify the actual pricing — the research docs say $0.27/MTok input, $1.10/MTok output, but the cost model says $0.25/$1.20.

## Related Files

- `dashboard/lib/cost-models.ts` (lines 12-18, 39-41)
- `config/openclaw.json` (model: `openrouter/minimax/minimax-m2.5`)
- `research/07-throughput-critique.md` (M2.5 pricing reference)
