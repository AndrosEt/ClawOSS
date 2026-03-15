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

export function SessionPicker({
  sessions,
  activeSessionId,
  onSelectSession,
}: SessionPickerProps) {
  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium">Sessions</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-1">
        <Button
          variant={activeSessionId === undefined ? "default" : "ghost"}
          size="sm"
          className="w-full justify-start text-xs h-7"
          onClick={() => onSelectSession(undefined)}
        >
          All Sessions
        </Button>
        {sessions.map((session) => {
          const last =
            typeof session.lastMessage === "string"
              ? new Date(session.lastMessage)
              : session.lastMessage;
          const isSubagent =
            session.isSubagent || session.sessionId.includes("subagent:");
          const displayName = isSubagent
            ? "sub:" + session.sessionId.split(":").pop()?.slice(0, 8) + "..."
            : session.sessionId.length > 16
            ? session.sessionId.slice(0, 16) + "..."
            : session.sessionId;
          const prLabel =
            session.repo && session.issue
              ? `${session.repo}${session.issue}`
              : session.repo
              ? session.repo
              : null;
          return (
            <Button
              key={session.sessionId}
              variant={
                activeSessionId === session.sessionId ? "default" : "ghost"
              }
              size="sm"
              className="w-full justify-start text-xs h-auto py-1.5 flex-col items-start"
              onClick={() => onSelectSession(session.sessionId)}
            >
              <div className="flex items-center gap-2 w-full">
                {isSubagent && (
                  <span className="text-[9px] text-yellow-400">{"~>"}</span>
                )}
                <span className="font-mono truncate flex-1 text-left">
                  {displayName}
                </span>
                {session.isActive && (
                  <Badge
                    variant="default"
                    className="text-[9px] h-3.5 px-1 bg-green-500"
                  >
                    LIVE
                  </Badge>
                )}
                {isSubagent && (
                  <Badge
                    variant="outline"
                    className="text-[8px] h-3 px-1 text-yellow-400 border-yellow-400/30"
                  >
                    SUB
                  </Badge>
                )}
              </div>
              {prLabel && (
                <div className="w-full">
                  <span className="text-[9px] text-cyan-400 font-mono truncate block">
                    {prLabel}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 w-full text-muted-foreground">
                <span>{session.messageCount} msgs</span>
                <span>{formatRelativeTime(last)}</span>
              </div>
            </Button>
          );
        })}
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No sessions yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}
