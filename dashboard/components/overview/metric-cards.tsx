"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitPullRequest, Percent, Coins, Zap } from "lucide-react";
import { formatTokens, formatCost, formatPercentage } from "@/lib/utils";

interface MetricCardsProps {
  totalPRs: number;
  mergeRate: number;
  tokensUsedToday: number;
  costToday: number;
}

const iconColors: Record<string, string> = {
  "Total PRs": "text-blue-400",
  "Merge Rate": "text-green-400",
  "Tokens 24h": "text-yellow-400",
  "Cost Today": "text-emerald-400",
};

export function MetricCards({
  totalPRs,
  mergeRate,
  tokensUsedToday,
  costToday,
}: MetricCardsProps) {
  const cards = [
    {
      title: "Total PRs",
      value: totalPRs.toString(),
      icon: GitPullRequest,
      sub: totalPRs > 0 ? `across repos` : null,
    },
    {
      title: "Merge Rate",
      value: formatPercentage(mergeRate),
      icon: Percent,
      sub: mergeRate >= 10 ? "healthy" : mergeRate > 0 ? "warming up" : null,
    },
    {
      title: "Tokens 24h",
      value: formatTokens(tokensUsedToday),
      icon: Zap,
      sub: tokensUsedToday > 0 ? "burned today" : null,
    },
    {
      title: "Cost Today",
      value: formatCost(costToday),
      icon: Coins,
      sub: costToday > 0 ? "Kimi K2.5 pricing" : null,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <Card key={card.title} className={`card-glow hover-lift animate-fade-up animate-fade-up-${i + 1}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <div className={`p-1.5 rounded-md bg-muted/50 ${iconColors[card.title] || "text-muted-foreground"}`}>
              <card.icon className="h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{card.value}</div>
            {card.sub && (
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">{card.sub}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
