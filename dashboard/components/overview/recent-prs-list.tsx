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

function QualityDot({ score }: { score: number }) {
  const cls = score >= 80 ? "q-high" : score >= 60 ? "q-mid" : "q-low";
  return (
    <span className={`quality-ring ${cls}`} title={`Quality: ${score.toFixed(1)}`}>
      {score.toFixed(0)}
    </span>
  );
}

export function RecentPRsList({ prs, limit = 5 }: RecentPRsListProps) {
  const displayed = prs.slice(0, limit);

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Recent PRs</span>
          {prs.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">
              {prs.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayed.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No PRs yet</p>
            <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Waiting for first PR...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((pr) => (
              <div
                key={pr.id}
                className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors group"
              >
                {/* Quality ring */}
                {pr.qualityScore != null ? (
                  <QualityDot score={pr.qualityScore} />
                ) : (
                  <span className="quality-ring text-muted-foreground/30 border-muted-foreground/20">--</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                    <span className="text-muted-foreground">#{pr.number}</span> {pr.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                      {pr.repo}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40 font-mono">
                      {formatRelativeTime(pr.createdAt)}
                    </span>
                  </div>
                </div>
                <Badge variant={statusVariant[pr.status] || "outline"} className="text-[10px] shrink-0">
                  {pr.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
