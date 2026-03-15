"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import type { ActivityItem } from "@/lib/types";

interface ActivityTimelineProps {
  items: ActivityItem[];
  maxItems?: number;
}

const typeColors: Record<string, string> = {
  pr_created: "bg-blue-500",
  pr_merged: "bg-green-500",
  pr_closed: "bg-red-500",
  review_received: "bg-purple-500",
  heartbeat: "bg-gray-500",
  error: "bg-red-600",
  task_started: "bg-yellow-500",
};

const typeLabels: Record<string, string> = {
  pr_created: "PR Created",
  pr_merged: "PR Merged",
  pr_closed: "PR Closed",
  review_received: "Review",
  heartbeat: "Heartbeat",
  error: "Error",
  task_started: "Task",
};

export function ActivityTimeline({
  items,
  maxItems = 10,
}: ActivityTimelineProps) {
  const displayed = items.slice(0, maxItems);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {displayed.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <span
                  className={`mt-1 h-2 w-2 rounded-full ${typeColors[item.type] || "bg-gray-400"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {typeLabels[item.type] || item.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm truncate mt-0.5">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
