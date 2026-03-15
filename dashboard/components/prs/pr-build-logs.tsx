"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePRConversation } from "@/lib/hooks/use-pr-conversation";
import { Skeleton } from "@/components/ui/skeleton";

interface PRBuildLogsProps {
  repo: string;
  issueNumber: number | null;
}

const roleConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  assistant: {
    label: "Agent",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    icon: ">>",
  },
  user: {
    label: "Task",
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/20",
    icon: "$",
  },
  tool_call: {
    label: "Tool",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10 border-yellow-500/20",
    icon: "->",
  },
  tool_result: {
    label: "Result",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    icon: "<-",
  },
  system: {
    label: "System",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10 border-gray-500/20",
    icon: "#",
  },
  thinking: {
    label: "Think",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/20",
    icon: "~",
  },
};

const MAX_LINES = 8;

function LogContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split("\n");
  const isTruncatable = lines.length > MAX_LINES;

  const displayContent = expanded
    ? content
    : isTruncatable
    ? lines.slice(0, MAX_LINES).join("\n")
    : content;

  return (
    <div>
      <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
        {displayContent}
      </pre>
      {isTruncatable && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 font-mono"
        >
          {expanded
            ? "[ collapse ]"
            : `[ +${lines.length - MAX_LINES} more lines ]`}
        </button>
      )}
    </div>
  );
}

export function PRBuildLogs({ repo, issueNumber }: PRBuildLogsProps) {
  const issueStr = issueNumber ? `#${issueNumber}` : null;
  const { data, isLoading } = usePRConversation(repo, issueStr);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const messages = data?.messages || [];

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-sm text-muted-foreground">
          No build logs found for this PR.
        </p>
        <p className="text-xs text-muted-foreground/60">
          Sub-agent conversation logs will appear here when the agent works on{" "}
          {repo}
          {issueStr}.
        </p>
      </div>
    );
  }

  // Group messages by sessionId
  const sessions = new Map<string, typeof messages>();
  for (const msg of messages) {
    const sid = msg.sessionId;
    if (!sessions.has(sid)) sessions.set(sid, []);
    sessions.get(sid)!.push(msg);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{messages.length} log entries</span>
        <span>across {sessions.size} session{sessions.size !== 1 ? "s" : ""}</span>
      </div>

      {Array.from(sessions.entries()).map(([sid, msgs]) => {
        const isSubagent = sid.includes("subagent:");
        const shortId = isSubagent
          ? "sub:" + sid.split(":").pop()?.slice(0, 8)
          : sid.length > 20
          ? sid.slice(0, 20) + "..."
          : sid;

        return (
          <div key={sid} className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono border-b pb-1">
              {isSubagent && (
                <Badge
                  variant="outline"
                  className="text-[8px] h-3.5 px-1 text-yellow-400 border-yellow-400/30"
                >
                  SUB-AGENT
                </Badge>
              )}
              <span className="text-muted-foreground">{shortId}</span>
              <span className="text-muted-foreground ml-auto">
                {msgs.length} msgs
              </span>
            </div>

            <div className="space-y-1 font-mono text-sm">
              {msgs.map((msg) => {
                const config = roleConfig[msg.role] || roleConfig.system;
                const ts =
                  typeof msg.timestamp === "string"
                    ? new Date(msg.timestamp)
                    : msg.timestamp;
                const timeStr =
                  ts instanceof Date && !isNaN(ts.getTime())
                    ? ts.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })
                    : "";

                const isError =
                  msg.role === "tool_result" &&
                  (msg.content?.startsWith("ERROR:") ||
                    (msg.metadata as Record<string, unknown>)?.error);

                return (
                  <div
                    key={msg.id}
                    className={`border rounded-md px-3 py-1.5 ${
                      isError
                        ? "bg-red-500/10 border-red-500/30"
                        : config.bgColor
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`font-bold text-[11px] ${
                          isError ? "text-red-400" : config.color
                        }`}
                      >
                        {isError ? "!!" : config.icon}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] h-3.5 px-1"
                      >
                        {config.label}
                      </Badge>
                      {msg.toolName && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] h-3.5 px-1"
                        >
                          {msg.toolName}
                        </Badge>
                      )}
                      {msg.durationMs != null && msg.durationMs > 0 && (
                        <span className="text-[9px] text-muted-foreground">
                          {msg.durationMs > 1000
                            ? `${(msg.durationMs / 1000).toFixed(1)}s`
                            : `${msg.durationMs}ms`}
                        </span>
                      )}
                      <span className="text-[9px] text-muted-foreground ml-auto">
                        {timeStr}
                      </span>
                    </div>
                    <LogContent content={msg.content} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
