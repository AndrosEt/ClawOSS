"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { ConversationFeed } from "@/components/live/conversation-feed";
import { SessionPicker } from "@/components/live/session-picker";
import { LiveStatsBar } from "@/components/live/live-stats-bar";
import { ToolAnalytics } from "@/components/live/tool-analytics";
import { SessionDetail } from "@/components/live/session-detail";
import { AgentStatePanel } from "@/components/live/agent-state-panel";
import { MessageFilters, type RoleFilter } from "@/components/live/message-filters";
import {
  useConversation,
  useConversationSessions,
} from "@/lib/hooks/use-conversation";
import { useConnectionStatus } from "@/lib/hooks/use-connection-status";
import { useAgentState } from "@/lib/hooks/use-agent-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LivePage() {
  const [selectedSession, setSelectedSession] = useState<string | undefined>(
    undefined
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rightPanel, setRightPanel] = useState<"analytics" | "state">("state");

  const { data: conversationData, isLoading } =
    useConversation(selectedSession);
  const { data: sessionsData } = useConversationSessions();
  const { data: connectionData } = useConnectionStatus();
  const { data: stateData, isLoading: stateLoading } = useAgentState();

  const allMessages = conversationData?.messages || [];
  const sessions = sessionsData?.sessions || [];
  const isConnected = connectionData?.connection?.state === "connected";
  const agentState = stateData?.state || null;

  // Find the active session object
  const activeSession = selectedSession
    ? sessions.find((s) => s.sessionId === selectedSession)
    : undefined;

  // Filter messages
  const filteredMessages = useMemo(() => {
    let msgs = allMessages;
    if (roleFilter !== "all") {
      msgs = msgs.filter((m) => m.role === roleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      msgs = msgs.filter(
        (m) =>
          m.content?.toLowerCase().includes(q) ||
          m.toolName?.toLowerCase().includes(q) ||
          m.sessionId?.toLowerCase().includes(q)
      );
    }
    return msgs;
  }, [allMessages, roleFilter, searchQuery]);

  return (
    <div className="flex flex-col h-screen">
      <Header title="Live Feed" />
      <LiveStatsBar messages={allMessages} isConnected={isConnected} />
      <MessageFilters
        activeFilter={roleFilter}
        onFilterChange={setRoleFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Session Picker + Controls */}
        <div className="w-56 border-r p-3 overflow-y-auto shrink-0 hidden md:block space-y-3">
          <SessionPicker
            sessions={sessions}
            activeSessionId={selectedSession}
            onSelectSession={setSelectedSession}
          />
          <div className="space-y-2">
            <Button
              variant={autoScroll ? "default" : "outline"}
              size="sm"
              className="w-full text-xs"
              onClick={() => setAutoScroll(!autoScroll)}
            >
              {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
            </Button>
          </div>
        </div>

        {/* Main: Conversation Feed */}
        <div className="flex-1 overflow-hidden p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <ConversationFeed
              messages={filteredMessages}
              autoScroll={autoScroll}
            />
          )}
        </div>

        {/* Right Sidebar: Tabbed (State / Analytics) */}
        <div className="w-72 border-l overflow-y-auto shrink-0 hidden lg:block">
          <div className="p-3 border-b">
            <Tabs value={rightPanel} onValueChange={(v) => setRightPanel(v as "analytics" | "state")}>
              <TabsList className="w-full h-8">
                <TabsTrigger value="state" className="text-xs flex-1">
                  Agent State
                </TabsTrigger>
                <TabsTrigger value="analytics" className="text-xs flex-1">
                  Analytics
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="p-3 space-y-3">
            {rightPanel === "state" ? (
              <AgentStatePanel state={agentState} isLoading={stateLoading} />
            ) : (
              <>
                <SessionDetail
                  session={activeSession}
                  messages={selectedSession ? allMessages : allMessages}
                />
                <ToolAnalytics messages={allMessages} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
