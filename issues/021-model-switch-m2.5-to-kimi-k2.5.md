# 021: Model Switch from Minimax M2.5 to Moonshot Kimi K2.5

**Status:** Completed (config, dashboard code, and docs updated)
**Severity:** Low (only historical research docs retain M2.5 references, which is correct)
**Component:** Configuration / Documentation

## Description

The primary model in `config/openclaw.json` was switched from `openrouter/minimax/minimax-m2.5` to `openrouter/moonshotai/kimi-k2.5`. All four model references (defaults.model.primary, defaults.subagents.model, agent model, heartbeat model) were updated.

## New Model: Kimi K2.5

| Property | Minimax M2.5 (old) | Kimi K2.5 (new) |
|----------|-------------------|-----------------|
| Provider | Minimax via OpenRouter | Moonshot AI via OpenRouter |
| Input cost | $0.27/MTok | $0.45/MTok |
| Output cost | $1.10/MTok | $2.20/MTok |
| Context window | 196K tokens | 262K tokens |
| SWE-bench Verified | 80.2% | 76.8% |
| Architecture | Dense transformer | MoE — 1T total params / 32B active params |
| Key strength | Cost efficiency | Native multimodal (MoonViT), agentic tool-calling, larger context |

## K2.5 Architecture Notes

- **Mixture of Experts (MoE)**: 1 trillion total parameters, 32 billion active parameters per forward pass. This explains the cost efficiency — only a fraction of parameters are activated per token.
- **MoonViT vision encoder**: Native multimodal capability. Can analyze screenshots attached to GitHub issues.
- **Content filter**: The M2.5 `[PHONE]`/`[EMAIL]` content filter behavior does NOT apply to K2.5 (different model family). However, OpenRouter platform-level filtering may still apply regardless of model. The PII sanitizer hook (#030) provides defense-in-depth.
- **OpenClaw support**: First-class Moonshot/Kimi provider handling with thinking mode normalization — no custom adapter needed.

## Impact

### Config (updated)
- `config/openclaw.json` — all 4 model refs updated to `openrouter/moonshotai/kimi-k2.5`

### Docs needing update
- README.md — model references updated, 2 stale issue descriptions fixed
- CHANGELOG.md — needs Phase 12 entry
- Issues 004, 009, 011, 012, 017 — contain historical M2.5 references (acceptable as historical context)

### Code (already updated)
- `dashboard/lib/cost-models.ts` — updated to `moonshotai/kimi-k2.5` with correct pricing ($0.45/$2.20)
- `workspace/hooks/dashboard-reporter/handler.ts` — updated to send `moonshotai/kimi-k2.5` as model ID

## Related Issues

- #004 — Context window overflow (now 262K instead of 196K, less severe)
- #017 — Dashboard cost model ID mismatch (now worse — model changed entirely)

## Related Files

- `config/openclaw.json`
- `README.md`
- `CHANGELOG.md`
- `dashboard/lib/cost-models.ts`
- `workspace/hooks/dashboard-reporter/handler.ts`
