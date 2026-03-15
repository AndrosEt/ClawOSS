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
    },
    {
      title: "Merge Rate",
      value: formatPercentage(mergeRate),
      icon: Percent,
    },
    {
      title: "Tokens 24h",
      value: formatTokens(tokensUsedToday),
      icon: Zap,
    },
    {
      title: "Cost Today",
      value: formatCost(costToday),
      icon: Coins,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
