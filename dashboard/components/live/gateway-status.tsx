"use client";

import { Badge } from "@/components/ui/badge";
import type { ConversationSession } from "@/lib/types";

interface GatewayStatusProps {
  lastHeartbeat: string | null;
  connectionState: string;
  heartbeatsLastHour: number;
  errorsLastHour: number;
  sessions: ConversationSession[];
}

const SKILLS = [
  "dashboard-reporter",
  "audit-logger",
  "oss-discover",
  "oss-triage",
  "oss-implement",
  "oss-followup",
  "oss-review",
  "repo-analyzer",
  "self-review",
  "heartbeat",
  "session-manager",
  "compaction",
  "context-monitor",
  "loop-detection",
];

export function GatewayStatus({
  lastHeartbeat,
  connectionState,
  heartbeatsLastHour,
  errorsLastHour,
  sessions,
}: GatewayStatusProps) {
  const isOnline = connectionState === "connected";
  const isDegraded = connectionState === "degraded";
  const lastHbDate = lastHeartbeat ? new Date(lastHeartbeat) : null;
  const staleness = lastHbDate
    ? Math.floor((Date.now() - lastHbDate.getTime()) / 1000)
    : null;

  const activeSessions = sessions.filter((s) => s.isActive);
  const subagentSessions = sessions.filter(
    (s) => s.isSubagent || s.sessionId.includes("subagent:")
  );

  // Next heartbeat estimate (every 10 min)
  const nextHbEstimate = lastHbDate
    ? new Date(lastHbDate.getTime() + 10 * 60 * 1000)
    : null;
  const nextHbIn = nextHbEstimate
    ? Math.max(0, Math.floor((nextHbEstimate.getTime() - Date.now()) / 1000))
    : null;

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Gateway header */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <div
          className={`w-2 h-2 rounded-full ${
            isOnline
              ? "bg-green-400 animate-pulse"
              : isDegraded
              ? "bg-yellow-400 animate-pulse"
              : "bg-red-400"
          }`}
        />
        <span className="font-bold text-sm">
          OpenClaw Gateway
        </span>
        <Badge
          variant="outline"
          className={`text-[9px] h-4 px-1.5 ${
            isOnline
              ? "text-green-400 border-green-400/30"
              : isDegraded
              ? "text-yellow-400 border-yellow-400/30"
              : "text-red-400 border-red-400/30"
          }`}
        >
          {isOnline ? "ONLINE" : isDegraded ? "DEGRADED" : "OFFLINE"}
        </Badge>
      </div>

      {/* Gateway info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Port</span>
          <span>18789</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Mode</span>
          <span>local</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Model</span>
          <span className="text-cyan-400">kimi-coding/k2p5</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Auth</span>
          <span className="text-green-400">token</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">HB interval</span>
          <span>10m</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">HBs/hr</span>
          <span className={heartbeatsLastHour > 0 ? "text-green-400" : "text-red-400"}>
            {heartbeatsLastHour}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Errors/hr</span>
          <span className={errorsLastHour > 0 ? "text-red-400" : "text-green-400"}>
            {errorsLastHour}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">MaxConc</span>
          <span>5</span>
        </div>
      </div>

      {/* Heartbeat timing */}
      <div className="p-2 bg-muted/10 rounded border space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Last heartbeat</span>
          <span
            className={
              staleness != null && staleness > 900
                ? "text-red-400"
                : staleness != null && staleness > 300
                ? "text-yellow-400"
                : "text-green-400"
            }
          >
            {staleness != null
              ? staleness > 3600
                ? `${Math.floor(staleness / 3600)}h ${Math.floor(
                    (staleness % 3600) / 60
                  )}m ago`
                : staleness > 60
                ? `${Math.floor(staleness / 60)}m ${staleness % 60}s ago`
                : `${staleness}s ago`
              : "never"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Next HB (est)</span>
          <span className="text-muted-foreground/60">
            {nextHbIn != null
              ? nextHbIn > 0
                ? `in ${Math.floor(nextHbIn / 60)}m ${nextHbIn % 60}s`
                : "overdue"
              : "--"}
          </span>
        </div>
      </div>

      {/* Sessions */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Sessions</span>
          <span>
            {activeSessions.length} active / {sessions.length} total
          </span>
        </div>
        {sessions.slice(0, 8).map((s) => {
          const isActive = s.isActive;
          const isSub =
            s.isSubagent || s.sessionId.includes("subagent:");
          const age = Math.floor(
            (Date.now() -
              new Date(
                typeof s.firstMessage === "string"
                  ? s.firstMessage
                  : s.firstMessage
              ).getTime()) /
              60000
          );
          return (
            <div
              key={s.sessionId}
              className="flex items-center gap-2 px-1 py-0.5"
            >
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isActive
                    ? "bg-green-400 animate-pulse"
                    : "bg-muted-foreground/30"
                }`}
              />
              <span
                className={`truncate flex-1 ${
                  isSub ? "text-yellow-400" : "text-blue-400"
                }`}
              >
                {isSub
                  ? "sub:" + s.sessionId.split(":").pop()?.slice(0, 8)
                  : s.sessionId.slice(0, 16)}
              </span>
              {isSub && (
                <Badge
                  variant="outline"
                  className="text-[7px] h-3 px-0.5 text-yellow-400 border-yellow-400/30"
                >
                  SUB
                </Badge>
              )}
              <span className="text-muted-foreground/50 text-[9px] shrink-0">
                {s.messageCount}msg
              </span>
              <span className="text-muted-foreground/50 text-[9px] w-10 text-right shrink-0">
                {age}m
              </span>
            </div>
          );
        })}
      </div>

      {/* Skill Inventory */}
      <div className="space-y-1">
        <div className="text-muted-foreground">
          Skills ({SKILLS.length} loaded)
        </div>
        <div className="flex flex-wrap gap-1">
          {SKILLS.map((skill) => (
            <Badge
              key={skill}
              variant="outline"
              className="text-[8px] h-3.5 px-1 text-muted-foreground border-muted-foreground/20 hover:text-foreground transition-colors"
            >
              {skill}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
