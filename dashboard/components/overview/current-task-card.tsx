"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TaskInfo } from "@/lib/types";

interface CurrentTaskCardProps {
  task: TaskInfo | null;
}

const statusLabels: Record<string, string> = {
  analyzing: "Analyzing",
  coding: "Coding",
  testing: "Testing",
  reviewing: "Reviewing",
  submitting: "Submitting",
};

export function CurrentTaskCard({ task }: CurrentTaskCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Current Task</CardTitle>
      </CardHeader>
      <CardContent>
        {!task ? (
          <p className="text-sm text-muted-foreground">No active task</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium truncate">{task.title}</p>
              <Badge variant="outline">
                {statusLabels[task.status] || task.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {task.repo} #{task.issue}
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {task.progress}% complete
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
