const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://clawoss-dashboard.vercel.app";
const AGENT_ID = "clawoss";
const GITHUB_USERNAME = "BillionClaw";
// Kimi K2.5 pricing: $0.45/M input, $2.20/M output
const INPUT_COST_PER_TOKEN = 0.45 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 2.2 / 1_000_000;

let accumulatedInputTokens = 0;
let accumulatedOutputTokens = 0;
let accumulatedDurationMs = 0;
let toolCallCount = 0;
let startTime = Date.now();
let lastSkillName: string | null = null;
let lastRepoName: string | null = null;
let lastIssueName: string | null = null;
const reposUsed = new Set<string>();

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

// Post agent state snapshot (work queue, pipeline, repos, skill)
async function postState(apiKey: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    // Try to read work queue and pipeline state from workspace memory files
    let workQueue: unknown[] = [];
    let pipelineState: Record<string, unknown> = {};

    try {
      const fs = await import("fs");
      const wqPath = `${process.cwd()}/workspace/memory/work-queue.md`;
      const psPath = `${process.cwd()}/workspace/memory/pipeline-state.md`;

      // Parse work queue markdown table
      try {
        const wqContent = fs.readFileSync(wqPath, "utf-8");
        const lines = wqContent.split("\n").filter(
          (l: string) =>
            l.includes("|") &&
            !l.startsWith("priority") &&
            !l.startsWith("--") &&
            !l.startsWith("#") &&
            !l.startsWith("<!--")
        );
        workQueue = lines
          .map((line: string) => {
            const parts = line.split("|").map((p: string) => p.trim());
            return {
              priority: parts[0] || "MEDIUM",
              repo: parts[1] || "",
              issue: parts[2] || "",
              title: parts[3] || "",
              solvabilityScore: parseInt(parts[4]) || 0,
              discovered: parts[5] || "",
            };
          })
          .filter((item: { repo: string }) => item.repo);
      } catch {
        // File may not exist yet
      }

      // Parse pipeline state
      try {
        const psContent = fs.readFileSync(psPath, "utf-8");
        const statsMatch = psContent.match(/submitted:\s*(\d+)/);
        const mergedMatch = psContent.match(/merged:\s*(\d+)/);
        const rejectedMatch = psContent.match(/rejected:\s*(\d+)/);
        const abandonedMatch = psContent.match(/abandoned:\s*(\d+)/);
        pipelineState = {
          activePRs: [],
          statsToday: {
            submitted: statsMatch ? parseInt(statsMatch[1]) : 0,
            merged: mergedMatch ? parseInt(mergedMatch[1]) : 0,
            rejected: rejectedMatch ? parseInt(rejectedMatch[1]) : 0,
            abandoned: abandonedMatch ? parseInt(abandonedMatch[1]) : 0,
          },
        };
      } catch {
        // File may not exist yet
      }
    } catch {
      // fs import may fail in some environments
    }

    await fetch(`${DASHBOARD_URL}/api/ingest/state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        currentSkill: lastSkillName,
        currentRepo: lastRepoName,
        currentIssue: lastIssueName,
        workQueue,
        pipelineState,
        activeRepos: Array.from(reposUsed),
        metadata: {
          agent_id: AGENT_ID,
          tool_calls: toolCallCount,
          model: "moonshotai/kimi-k2.5",
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch {
    // Silently ignore state posting failures
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
  skillName?: string;
}) => {
  const apiKey = process.env.CLAW_API_KEY;
  if (!apiKey) {
    console.warn("[dashboard-reporter] CLAW_API_KEY not set, skipping");
    return;
  }

  const sessionId = event.sessionKey || event.runId || "main";
  const ts = event.timestamp?.toISOString() || new Date().toISOString();

  try {
    // Track skill name if provided
    if (event.skillName) {
      lastSkillName = event.skillName;
    }

    // Stream user messages to conversation feed
    if (event.type === "user_message" || event.action === "user_message") {
      if (event.userMessage) {
        await postConversation(
          {
            messages: [
              {
                sessionId,
                role: "user",
                content: event.userMessage.slice(0, 5000),
                timestamp: ts,
                metadata: { agent_id: AGENT_ID },
              },
            ],
          },
          apiKey
        );
      }
      return;
    }

    // After a tool call: accumulate metrics + stream tool call to conversation feed
    if (
      event.type === "after_tool_call" ||
      event.action === "after_tool_call"
    ) {
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

      // Track repos from tool params
      const paramStr = JSON.stringify(params);
      const repoMatch = paramStr.match(
        /(?:repos?|repository)['":\s]+([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/i
      );
      if (repoMatch) {
        reposUsed.add(repoMatch[1]);
        lastRepoName = repoMatch[1];
      }

      // Track issue numbers
      const issueMatch = paramStr.match(/#(\d+)/);
      if (issueMatch) {
        lastIssueName = `#${issueMatch[1]}`;
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
          metadata: { agent_id: AGENT_ID, skill: lastSkillName },
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

    // On agent_end: flush accumulated metrics + stream completion + post state
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
          metadata: {
            agent_id: AGENT_ID,
            event: "agent_end",
            skill: lastSkillName,
          },
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
          repos: Array.from(reposUsed),
          skill: lastSkillName,
        },
      });

      if (convMessages.length > 0) {
        await postConversation({ messages: convMessages }, apiKey);
      }

      // Post agent state snapshot (work queue, pipeline, repos, skill)
      await postState(apiKey);

      // Send heartbeat with enriched metadata
      await postNonBlocking(
        "/api/ingest/heartbeat",
        {
          agent_id: AGENT_ID,
          github_username: GITHUB_USERNAME,
          status: event.error ? "degraded" : "alive",
          currentTask: lastSkillName || null,
          uptimeSeconds,
          metadata: {
            session_key: sessionId,
            tool_calls: toolCallCount,
            model: "moonshotai/kimi-k2.5",
            repos: Array.from(reposUsed),
            skill: lastSkillName,
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
                model: "moonshotai/kimi-k2.5",
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

      // Log agent completion with enriched metadata
      await postNonBlocking(
        "/api/ingest/logs",
        {
          entries: [
            {
              level: event.error ? "error" : "info",
              source: "hook:dashboard-reporter",
              message: event.error
                ? `Agent run ended with error: ${event.error}`
                : `Agent run completed (${toolCallCount} tool calls, ${uptimeSeconds}s, repos: ${Array.from(reposUsed).join(", ") || "none"})`,
              timestamp: ts,
              metadata: {
                event: "agent_end",
                agent_id: AGENT_ID,
                session_key: sessionId,
                run_id: event.runId || null,
                repos: Array.from(reposUsed),
                skill: lastSkillName,
              },
            },
          ],
        },
        apiKey
      );

      // Reset state tracking for next run
      lastSkillName = null;
      lastRepoName = null;
      lastIssueName = null;
      reposUsed.clear();
    }
  } catch (err) {
    // Never let telemetry errors disrupt agent work
    console.error("[dashboard-reporter] Unhandled error:", err);
  }
};

export default handler;
