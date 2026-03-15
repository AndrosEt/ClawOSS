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
                <span className="font-mono truncate flex-1 text-left">
                  {session.sessionId.length > 16
                    ? session.sessionId.slice(0, 16) + "..."
                    : session.sessionId}
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
