const DASHBOARD_URL = "https://dashboard-plum-one-37.vercel.app";
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

async function postWithRetry(
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
      await new Promise((r) => setTimeout(r, 5_000));
    }
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
  durationMs?: number;
  runId?: string;
  toolCallId?: string;
  error?: string;
}) => {
  const apiKey = process.env.CLAW_API_KEY;
  if (!apiKey) {
    console.warn("[dashboard-reporter] CLAW_API_KEY not set, skipping");
    return;
  }

  try {
    // After a tool call: accumulate metrics
    if (event.type === "after_tool_call" || event.action === "after_tool_call") {
      toolCallCount++;
      if (event.durationMs) {
        accumulatedDurationMs += event.durationMs;
      }
      // Estimate tokens from params if available
      const params = event.params || {};
      if (typeof params === "object") {
        const paramStr = JSON.stringify(params);
        // Rough estimate: ~4 chars per token
        accumulatedInputTokens += Math.ceil(paramStr.length / 4);
        accumulatedOutputTokens += Math.ceil(paramStr.length / 8);
      }
      return;
    }

    // On agent_end: flush accumulated metrics
    if (event.type === "agent_end" || event.action === "agent_end") {
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Send heartbeat
      await postWithRetry(
        "/api/ingest/heartbeat",
        {
          agent_id: AGENT_ID,
          github_username: GITHUB_USERNAME,
          status: event.error ? "degraded" : "alive",
          currentTask: null,
          uptimeSeconds,
          metadata: {
            session_key: event.sessionKey || "unknown",
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

        await postWithRetry(
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
      await postWithRetry(
        "/api/ingest/logs",
        {
          entries: [
            {
              level: event.error ? "error" : "info",
              source: "hook:dashboard-reporter",
              message: event.error
                ? `Agent run ended with error: ${event.error}`
                : `Agent run completed (${toolCallCount} tool calls, ${uptimeSeconds}s)`,
              timestamp: event.timestamp.toISOString(),
              metadata: {
                event: "agent_end",
                agent_id: AGENT_ID,
                session_key: event.sessionKey || "unknown",
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
