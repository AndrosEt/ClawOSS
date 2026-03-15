"use client";

import { Card, CardContent } from "@/components/ui/card";

interface PRStatsBarProps {
  total: number;
  open: number;
  merged: number;
  closed: number;
  avgReviewTime: number;
}

export function PRStatsBar({
  total,
  open,
  merged,
  closed,
  avgReviewTime,
}: PRStatsBarProps) {
  const stats = [
    { label: "Total", value: total },
    { label: "Open", value: open },
    { label: "Merged", value: merged },
    { label: "Closed", value: closed },
    { label: "Avg Review", value: `${avgReviewTime}h` },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
