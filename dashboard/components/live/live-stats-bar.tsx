"use client";

import { useMemo } from "react";
import { formatTokens } from "@/lib/utils";
import type { ConversationMessage } from "@/lib/types";

// Minimax M2.5 pricing
const INPUT_COST_PER_TOKEN = 0.25 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 1.2 / 1_000_000;

interface LiveStatsBarProps {
  messages: ConversationMessage[];
  isConnected: boolean;
}

export function LiveStatsBar({ messages, isConnected }: LiveStatsBarProps) {
  const stats = useMemo(() => {
    const totalMessages = messages.length;
    const assistantMsgs = messages.filter((m) => m.role === "assistant").length;
    const toolCalls = messages.filter((m) => m.role === "tool_call").length;
    const toolResults = messages.filter((m) => m.role === "tool_result").length;
    const thinkingMsgs = messages.filter((m) => m.role === "thinking").length;
    const totalTokens = messages.reduce((sum, m) => sum + (m.tokenCount || 0), 0);
    const totalDuration = messages.reduce((sum, m) => sum + (m.durationMs || 0), 0);
    const sessions = new Set(messages.map((m) => m.sessionId)).size;
    const errors = messages.filter(
      (m) => m.role === "tool_result" && (m.content?.startsWith("ERROR:") || (m.metadata as Record<string, unknown>)?.error)
    ).length;

    // Estimate cost (rough: assume 60% input, 40% output split on tokens)
    const inputTokens = Math.round(totalTokens * 0.6);
    const outputTokens = totalTokens - inputTokens;
    const estimatedCost = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;

    // Calculate messages per minute
    let msgsPerMin = 0;
    if (totalMessages >= 2) {
      const timestamps = messages.map((m) => {
        const ts = typeof m.timestamp === "string" ? new Date(m.timestamp) : m.timestamp;
        return ts.getTime();
      }).filter((t) => !isNaN(t));
      if (timestamps.length >= 2) {
        const span = Math.max(timestamps[timestamps.length - 1] - timestamps[0], 1);
        msgsPerMin = (totalMessages / (span / 60000));
      }
    }

    // Token burn rate (tokens per minute)
    let tokenBurnRate = 0;
    if (totalTokens > 0 && messages.length >= 2) {
      const timestamps = messages.map((m) => {
        const ts = typeof m.timestamp === "string" ? new Date(m.timestamp) : m.timestamp;
        return ts.getTime();
      }).filter((t) => !isNaN(t));
      if (timestamps.length >= 2) {
        const span = Math.max(timestamps[timestamps.length - 1] - timestamps[0], 1);
        tokenBurnRate = totalTokens / (span / 60000);
      }
    }

    return {
      totalMessages,
      assistantMsgs,
      toolCalls,
      toolResults,
      thinkingMsgs,
      totalTokens,
      totalDuration,
      sessions,
      errors,
      estimatedCost,
      msgsPerMin,
      tokenBurnRate,
    };
  }, [messages]);

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30 text-xs font-mono overflow-x-auto">
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            isConnected ? "bg-green-500 animate-pulse" : "bg-gray-500"
          }`}
        />
        <span className="text-muted-foreground">
          {isConnected ? "Live" : "Idle"}
        </span>
      </div>
      <span className="text-muted-foreground">|</span>
      <span>
        <span className="text-muted-foreground">msgs:</span> {stats.totalMessages}
      </span>
      <span>
        <span className="text-muted-foreground">turns:</span> {stats.assistantMsgs}
      </span>
      <span>
        <span className="text-muted-foreground">tools:</span> {stats.toolCalls}
      </span>
      {stats.errors > 0 && (
        <span className="text-red-400">
          <span className="text-red-400/60">errs:</span> {stats.errors}
        </span>
      )}
      {stats.totalTokens > 0 && (
        <>
          <span className="text-muted-foreground">|</span>
          <span>
            <span className="text-muted-foreground">tokens:</span>{" "}
            {formatTokens(stats.totalTokens)}
          </span>
          <span>
            <span className="text-muted-foreground">burn:</span>{" "}
            {formatTokens(Math.round(stats.tokenBurnRate))}/min
          </span>
          <span>
            <span className="text-muted-foreground">cost:</span>{" "}
            ${stats.estimatedCost.toFixed(4)}
          </span>
        </>
      )}
      {stats.totalDuration > 0 && (
        <span>
          <span className="text-muted-foreground">tool-time:</span>{" "}
          {(stats.totalDuration / 1000).toFixed(1)}s
        </span>
      )}
      {stats.msgsPerMin > 0 && (
        <span>
          <span className="text-muted-foreground">rate:</span>{" "}
          {stats.msgsPerMin.toFixed(1)}/min
        </span>
      )}
      <span>
        <span className="text-muted-foreground">sessions:</span> {stats.sessions}
      </span>
    </div>
  );
}
