export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews } from "@/lib/schema";
import { eq, sql, gte } from "drizzle-orm";

/**
 * GET /api/agent/health-check
 *
 * Lightweight health check endpoint designed for the ClawOSS agent
 * to call before each heartbeat cycle. Returns a simple JSON with:
 * - Current stats
 * - Blocked repos (avoid list)
 * - Top action items (what to fix in this cycle)
 *
 * The agent can use this to self-correct without human intervention.
 */
export async function GET() {
  try {
    await ensureDb();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Basic stats
    const [totalResult, mergedResult, openResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(pullRequests),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "merged")),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "open")),
    ]);

    const total = totalResult[0]?.count || 0;
    const merged = mergedResult[0]?.count || 0;
    const open = openResult[0]?.count || 0;

    // Today's PRs
    const todayResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pullRequests)
      .where(gte(pullRequests.createdAt, todayStart));
    const todayPRs = todayResult[0]?.count || 0;

    // Repos to avoid (3+ PRs, 0 merges)
    const repoStats = await db
      .select({
        repo: pullRequests.repo,
        total: sql<number>`count(*)`,
        merged: sql<number>`sum(case when ${pullRequests.status} = 'merged' then 1 else 0 end)`,
        open: sql<number>`sum(case when ${pullRequests.status} = 'open' then 1 else 0 end)`,
      })
      .from(pullRequests)
      .groupBy(pullRequests.repo);

    const avoidRepos = repoStats
      .filter((r) => r.total >= 2 && (r.merged ?? 0) === 0)
      .map((r) => r.repo);

    // Repos with open PRs (don't submit new ones)
    const reposWithOpenPRs = repoStats
      .filter((r) => (r.open ?? 0) > 0)
      .map((r) => r.repo);

    // Quick directives
    const directives: string[] = [];

    if (todayPRs >= 20) {
      directives.push("SLOW DOWN: Already submitted " + todayPRs + " PRs today. Quality over quantity.");
    }

    if (total > 0 && merged / total < 0.05) {
      directives.push("MERGE RATE CRITICAL: Only " + ((merged / total) * 100).toFixed(1) + "%. Submit smaller PRs (under 50 lines). Reference real issues.");
    }

    if (avoidRepos.length > 5) {
      directives.push("TOO MANY DEAD REPOS: " + avoidRepos.length + " repos with 0 merges. Focus on responsive repos only.");
    }

    if (reposWithOpenPRs.length > 10) {
      directives.push("FOLLOW UP FIRST: " + reposWithOpenPRs.length + " repos have open PRs. Follow up before submitting new ones.");
    }

    return NextResponse.json({
      healthy: directives.length === 0,
      stats: {
        total,
        merged,
        open,
        todayPRs,
        mergeRate: total > 0 ? Math.round((merged / total) * 1000) / 10 : 0,
      },
      avoidRepos,
      reposWithOpenPRs,
      directives,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { healthy: false, error: String(error) },
      { status: 500 }
    );
  }
}
