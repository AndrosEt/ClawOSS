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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Agent Status</CardTitle>
        <Badge variant={status.isOnline ? "default" : "destructive"}>
          {status.isOnline ? "Online" : "Offline"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Uptime</p>
            <p className="font-medium">{formatDuration(status.uptimeSeconds)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Heartbeat Streak</p>
            <p className="font-medium">{status.heartbeatStreak.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Current Task</p>
            <p className="font-medium truncate">
              {status.currentTask || "Idle"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
