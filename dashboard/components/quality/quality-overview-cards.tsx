"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercentage } from "@/lib/utils";

interface QualityOverviewCardsProps {
  avgScore: number;
  avgScoreChange: number;
  firstPassRate: number;
  firstPassChange: number;
  reviewScore: number;
  rejectionRate: number;
  rejectionChange: number;
}

export function QualityOverviewCards({
  avgScore,
  avgScoreChange,
  firstPassRate,
  firstPassChange,
  reviewScore,
  rejectionRate,
  rejectionChange,
}: QualityOverviewCardsProps) {
  const cards = [
    {
      title: "Avg Score",
      value: avgScore.toFixed(1),
      change: avgScoreChange,
      suffix: "",
    },
    {
      title: "1st Pass Rate",
      value: formatPercentage(firstPassRate),
      change: firstPassChange,
      suffix: "",
    },
    {
      title: "Review Score",
      value: `${reviewScore.toFixed(1)}/5.0`,
      change: null,
      suffix: "",
    },
    {
      title: "Rejection Rate",
      value: formatPercentage(rejectionRate),
      change: rejectionChange,
      suffix: "",
      invertColor: true,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            {card.change != null && (
              <p
                className={`text-xs ${
                  card.invertColor
                    ? card.change < 0
                      ? "text-green-500"
                      : card.change > 0
                        ? "text-red-500"
                        : "text-muted-foreground"
                    : card.change > 0
                      ? "text-green-500"
                      : card.change < 0
                        ? "text-red-500"
                        : "text-muted-foreground"
                }`}
              >
                {card.change > 0 ? "+" : ""}
                {card.change.toFixed(1)} MTD
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
