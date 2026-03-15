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

const statusColors: Record<string, string> = {
  analyzing: "text-blue-400 border-blue-400/30",
  coding: "text-green-400 border-green-400/30",
  testing: "text-yellow-400 border-yellow-400/30",
  reviewing: "text-purple-400 border-purple-400/30",
  submitting: "text-cyan-400 border-cyan-400/30",
};

export function CurrentTaskCard({ task }: CurrentTaskCardProps) {
  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Current Task</CardTitle>
      </CardHeader>
      <CardContent>
        {!task ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No active task</p>
            <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Agent is idle</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{task.title}</p>
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 ${statusColors[task.status] || ""}`}
              >
                {statusLabels[task.status] || task.status}
              </Badge>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {task.repo} #{task.issue}
            </div>
            <div className="space-y-1.5">
              <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out progress-gradient"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/60 text-right font-mono">
                {task.progress}%
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
