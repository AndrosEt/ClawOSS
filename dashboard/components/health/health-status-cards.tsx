"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime, formatDuration, formatPercentage } from "@/lib/utils";

interface HealthStatusCardsProps {
  heartbeat: {
    lastBeat: Date | string | null;
    intervalMinutes: number;
    streak: number;
  };
  uptime: {
    percentage: number;
    since: Date | string;
    totalDowntimeMinutes: number;
  };
  errorRate: {
    perHour: number;
    trend: "increasing" | "stable" | "decreasing";
    lastError: Date | string | null;
  };
}

const trendLabels = {
  increasing: "Increasing",
  stable: "Stable",
  decreasing: "Decreasing",
};

export function HealthStatusCards({
  heartbeat,
  uptime,
  errorRate,
}: HealthStatusCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Heartbeat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last</span>
            <span>
              {heartbeat.lastBeat
                ? formatRelativeTime(heartbeat.lastBeat)
                : "Never"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Interval</span>
            <span>{heartbeat.intervalMinutes}min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Streak</span>
            <span>{heartbeat.streak.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Uptime</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Percentage</span>
            <span>{formatPercentage(uptime.percentage)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Since</span>
            <span>{formatRelativeTime(uptime.since)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Downtime</span>
            <span>{formatDuration(uptime.totalDowntimeMinutes * 60)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Per Hour</span>
            <span>{errorRate.perHour}/hr</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Trend</span>
            <span>{trendLabels[errorRate.trend]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Error</span>
            <span>
              {errorRate.lastError
                ? formatRelativeTime(errorRate.lastError)
                : "None"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
