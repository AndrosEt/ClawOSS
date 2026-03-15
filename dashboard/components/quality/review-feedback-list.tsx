"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ReviewFeedbackListProps {
  items: {
    prNumber: number;
    prTitle: string;
    reviewer: string;
    comment: string;
    sentiment: "positive" | "negative" | "neutral";
    date: Date | string;
  }[];
}

const sentimentVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  positive: "default",
  negative: "destructive",
  neutral: "outline",
};

export function ReviewFeedbackList({ items }: ReviewFeedbackListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Review Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback yet</p>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 10).map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <Badge
                  variant={sentimentVariant[item.sentiment] || "outline"}
                  className="shrink-0"
                >
                  {item.sentiment === "positive"
                    ? "Pos"
                    : item.sentiment === "negative"
                      ? "Neg"
                      : "Neu"}
                </Badge>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    PR #{item.prNumber} - @{item.reviewer}
                  </p>
                  <p className="text-muted-foreground truncate">
                    {item.comment}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
