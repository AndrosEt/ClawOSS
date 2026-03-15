const DASHBOARD_URL = "https://clawoss-dashboard.vercel.app";
const AGENT_ID = "clawoss";
const GITHUB_USERNAME = "BillionClaw";
// Minimax M2.5 pricing: $0.25/M input, $1.20/M output
const INPUT_COST_PER_TOKEN = 0.25 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 1.2 / 1_000_000;

let accumulatedInputTokens = 0;
let accumulatedOutputTokens = 0;
let accumulatedDurationMs = 0;
let toolCallCount = 0;
let startTime = Date.now();

async function postNonBlocking(
  path: string,
  body: Record<string, unknown>,
  apiKey: string
): Promise<void> {
  const url = `${DASHBOARD_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) return;
      console.error(
        `[dashboard-reporter] POST ${path} returned ${res.status}`
      );
    } catch (err) {
      console.error(
        `[dashboard-reporter] POST ${path} failed (attempt ${attempt + 1}):`,
        err
      );
    }

    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }
}

// Fire-and-forget conversation message — no retry, short timeout
async function postConversation(
  body: Record<string, unknown>,
  apiKey: string
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    await fetch(`${DASHBOARD_URL}/api/ingest/conversation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch {
    // Silently ignore — conversation logs are supplementary
  }
}

const handler = async (event: {
  type: string;
  action: string;
  sessionKey?: string;
  timestamp: Date;
  messages: string[];
  toolName?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  durationMs?: number;
  runId?: string;
  toolCallId?: string;
  error?: string;
  assistantMessage?: string;
  userMessage?: string;
}) => {
  const apiKey = process.env.CLAW_API_KEY;
  if (!apiKey) {
    console.warn("[dashboard-reporter] CLAW_API_KEY not set, skipping");
    return;
  }

  const sessionId = event.sessionKey || event.runId || "main";
  const ts = event.timestamp?.toISOString() || new Date().toISOString();

  try {
    // After a tool call: accumulate metrics + stream tool call to conversation feed
    if (event.type === "after_tool_call" || event.action === "after_tool_call") {
      toolCallCount++;
      if (event.durationMs) {
        accumulatedDurationMs += event.durationMs;
      }

      const params = event.params || {};
      if (typeof params === "object") {
        const paramStr = JSON.stringify(params);
        accumulatedInputTokens += Math.ceil(paramStr.length / 4);
        accumulatedOutputTokens += Math.ceil(paramStr.length / 8);
      }

      // Stream tool call to live conversation feed
      const toolName = event.toolName || "unknown";
      const paramsSummary = params
        ? JSON.stringify(params, null, 2).slice(0, 2000)
        : "";

      const messages: Record<string, unknown>[] = [
        {
          sessionId,
          role: "tool_call",
          content: paramsSummary || `(no params)`,
          toolName,
          toolCallId: event.toolCallId || null,
          durationMs: event.durationMs || null,
          timestamp: ts,
          metadata: { agent_id: AGENT_ID },
        },
      ];

      // Include tool result if available
      const resultStr = event.result
        ? typeof event.result === "string"
          ? event.result.slice(0, 3000)
          : JSON.stringify(event.result, null, 2).slice(0, 3000)
        : null;

      if (resultStr) {
        messages.push({
          sessionId,
          role: "tool_result",
          content: resultStr,
          toolName,
          toolCallId: event.toolCallId || null,
          durationMs: event.durationMs || null,
          timestamp: ts,
          metadata: { agent_id: AGENT_ID },
        });
      }

      // If there was an error from the tool call
      if (event.error) {
        messages.push({
          sessionId,
          role: "tool_result",
          content: `ERROR: ${event.error}`,
          toolName,
          toolCallId: event.toolCallId || null,
          timestamp: ts,
          metadata: { agent_id: AGENT_ID, error: true },
        });
      }

      await postConversation({ messages }, apiKey);
      return;
    }

    // On agent_end: flush accumulated metrics + stream completion to conversation
    if (event.type === "agent_end" || event.action === "agent_end") {
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Stream the last assistant message and any conversation messages
      const convMessages: Record<string, unknown>[] = [];

      // If we have the assistant's final message, send it
      if (event.assistantMessage) {
        convMessages.push({
          sessionId,
          role: "assistant",
          content: event.assistantMessage.slice(0, 5000),
          timestamp: ts,
          tokenCount: accumulatedOutputTokens || null,
          metadata: { agent_id: AGENT_ID, event: "agent_end" },
        });
      }

      // Send any messages array content as conversation turns
      if (event.messages && Array.isArray(event.messages)) {
        for (const msg of event.messages.slice(-10)) {
          if (typeof msg === "string" && msg.trim()) {
            convMessages.push({
              sessionId,
              role: "assistant",
              content: msg.slice(0, 5000),
              timestamp: ts,
              metadata: { agent_id: AGENT_ID, source: "messages_array" },
            });
          }
        }
      }

      // Stream a system message about the run completion
      convMessages.push({
        sessionId,
        role: "system",
        content: event.error
          ? `Run ended with error: ${event.error} (${toolCallCount} tool calls, ${uptimeSeconds}s)`
          : `Run completed: ${toolCallCount} tool calls, ${uptimeSeconds}s, ~${accumulatedInputTokens + accumulatedOutputTokens} tokens`,
        timestamp: ts,
        metadata: {
          agent_id: AGENT_ID,
          event: "agent_end",
          tool_calls: toolCallCount,
          uptime_seconds: uptimeSeconds,
          had_error: !!event.error,
        },
      });

      if (convMessages.length > 0) {
        await postConversation({ messages: convMessages }, apiKey);
      }

      // Send heartbeat
      await postNonBlocking(
        "/api/ingest/heartbeat",
        {
          agent_id: AGENT_ID,
          github_username: GITHUB_USERNAME,
          status: event.error ? "degraded" : "alive",
          currentTask: null,
          uptimeSeconds,
          metadata: {
            session_key: sessionId,
            tool_calls: toolCallCount,
            model: "minimax/MiniMax-M1-80k",
          },
        },
        apiKey
      );

      // Send accumulated metrics if any
      if (accumulatedInputTokens > 0 || accumulatedOutputTokens > 0) {
        const costUsd =
          accumulatedInputTokens * INPUT_COST_PER_TOKEN +
          accumulatedOutputTokens * OUTPUT_COST_PER_TOKEN;

        await postNonBlocking(
          "/api/ingest/metrics",
          {
            metrics: [
              {
                channel: "agent",
                provider: "openrouter",
                model: "minimax/MiniMax-M1-80k",
                inputTokens: accumulatedInputTokens,
                outputTokens: accumulatedOutputTokens,
                costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
                runDurationMs: accumulatedDurationMs,
                contextTokens: accumulatedInputTokens,
              },
            ],
          },
          apiKey
        );

        // Reset accumulators
        accumulatedInputTokens = 0;
        accumulatedOutputTokens = 0;
        accumulatedDurationMs = 0;
        toolCallCount = 0;
      }

      // Log agent completion
      await postNonBlocking(
        "/api/ingest/logs",
        {
          entries: [
            {
              level: event.error ? "error" : "info",
              source: "hook:dashboard-reporter",
              message: event.error
                ? `Agent run ended with error: ${event.error}`
                : `Agent run completed (${toolCallCount} tool calls, ${uptimeSeconds}s)`,
              timestamp: ts,
              metadata: {
                event: "agent_end",
                agent_id: AGENT_ID,
                session_key: sessionId,
                run_id: event.runId || null,
              },
            },
          ],
        },
        apiKey
      );
    }
  } catch (err) {
    // Never let telemetry errors disrupt agent work
    console.error("[dashboard-reporter] Unhandled error:", err);
  }
};

export default handler;
