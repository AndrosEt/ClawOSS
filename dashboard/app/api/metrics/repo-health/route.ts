export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews, subagentRuns } from "@/lib/schema";
import { sql, gte, eq, and } from "drizzle-orm";
import { subDays } from "date-fns";

/**
 * GET /api/metrics/repo-health?range=90d
 *
 * Returns per-repo health scores including:
 * - Responsiveness: has the repo reviewed any of our PRs?
 * - Merge velocity: avg days from PR submission to merge
 * - Time to first review
 * - Engagement level: responsive / slow / dead
 * - Follow-up stats per repo
 */
export async function GET(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "90d";
    const days = parseInt(range) || 90;
    const since = subDays(new Date(), days);

    // Per-repo PR stats
    const repoStats = await db
      .select({
        repo: pullRequests.repo,
        total: sql<number>`count(*)`,
        merged: sql<number>`sum(case when ${pullRequests.status} = 'merged' then 1 else 0 end)`,
        closed: sql<number>`sum(case when ${pullRequests.status} = 'closed' then 1 else 0 end)`,
        open: sql<number>`sum(case when ${pullRequests.status} = 'open' then 1 else 0 end)`,
        avgQuality: sql<number>`round(avg(${pullRequests.qualityScore}), 1)`,
        reviewed: sql<number>`sum(case when ${pullRequests.reviewCount} > 0 then 1 else 0 end)`,
      })
      .from(pullRequests)
      .where(gte(pullRequests.createdAt, since))
      .groupBy(pullRequests.repo);

    // Get merge velocity: avg time from creation to merge (in days)
    const mergeVelocity = await db
      .select({
        repo: pullRequests.repo,
        avgMergeDays: sql<number>`round(avg(
          (${pullRequests.mergedAt} - ${pullRequests.createdAt}) / 86400.0
        ), 1)`,
        minMergeDays: sql<number>`round(min(
          (${pullRequests.mergedAt} - ${pullRequests.createdAt}) / 86400.0
        ), 1)`,
        maxMergeDays: sql<number>`round(max(
          (${pullRequests.mergedAt} - ${pullRequests.createdAt}) / 86400.0
        ), 1)`,
      })
      .from(pullRequests)
      .where(
        and(
          gte(pullRequests.createdAt, since),
          eq(pullRequests.status, "merged")
        )
      )
      .groupBy(pullRequests.repo);

    const velocityMap = new Map(mergeVelocity.map((v) => [v.repo, v]));

    // Get time to first review per repo
    // We need to join PRs with their earliest review
    const firstReviewTimes = await db
      .select({
        repo: pullRequests.repo,
        avgFirstReviewDays: sql<number>`round(avg(
          (min_review.first_review_at - ${pullRequests.createdAt}) / 86400.0
        ), 1)`,
      })
      .from(pullRequests)
      .innerJoin(
        sql`(
          SELECT pr_id, MIN(submitted_at) as first_review_at
          FROM pr_reviews
          GROUP BY pr_id
        ) as min_review`,
        sql`min_review.pr_id = ${pullRequests.id}`
      )
      .where(gte(pullRequests.createdAt, since))
      .groupBy(pullRequests.repo);

    const firstReviewMap = new Map(
      firstReviewTimes.map((r) => [r.repo, r.avgFirstReviewDays])
    );

    // Follow-up stats per repo
    let followUpMap = new Map<
      string,
      { total: number; successes: number; active: number }
    >();
    try {
      const fuStats = await db
        .select({
          repo: subagentRuns.repo,
          total: sql<number>`count(*)`,
          successes: sql<number>`sum(case when ${subagentRuns.outcome} = 'success' then 1 else 0 end)`,
          active: sql<number>`sum(case when ${subagentRuns.outcome} = 'in_progress' then 1 else 0 end)`,
        })
        .from(subagentRuns)
        .where(
          and(
            gte(subagentRuns.startedAt, since),
            eq(subagentRuns.type, "followup")
          )
        )
        .groupBy(subagentRuns.repo);

      followUpMap = new Map(
        fuStats.map((f) => [
          f.repo,
          {
            total: f.total ?? 0,
            successes: f.successes ?? 0,
            active: f.active ?? 0,
          },
        ])
      );
    } catch {
      // Table might not exist
    }

    // Build repo health objects
    const repos = repoStats.map((r) => {
      const merged = r.merged ?? 0;
      const total = r.total ?? 0;
      const reviewed = r.reviewed ?? 0;
      const closedCount = r.closed ?? 0;
      const openCount = r.open ?? 0;
      const mergeRate =
        total > 0 ? Math.round((merged / total) * 1000) / 10 : 0;
      const reviewRate =
        total > 0 ? Math.round((reviewed / total) * 1000) / 10 : 0;

      const velocity = velocityMap.get(r.repo);
      const avgFirstReview = firstReviewMap.get(r.repo);
      const followUps = followUpMap.get(r.repo);

      // Compute engagement level
      let engagement: "responsive" | "slow" | "dead" = "dead";
      if (reviewed > 0) {
        const avgReviewDays = avgFirstReview ?? 999;
        if (avgReviewDays <= 3) engagement = "responsive";
        else if (avgReviewDays <= 14) engagement = "slow";
        else engagement = "dead";
      } else if (total <= 1) {
        engagement = "slow"; // Too few data points
      }

      // Health score: 0-100 composite
      let healthScore = 0;
      // Merge rate contributes 40%
      healthScore += Math.min(mergeRate, 100) * 0.4;
      // Review rate contributes 30%
      healthScore += Math.min(reviewRate, 100) * 0.3;
      // Speed of review contributes 20% (inverse: faster = higher)
      if (avgFirstReview != null && avgFirstReview > 0) {
        healthScore += Math.max(0, 100 - avgFirstReview * 10) * 0.2;
      }
      // Quality contributes 10%
      healthScore += Math.min(r.avgQuality ?? 0, 100) * 0.1;
      healthScore = Math.round(healthScore);

      return {
        repo: r.repo,
        healthScore,
        engagement,
        prs: {
          total,
          merged,
          closed: closedCount,
          open: openCount,
          reviewed,
          mergeRate,
          reviewRate,
          avgQuality: r.avgQuality ?? 0,
        },
        velocity: velocity
          ? {
              avgDays: velocity.avgMergeDays ?? 0,
              minDays: velocity.minMergeDays ?? 0,
              maxDays: velocity.maxMergeDays ?? 0,
            }
          : null,
        timeToFirstReview: avgFirstReview ?? null,
        followUps: followUps ?? { total: 0, successes: 0, active: 0 },
      };
    });

    // Sort by health score descending
    repos.sort((a, b) => b.healthScore - a.healthScore);

    return NextResponse.json({ repos, range: `${days}d` });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch repo health", details: String(error) },
      { status: 500 }
    );
  }
}
