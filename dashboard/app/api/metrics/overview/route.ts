export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { heartbeats, pullRequests, metricsTokens, agentLogs } from "@/lib/schema";
import { desc, gte, sql, eq } from "drizzle-orm";

export async function GET() {
  try {
    await ensureDb();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Latest heartbeat
    const latestHeartbeat = await db
      .select()
      .from(heartbeats)
      .orderBy(desc(heartbeats.timestamp))
      .limit(1);

    const hb = latestHeartbeat[0];
    const isOnline = hb
      ? hb.timestamp.getTime() > fiveMinutesAgo.getTime()
      : false;

    // Heartbeat streak
    const recentHeartbeats = await db
      .select()
      .from(heartbeats)
      .orderBy(desc(heartbeats.timestamp))
      .limit(100);

    let streak = 0;
    for (const beat of recentHeartbeats) {
      if (beat.status === "alive") streak++;
      else break;
    }

    // PR stats
    const [totalPRsResult, mergedPRsResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(pullRequests),
      db
        .select({ count: sql<number>`count(*)` })
        .from(pullRequests)
        .where(eq(pullRequests.status, "merged")),
    ]);

    const totalPRs = totalPRsResult[0]?.count || 0;
    const mergedPRs = mergedPRsResult[0]?.count || 0;
    const mergeRate = totalPRs > 0 ? Math.round((mergedPRs / totalPRs) * 1000) / 10 : 0;

    // Today's token usage and cost
    const todayMetrics = await db
      .select({
        totalInput: sql<number>`COALESCE(SUM(input_tokens), 0)`,
        totalOutput: sql<number>`COALESCE(SUM(output_tokens), 0)`,
        totalCost: sql<number>`COALESCE(SUM(cost_usd), 0)`,
      })
      .from(metricsTokens)
      .where(gte(metricsTokens.timestamp, todayStart));

    const tokensUsedToday =
      (todayMetrics[0]?.totalInput || 0) + (todayMetrics[0]?.totalOutput || 0);
    const costToday = todayMetrics[0]?.totalCost || 0;

    // Recent activity from logs
    const recentLogs = await db
      .select()
      .from(agentLogs)
      .orderBy(desc(agentLogs.timestamp))
      .limit(10);

    const recentActivity = recentLogs.map((log) => ({
      id: log.id,
      type: inferActivityType(log.message),
      description: log.message,
      timestamp: log.timestamp,
      metadata: (log.metadata as Record<string, unknown>) || {},
    }));

    // Recent PRs
    const recentPRs = await db
      .select({
        id: pullRequests.id,
        number: pullRequests.number,
        title: pullRequests.title,
        repo: pullRequests.repo,
        status: pullRequests.status,
        qualityScore: pullRequests.qualityScore,
        createdAt: pullRequests.createdAt,
      })
      .from(pullRequests)
      .orderBy(desc(pullRequests.createdAt))
      .limit(5);

    // Daily budget
    const todayPRs = await db
      .select({
        count: sql<number>`count(*)`,
        repo: pullRequests.repo,
      })
      .from(pullRequests)
      .where(gte(pullRequests.createdAt, todayStart))
      .groupBy(pullRequests.repo);

    const perRepo: Record<string, number> = {};
    let dailyPRs = 0;
    for (const row of todayPRs) {
      perRepo[row.repo] = row.count;
      dailyPRs += row.count;
    }

    // Current task from heartbeat
    let currentTask = null;
    if (hb?.currentTask) {
      try {
        currentTask =
          typeof hb.currentTask === "string"
            ? JSON.parse(hb.currentTask)
            : hb.currentTask;
      } catch {
        currentTask = { title: hb.currentTask, status: "coding", progress: 50 };
      }
    }

    return NextResponse.json({
      agentStatus: {
        isOnline,
        lastHeartbeat: hb?.timestamp || new Date(0),
        currentTask: hb?.currentTask || null,
        uptimeSeconds: hb?.uptimeSeconds || 0,
        heartbeatStreak: streak,
      },
      stats: {
        totalPRs,
        mergeRate,
        tokensUsedToday,
        costToday,
      },
      recentActivity,
      currentTask,
      recentPRs,
      dailyBudget: {
        dailyPRs,
        dailyLimit: 10,
        perRepo,
        repoLimit: 3,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch overview", details: String(error) },
      { status: 500 }
    );
  }
}

function inferActivityType(message: string): string {
  if (/merged/i.test(message)) return "pr_merged";
  if (/created|submitted|opened/i.test(message)) return "pr_created";
  if (/closed/i.test(message)) return "pr_closed";
  if (/review/i.test(message)) return "review_received";
  if (/heartbeat/i.test(message)) return "heartbeat";
  if (/error|fail/i.test(message)) return "error";
  return "task_started";
}
