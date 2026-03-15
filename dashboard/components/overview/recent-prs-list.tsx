"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import type { PullRequestSummary } from "@/lib/types";

interface RecentPRsListProps {
  prs: PullRequestSummary[];
  limit?: number;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "default",
  merged: "secondary",
  closed: "destructive",
};

export function RecentPRsList({ prs, limit = 5 }: RecentPRsListProps) {
  const displayed = prs.slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Recent PRs</CardTitle>
      </CardHeader>
      <CardContent>
        {displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No PRs yet</p>
        ) : (
          <div className="space-y-3">
            {displayed.map((pr) => (
              <div key={pr.id} className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    #{pr.number} {pr.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {pr.repo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(pr.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {pr.qualityScore != null && (
                    <span className="text-xs font-mono">
                      {pr.qualityScore.toFixed(0)}
                    </span>
                  )}
                  <Badge variant={statusVariant[pr.status] || "outline"}>
                    {pr.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
