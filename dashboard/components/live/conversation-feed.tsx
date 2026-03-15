"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { RawJsonToggle } from "./raw-json-toggle";
import type { ConversationMessage } from "@/lib/types";

interface ConversationFeedProps {
  messages: ConversationMessage[];
  autoScroll?: boolean;
  showRawJson?: boolean;
}

const roleConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: string; accent: string }
> = {
  assistant: {
    label: "Agent",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    icon: ">>",
    accent: "msg-accent-blue",
  },
  user: {
    label: "Prompt",
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/20",
    icon: "$",
    accent: "msg-accent-green",
  },
  tool_call: {
    label: "Tool",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10 border-yellow-500/20",
    icon: "->",
    accent: "msg-accent-yellow",
  },
  tool_result: {
    label: "Result",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    icon: "<-",
    accent: "msg-accent-purple",
  },
  system: {
    label: "System",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10 border-gray-500/20",
    icon: "#",
    accent: "msg-accent",
  },
  thinking: {
    label: "Think",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/20",
    icon: "~",
    accent: "msg-accent-orange",
  },
};

const MAX_COLLAPSED_LINES = 12;

function MessageContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split("\n");
  const isTruncatable = lines.length > MAX_COLLAPSED_LINES;

  const displayContent = expanded
    ? content
    : isTruncatable
    ? lines.slice(0, MAX_COLLAPSED_LINES).join("\n")
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
            : `[ +${lines.length - MAX_COLLAPSED_LINES} more lines ]`}
        </button>
      )}
    </div>
  );
}

export function ConversationFeed({
  messages,
  autoScroll = true,
  showRawJson = false,
}: ConversationFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (autoScroll && !isPaused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, autoScroll, isPaused]);

  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => setIsPaused(false), []);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-sm">
        <div className="text-center space-y-2">
          <p>Waiting for agent conversation data...</p>
          <p className="text-xs">
            Messages will appear here as the agent works
          </p>
          <div className="animate-pulse mt-4">
            <span className="text-green-400">$</span>{" "}
            <span className="text-muted-foreground">_</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-1 font-mono text-sm overflow-y-auto h-full smooth-scroll"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isPaused && (
        <div className="sticky top-0 z-10 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-0.5 text-[10px] text-yellow-400 text-center">
          Auto-scroll paused (hover)
        </div>
      )}
      {messages.map((msg) => {
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
            !!(msg.metadata as Record<string, unknown>)?.error);

        const isSlow = (msg.durationMs || 0) > 5000;

        // Detect PII-sanitized content
        const hasSanitized =
          msg.content?.includes("\uFF20") ||
          msg.content?.includes("[REDACTED_EMAIL]") ||
          msg.content?.includes("[REDACTED_PHONE]") ||
          msg.content?.includes("[REDACTED_IP]");

        return (
          <div
            key={msg.id}
            className={`border rounded-md px-3 py-2 ${config.accent} transition-colors ${
              isError
                ? "bg-red-500/10 border-red-500/30 msg-accent-red"
                : isSlow && msg.role === "tool_call"
                ? "bg-yellow-500/5 border-yellow-500/20"
                : config.bgColor
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`font-bold ${
                  isError
                    ? "text-red-400"
                    : isSlow && msg.role === "tool_call"
                    ? "text-yellow-400"
                    : config.color
                }`}
              >
                {isError ? "!!" : config.icon}
              </span>
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {config.label}
              </Badge>
              {msg.toolName && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                  {msg.toolName}
                </Badge>
              )}
              {msg.durationMs != null && msg.durationMs > 0 && (
                <span
                  className={`text-[10px] ${
                    msg.durationMs > 10000
                      ? "text-red-400"
                      : msg.durationMs > 5000
                      ? "text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {msg.durationMs > 1000
                    ? `${(msg.durationMs / 1000).toFixed(1)}s`
                    : `${msg.durationMs}ms`}
                </span>
              )}
              {msg.tokenCount != null && msg.tokenCount > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {msg.tokenCount.toLocaleString()} tok
                </span>
              )}
              {!!(msg.metadata as Record<string, unknown>)?.isSubagent && (
                <Badge
                  variant="outline"
                  className="text-[8px] h-3 px-1 text-yellow-400 border-yellow-400/30"
                >
                  SUB
                </Badge>
              )}
              {!!(msg.metadata as Record<string, unknown>)?.label && (
                <span className="text-[9px] text-yellow-400/80 font-mono">
                  {String((msg.metadata as Record<string, unknown>).label)}
                </span>
              )}
              {!!(msg.metadata as Record<string, unknown>)?.repo && (
                <span className="text-[9px] text-cyan-400 font-mono">
                  {String((msg.metadata as Record<string, unknown>).repo)}
                  {(msg.metadata as Record<string, unknown>).issue
                    ? String((msg.metadata as Record<string, unknown>).issue)
                    : ""}
                </span>
              )}
              {msg.sessionId && (
                <span className="text-[10px] text-muted-foreground/50 font-mono">
                  {msg.sessionId.length > 12
                    ? msg.sessionId.slice(0, 8) + ".."
                    : msg.sessionId}
                </span>
              )}
              {hasSanitized && (
                <Badge
                  variant="outline"
                  className="text-[7px] h-3 px-1 text-green-400/60 border-green-400/20"
                  title="Content was sanitized by PII filter to prevent 403 errors"
                >
                  PII
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground ml-auto">
                {timeStr}
              </span>
            </div>
            <MessageContent content={msg.content} />
            {showRawJson && <RawJsonToggle message={msg} />}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
