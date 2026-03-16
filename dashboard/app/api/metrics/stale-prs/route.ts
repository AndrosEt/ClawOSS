export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews } from "@/lib/schema";
import { sql, eq, and, lte } from "drizzle-orm";

/**
 * GET /api/metrics/stale-prs?days=7
 *
 * Returns open PRs that have been sitting with no human engagement
 * beyond a threshold (default 7 days). Used for the "stale PR cleanup"
 * view so we can close PRs that will never get reviewed and reduce
 * our spam footprint.
 */
export async function GET(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url);
    const staleDays = parseInt(url.searchParams.get("days") || "7") || 7;
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - staleDays * 86400 * 1000);

    // Find open PRs created before the stale threshold
    const openPRs = await db
      .select({
        id: pullRequests.id,
        repo: pullRequests.repo,
        number: pullRequests.number,
        title: pullRequests.title,
        status: pullRequests.status,
        createdAt: pullRequests.createdAt,
        additions: pullRequests.additions,
        deletions: pullRequests.deletions,
        filesChanged: pullRequests.filesChanged,
        reviewCount: pullRequests.reviewCount,
        htmlUrl: pullRequests.htmlUrl,
        qualityScore: pullRequests.qualityScore,
      })
      .from(pullRequests)
      .where(
        and(
          eq(pullRequests.status, "open"),
          lte(pullRequests.createdAt, staleThreshold)
        )
      );

    // For each open PR, check if it has any human reviews
    const prIds = openPRs.map((pr) => pr.id);

    let reviewMap = new Map<string, { count: number; hasHuman: boolean; latestState: string | null }>();

    if (prIds.length > 0) {
      // Get review info per PR
      const reviews = await db
        .select({
          prId: prReviews.prId,
          reviewer: prReviews.reviewer,
          state: prReviews.state,
          submittedAt: prReviews.submittedAt,
        })
        .from(prReviews)
        .where(
          sql`${prReviews.prId} IN (${sql.join(
            prIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );

      for (const rev of reviews) {
        const existing = reviewMap.get(rev.prId) || {
          count: 0,
          hasHuman: false,
          latestState: null,
        };
        existing.count++;
        // Bot reviewers typically have [bot] suffix or known bot names
        const isBot =
          /\[bot\]$/i.test(rev.reviewer) ||
          /^(dependabot|renovate|github-actions|codecov|gemini-code-assist|coderabbit)/i.test(
            rev.reviewer
          );
        if (!isBot) {
          existing.hasHuman = true;
        }
        existing.latestState = rev.state;
        reviewMap.set(rev.prId, existing);
      }
    }

    // Build stale PR objects with recommendations
    const stalePRs = openPRs.map((pr) => {
      const daysOpen = Math.round(
        (now.getTime() - pr.createdAt.getTime()) / 86400000
      );
      const reviewInfo = reviewMap.get(pr.id) || {
        count: 0,
        hasHuman: false,
        latestState: null,
      };

      // Recommendation logic:
      // - close: no human review after 7+ days, or 14+ days with only bot reviews
      // - wait: has human review (changes_requested or commented), might still convert
      // - followup: has human review but stale, worth a ping
      let recommendation: "close" | "wait" | "followup";
      if (reviewInfo.hasHuman) {
        if (reviewInfo.latestState === "changes_requested") {
          recommendation = "followup"; // They asked for changes, we should respond
        } else if (daysOpen > 21) {
          recommendation = "close"; // Even with human review, 3 weeks is too long
        } else {
          recommendation = "wait";
        }
      } else if (daysOpen > 14) {
        recommendation = "close"; // 2 weeks, no human interest
      } else {
        recommendation = "close"; // Past stale threshold with zero engagement
      }

      return {
        id: pr.id,
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        daysOpen,
        createdAt: pr.createdAt,
        diffSize: (pr.additions ?? 0) + (pr.deletions ?? 0),
        filesChanged: pr.filesChanged ?? 0,
        reviewCount: reviewInfo.count,
        hasHumanReview: reviewInfo.hasHuman,
        latestReviewState: reviewInfo.latestState,
        qualityScore: pr.qualityScore,
        htmlUrl: pr.htmlUrl,
        recommendation,
      };
    });

    // Sort: close recommendations first, then by days open descending
    stalePRs.sort((a, b) => {
      const recOrder = { close: 0, followup: 1, wait: 2 };
      const orderDiff = recOrder[a.recommendation] - recOrder[b.recommendation];
      if (orderDiff !== 0) return orderDiff;
      return b.daysOpen - a.daysOpen;
    });

    // Summary stats
    const closeCount = stalePRs.filter((p) => p.recommendation === "close").length;
    const followupCount = stalePRs.filter((p) => p.recommendation === "followup").length;
    const waitCount = stalePRs.filter((p) => p.recommendation === "wait").length;
    const avgDaysOpen =
      stalePRs.length > 0
        ? Math.round(stalePRs.reduce((sum, p) => sum + p.daysOpen, 0) / stalePRs.length)
        : 0;

    // Repos with most stale PRs
    const repoStaleCount = new Map<string, number>();
    for (const pr of stalePRs) {
      repoStaleCount.set(pr.repo, (repoStaleCount.get(pr.repo) || 0) + 1);
    }
    const worstRepos = [...repoStaleCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([repo, count]) => ({ repo, count }));

    return NextResponse.json({
      stalePRs,
      summary: {
        total: stalePRs.length,
        close: closeCount,
        followup: followupCount,
        wait: waitCount,
        avgDaysOpen,
        worstRepos,
      },
      staleDays,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch stale PRs", details: String(error) },
      { status: 500 }
    );
  }
}
