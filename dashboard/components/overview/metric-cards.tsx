"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatTokens, formatCost, formatPercentage } from "@/lib/utils";

interface MetricCardsProps {
  totalPRs: number;
  mergeRate: number;
  tokensUsedToday: number;
  costToday: number;
}

function MiniBar({ value, max, segments = 12 }: { value: number; max: number; segments?: number }) {
  const filled = Math.round((value / Math.max(max, 1)) * segments);
  return (
    <div className="flex gap-[2px] mt-2" aria-hidden="true">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`h-[3px] flex-1 rounded-[1px] transition-all ${
            i < filled ? "bg-emerald-500/50" : "bg-foreground/5"
          }`}
        />
      ))}
    </div>
  );
}

export function MetricCards({
  totalPRs,
  mergeRate,
  tokensUsedToday,
  costToday,
}: MetricCardsProps) {
  const cards = [
    {
      label: "PRs",
      value: totalPRs.toString(),
      sub: totalPRs > 0 ? "across repos" : null,
      bar: { value: totalPRs, max: 20 },
    },
    {
      label: "Merge Rate",
      value: formatPercentage(mergeRate),
      sub: mergeRate >= 10 ? "healthy" : mergeRate > 0 ? "warming up" : null,
      bar: { value: mergeRate, max: 100 },
    },
    {
      label: "Tokens/24h",
      value: formatTokens(tokensUsedToday),
      sub: tokensUsedToday > 0 ? "burned today" : null,
      bar: { value: Math.min(tokensUsedToday / 1000, 500), max: 500 },
    },
    {
      label: "Cost/24h",
      value: formatCost(costToday),
      sub: costToday > 0 ? "kimi k2.5" : null,
      bar: { value: costToday, max: 5 },
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="metric-card">
          <CardContent className="p-3">
            <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">{card.label}</div>
            <div className="text-2xl font-mono font-bold tracking-tighter mt-1 tabular-nums">{card.value}</div>
            {card.sub && (
              <div className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">{card.sub}</div>
            )}
            <MiniBar value={card.bar.value} max={card.bar.max} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
