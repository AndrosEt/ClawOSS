"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import type { ConversationSession } from "@/lib/types";

interface SessionPickerProps {
  sessions: ConversationSession[];
  activeSessionId: string | undefined;
  onSelectSession: (sessionId: string | undefined) => void;
}

function getSessionLabel(session: ConversationSession): {
  name: string;
  detail: string | null;
  isSubagent: boolean;
} {
  const isSubagent =
    session.isSubagent || session.sessionId.includes("subagent:");

  if (isSubagent) {
    const prLabel =
      session.repo && session.issue
        ? `${session.repo}${session.issue}`
        : session.repo
        ? session.repo
        : null;
    return {
      name: prLabel
        ? `Sub: ${prLabel}`
        : "Sub: " + session.sessionId.split(":").pop()?.slice(0, 8),
      detail: prLabel ? null : session.sessionId.split(":").pop()?.slice(0, 12) || null,
      isSubagent: true,
    };
  }

  return {
    name: "Main: ClawOSS Orchestrator",
    detail:
      session.sessionId.length > 20
        ? session.sessionId.slice(0, 20) + "..."
        : session.sessionId,
    isSubagent: false,
  };
}

export function SessionPicker({
  sessions,
  activeSessionId,
  onSelectSession,
}: SessionPickerProps) {
  const mainSessions = sessions.filter(
    (s) => !s.isSubagent && !s.sessionId.includes("subagent:")
  );
  const subSessions = sessions.filter(
    (s) => s.isSubagent || s.sessionId.includes("subagent:")
  );

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Sessions</span>
          <Badge variant="outline" className="text-[9px] h-4 px-1.5">
            {sessions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-1">
        {/* Unified timeline button */}
        <Button
          variant={activeSessionId === undefined ? "default" : "ghost"}
          size="sm"
          className="w-full justify-start text-xs h-7"
          onClick={() => onSelectSession(undefined)}
        >
          Unified Timeline (all sessions)
        </Button>

        {/* Main orchestrator sessions */}
        {mainSessions.length > 0 && (
          <div className="pt-1">
            <div className="text-[9px] text-muted-foreground/60 px-1 pb-1 font-mono uppercase tracking-wider">
              Orchestrator
            </div>
            {mainSessions.map((session) => (
              <SessionButton
                key={session.sessionId}
                session={session}
                isActive={activeSessionId === session.sessionId}
                onClick={() => onSelectSession(session.sessionId)}
              />
            ))}
          </div>
        )}

        {/* Sub-agent sessions */}
        {subSessions.length > 0 && (
          <div className="pt-1">
            <div className="text-[9px] text-muted-foreground/60 px-1 pb-1 font-mono uppercase tracking-wider">
              Sub-Agents ({subSessions.length})
            </div>
            {subSessions.map((session) => (
              <SessionButton
                key={session.sessionId}
                session={session}
                isActive={activeSessionId === session.sessionId}
                onClick={() => onSelectSession(session.sessionId)}
              />
            ))}
          </div>
        )}

        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No sessions yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SessionButton({
  session,
  isActive,
  onClick,
}: {
  session: ConversationSession;
  isActive: boolean;
  onClick: () => void;
}) {
  const last =
    typeof session.lastMessage === "string"
      ? new Date(session.lastMessage)
      : session.lastMessage;
  const label = getSessionLabel(session);

  return (
    <Button
      variant={isActive ? "default" : "ghost"}
      size="sm"
      className="w-full justify-start text-xs h-auto py-1.5 flex-col items-start"
      onClick={onClick}
    >
      <div className="flex items-center gap-2 w-full">
        {label.isSubagent ? (
          <span className="text-[9px] text-yellow-400">{"~>"}</span>
        ) : (
          <span className="text-[9px] text-blue-400">{"#"}</span>
        )}
        <span
          className={`font-mono truncate flex-1 text-left ${
            label.isSubagent ? "text-yellow-400" : "text-blue-400"
          }`}
        >
          {label.name}
        </span>
        {session.isActive && (
          <Badge
            variant="default"
            className="text-[9px] h-3.5 px-1 bg-green-500"
          >
            LIVE
          </Badge>
        )}
      </div>
      {label.detail && (
        <div className="w-full">
          <span className="text-[9px] text-muted-foreground/50 font-mono truncate block">
            {label.detail}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 w-full text-muted-foreground">
        <span>{session.messageCount} msgs</span>
        <span>{formatRelativeTime(last)}</span>
      </div>
    </Button>
  );
}
