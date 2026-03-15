"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/utils";
import type { AgentStatus } from "@/lib/types";

interface AgentStatusCardProps {
  status: AgentStatus;
}

export function AgentStatusCard({ status }: AgentStatusCardProps) {
  return (
    <Card className="card-glow animate-fade-up">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${status.isOnline ? "bg-green-500 glow-dot glow-dot-green" : "bg-red-500"}`} />
          Agent Status
        </CardTitle>
        <Badge
          variant={status.isOnline ? "default" : "destructive"}
          className={status.isOnline ? "badge-glow-green" : "badge-glow-red"}
        >
          {status.isOnline ? "Online" : "Offline"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-mono">Uptime</p>
            <p className="font-bold text-lg tracking-tight mt-0.5">{formatDuration(status.uptimeSeconds)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-mono">HB Streak</p>
            <p className="font-bold text-lg tracking-tight mt-0.5">{status.heartbeatStreak.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-mono">Current Task</p>
            <p className="font-medium truncate mt-0.5">
              {status.currentTask || <span className="text-muted-foreground italic">Idle</span>}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
