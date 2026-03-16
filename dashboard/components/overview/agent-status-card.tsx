"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import type { AgentStatus } from "@/lib/types";

interface AgentStatusCardProps {
  status: AgentStatus;
}

export function AgentStatusCard({ status }: AgentStatusCardProps) {
  return (
    <Card className="accent-top corner-brackets">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="relative flex h-2.5 w-2.5">
              {status.isOnline && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
              )}
              <span className={`relative h-2.5 w-2.5 rounded-full ${status.isOnline ? "bg-emerald-500" : "bg-red-500"}`} />
            </span>
            <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">Agent</span>
            <span className={`font-medium ${status.isOnline ? "text-emerald-400/80" : "text-red-400/80"}`}>
              {status.isOnline ? "online" : "offline"}
            </span>
          </div>
          {status.isOnline && (
            <span className="text-[9px] font-mono text-emerald-500/40 uppercase tracking-widest">active</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 font-mono">
          <div>
            <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Uptime</div>
            <div className="text-lg font-bold mt-0.5 tracking-tight tabular-nums">{formatDuration(status.uptimeSeconds)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">HB Streak</div>
            <div className="text-lg font-bold mt-0.5 tracking-tight tabular-nums">{status.heartbeatStreak.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Current Task</div>
            <div className="text-xs mt-1 truncate">
              {status.currentTask || <span className="text-muted-foreground/40 italic">idle</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
