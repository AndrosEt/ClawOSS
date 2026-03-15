"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConversationSession } from "@/lib/types";

interface SessionTabsProps {
  sessions: ConversationSession[];
  activeSessionId: string | undefined;
  onSelectSession: (sessionId: string | undefined) => void;
}

export function SessionTabs({
  sessions,
  activeSessionId,
  onSelectSession,
}: SessionTabsProps) {
  const mainSessions = sessions.filter(
    (s) => !s.isSubagent && !s.sessionId.includes("subagent:")
  );
  const subSessions = sessions.filter(
    (s) => s.isSubagent || s.sessionId.includes("subagent:")
  );

  return (
    <div className="flex items-center gap-1 px-4 py-1 border-b bg-background/50 overflow-x-auto">
      {/* Unified view */}
      <Button
        variant={activeSessionId === undefined ? "default" : "ghost"}
        size="sm"
        className="text-[10px] h-6 px-2.5 shrink-0"
        onClick={() => onSelectSession(undefined)}
      >
        All Sessions
      </Button>

      {/* Main sessions */}
      {mainSessions.map((session) => (
        <Button
          key={session.sessionId}
          variant={activeSessionId === session.sessionId ? "default" : "ghost"}
          size="sm"
          className="text-[10px] h-6 px-2.5 shrink-0 gap-1.5"
          onClick={() => onSelectSession(session.sessionId)}
        >
          <span className="text-blue-400">#</span>
          <span>Main: Orchestrator</span>
          {session.isActive && (
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          )}
        </Button>
      ))}

      {/* Separator if both exist */}
      {mainSessions.length > 0 && subSessions.length > 0 && (
        <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
      )}

      {/* Sub-agent sessions */}
      {subSessions.map((session) => {
        const prLabel =
          session.repo && session.issue
            ? `${session.repo}${session.issue}`
            : session.repo
            ? session.repo
            : "sub:" + session.sessionId.split(":").pop()?.slice(0, 8);

        return (
          <Button
            key={session.sessionId}
            variant={
              activeSessionId === session.sessionId ? "default" : "ghost"
            }
            size="sm"
            className="text-[10px] h-6 px-2.5 shrink-0 gap-1.5"
            onClick={() => onSelectSession(session.sessionId)}
          >
            <span className="text-yellow-400">{"~>"}</span>
            <span>Sub: {prLabel}</span>
            {session.isActive && (
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
            <Badge
              variant="outline"
              className="text-[7px] h-3 px-0.5 text-muted-foreground/50 ml-0.5"
            >
              {session.messageCount}
            </Badge>
          </Button>
        );
      })}

      {sessions.length === 0 && (
        <span className="text-[10px] text-muted-foreground/50 px-2">
          No sessions yet
        </span>
      )}
    </div>
  );
}
