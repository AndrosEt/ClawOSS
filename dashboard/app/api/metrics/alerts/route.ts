export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews, autonomySnapshots } from "@/lib/schema";
import { eq, sql, desc, gte } from "drizzle-orm";

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  metric: string;
  value: number | string;
  threshold: number | string | null;
  timestamp: string;
}

/**
 * GET /api/metrics/alerts
 *
 * Computes real-time alerts based on dashboard metrics.
 * These surface problems that need immediate prompt/config changes.
 */
export async function GET() {
  try {
    await ensureDb();
    const alerts: Alert[] = [];
    const now = new Date();

    // 1. Merge rate check
    const [totalResult, mergedResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(pullRequests),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "merged")),
    ]);
    const totalPRs = totalResult[0]?.count || 0;
    const mergedPRs = mergedResult[0]?.count || 0;
    const mergeRate = totalPRs > 0 ? (mergedPRs / totalPRs) * 100 : 0;

    if (totalPRs >= 10 && mergeRate < 5) {
      alerts.push({
        id: "low-merge-rate",
        severity: "critical",
        title: "Merge rate critically low",
        detail: `${mergeRate.toFixed(1)}% merge rate across ${totalPRs} PRs. AI benchmark is 32.7%. Check targeting strategy and PR quality.`,
        metric: "merge_rate",
        value: mergeRate.toFixed(1),
        threshold: "5%",
        timestamp: now.toISOString(),
      });
    } else if (totalPRs >= 10 && mergeRate < 20) {
      alerts.push({
        id: "low-merge-rate",
        severity: "warning",
        title: "Merge rate below benchmark",
        detail: `${mergeRate.toFixed(1)}% merge rate vs 32.7% AI benchmark.`,
        metric: "merge_rate",
        value: mergeRate.toFixed(1),
        threshold: "32.7%",
        timestamp: now.toISOString(),
      });
    }

    // 2. Review rate check
    const reviewedResult = await db
      .select({ count: sql<number>`count(DISTINCT ${prReviews.prId})` })
      .from(prReviews);
    const reviewed = reviewedResult[0]?.count || 0;
    const reviewRate = totalPRs > 0 ? (reviewed / totalPRs) * 100 : 0;

    if (totalPRs >= 10 && reviewRate < 20) {
      alerts.push({
        id: "low-review-rate",
        severity: "critical",
        title: "Most PRs are being ignored",
        detail: `Only ${reviewRate.toFixed(0)}% of PRs received any review. ${totalPRs - reviewed} PRs have zero engagement.`,
        metric: "review_rate",
        value: reviewRate.toFixed(0),
        threshold: "20%",
        timestamp: now.toISOString(),
      });
    }

    // 3. Duplicate detection
    const repoCounts = await db
      .select({
        repo: pullRequests.repo,
        count: sql<number>`count(*)`,
      })
      .from(pullRequests)
      .groupBy(pullRequests.repo);

    const multiPrRepos = repoCounts.filter((r) => r.count >= 3);
    if (multiPrRepos.length >= 3) {
      alerts.push({
        id: "duplicate-spam",
        severity: "warning",
        title: "Possible PR spam detected",
        detail: `${multiPrRepos.length} repos have 3+ PRs. Top: ${multiPrRepos
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((r) => `${r.repo} (${r.count})`)
          .join(", ")}`,
        metric: "duplicate_repos",
        value: multiPrRepos.length,
        threshold: "3",
        timestamp: now.toISOString(),
      });
    }

    // 4. Autonomy score trend (if snapshots exist)
    try {
      const recentSnapshots = await db
        .select({
          score: autonomySnapshots.score,
          timestamp: autonomySnapshots.timestamp,
        })
        .from(autonomySnapshots)
        .orderBy(desc(autonomySnapshots.timestamp))
        .limit(5);

      if (recentSnapshots.length >= 2) {
        const latest = recentSnapshots[0].score;
        const previous = recentSnapshots[1].score;
        if (latest < previous - 10) {
          alerts.push({
            id: "autonomy-drop",
            severity: "warning",
            title: "Autonomy score dropped",
            detail: `Score fell from ${previous} to ${latest} (-${previous - latest} points).`,
            metric: "autonomy_score",
            value: latest,
            threshold: previous.toString(),
            timestamp: now.toISOString(),
          });
        }
        if (latest === 0) {
          alerts.push({
            id: "autonomy-zero",
            severity: "critical",
            title: "Autonomy score is zero",
            detail: "All penalty categories are maxed out. Prompt improvements needed urgently.",
            metric: "autonomy_score",
            value: 0,
            threshold: ">0",
            timestamp: now.toISOString(),
          });
        }
      }
    } catch {
      // snapshots table may not exist yet
    }

    // 5. Daily volume check
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayPRs = await db
      .select({ count: sql<number>`count(*)` })
      .from(pullRequests)
      .where(gte(pullRequests.createdAt, todayStart));
    const todayCount = todayPRs[0]?.count || 0;

    if (todayCount > 30) {
      alerts.push({
        id: "high-volume",
        severity: "info",
        title: "High PR volume today",
        detail: `${todayCount} PRs submitted today. Ensure quality checks (linter, tests, size limits) are running for each submission.`,
        metric: "daily_prs",
        value: todayCount,
        threshold: "30",
        timestamp: now.toISOString(),
      });
    }

    // 6. All PRs closed (zero success) — most severe
    if (totalPRs >= 20 && mergedPRs === 0) {
      alerts.push({
        id: "zero-merges",
        severity: "critical",
        title: "No PRs have been merged",
        detail: `0 out of ${totalPRs} PRs merged. The current strategy is not working. Major changes needed.`,
        metric: "merged_prs",
        value: 0,
        threshold: ">0",
        timestamp: now.toISOString(),
      });
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return NextResponse.json({
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter((a) => a.severity === "critical").length,
        warning: alerts.filter((a) => a.severity === "warning").length,
        info: alerts.filter((a) => a.severity === "info").length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to compute alerts", details: String(error) },
      { status: 500 }
    );
  }
}
