"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatTokens, formatCost, formatPercentage } from "@/lib/utils";

interface MetricCardsProps {
  totalPRs: number;
  mergeRate: number;
  inputTokensToday: number;
  outputTokensToday: number;
  costToday: number;
}

function MiniBar({ value, max, segments = 12, color }: { value: number; max: number; segments?: number; color?: string }) {
  const filled = Math.round((value / Math.max(max, 1)) * segments);
  const barColor = color || "bg-emerald-500/50";
  return (
    <div className="flex gap-[2px] mt-2" aria-hidden="true">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`h-[3px] flex-1 rounded-[1px] transition-all ${
            i < filled ? barColor : "bg-foreground/5"
          }`}
        />
      ))}
    </div>
  );
}

export function MetricCards({
  totalPRs,
  mergeRate,
  inputTokensToday,
  outputTokensToday,
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
      label: "Input/24h",
      value: formatTokens(inputTokensToday),
      sub: inputTokensToday > 0 ? "prompt tokens" : null,
      bar: { value: Math.min(inputTokensToday / 1000, 500), max: 500 },
      barColor: "bg-cyan-500/40",
    },
    {
      label: "Output/24h",
      value: formatTokens(outputTokensToday),
      sub: outputTokensToday > 0 ? "completion tokens" : null,
      bar: { value: Math.min(outputTokensToday / 1000, 200), max: 200 },
      barColor: "bg-violet-500/40",
    },
    {
      label: "Cost/24h",
      value: formatCost(costToday),
      sub: costToday > 0 ? "kimi k2.5" : null,
      bar: { value: costToday, max: 5 },
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className="metric-card card-lift">
          <CardContent className="p-4 pb-3">
            <div className="stat-label">{card.label}</div>
            <div className="stat-value mt-1.5 tabular-nums">{card.value}</div>
            {card.sub && (
              <div className="text-[10px] font-mono text-muted-foreground/35 mt-1">{card.sub}</div>
            )}
            <MiniBar value={card.bar.value} max={card.bar.max} color={card.barColor} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
