import { Octokit } from "@octokit/rest";
import { db, ensureDb } from "./db";
import { pullRequests, prReviews, qualityScores } from "./schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { computeQualityScore } from "./quality";

function getOctokit() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

export async function syncPRsFromGitHub(): Promise<{
  synced: number;
  repos: string[];
}> {
  await ensureDb();
  const octokit = getOctokit();
  const agentUsername = process.env.CLAW_AGENT_USERNAME || "BillionClaw";

  // Get target repos from settings
  const settingsRow = await db.query.settings.findFirst({
    where: eq(
      (await import("./schema")).settings.key,
      "dashboard_settings"
    ),
  });

  const settings = settingsRow?.value as { targetRepos?: string[] } | null;
  const targetRepos = settings?.targetRepos || [];

  if (targetRepos.length === 0) {
    return { synced: 0, repos: [] };
  }

  let synced = 0;
  const syncedRepos: string[] = [];

  for (const repoFullName of targetRepos) {
    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) continue;

    try {
      const { data: prs } = await octokit.pulls.list({
        owner,
        repo,
        state: "all",
        sort: "updated",
        direction: "desc",
        per_page: 30,
      });

      const agentPRs = prs.filter(
        (pr) => pr.user?.login === agentUsername
      );

      for (const pr of agentPRs) {
        const prId = `${repoFullName}#${pr.number}`;

        const status = pr.merged_at
          ? "merged"
          : pr.state === "closed"
            ? "closed"
            : "open";

        // Fetch detailed PR data (list endpoint doesn't include additions/deletions)
        let additions = 0;
        let deletions = 0;
        let filesChanged = 0;
        try {
          const { data: detail } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: pr.number,
          });
          additions = detail.additions;
          deletions = detail.deletions;
          filesChanged = detail.changed_files;
        } catch {
          // Use defaults if detail fetch fails
        }

        await db
          .insert(pullRequests)
          .values({
            id: prId,
            githubId: pr.id,
            repo: repoFullName,
            number: pr.number,
            title: pr.title,
            body: pr.body,
            status,
            createdAt: new Date(pr.created_at),
            mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
            closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
            additions,
            deletions,
            filesChanged,
          })
          .onConflictDoUpdate({
            target: pullRequests.id,
            set: {
              status,
              title: pr.title,
              body: pr.body,
              mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
              closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
              additions,
              deletions,
              filesChanged,
            },
          });

        // Fetch and upsert reviews
        try {
          const { data: reviews } = await octokit.pulls.listReviews({
            owner,
            repo,
            pull_number: pr.number,
          });

          let reviewCount = 0;
          for (const review of reviews) {
            if (!review.user) continue;
            const reviewId = `${prId}-review-${review.id}`;
            const state =
              review.state === "APPROVED"
                ? "approved"
                : review.state === "CHANGES_REQUESTED"
                  ? "changes_requested"
                  : "commented";

            await db
              .insert(prReviews)
              .values({
                id: reviewId,
                prId,
                reviewer: review.user.login,
                state: state as "approved" | "changes_requested" | "commented",
                body: review.body,
                submittedAt: new Date(review.submitted_at || pr.created_at),
              })
              .onConflictDoNothing();
            reviewCount++;
          }

          await db
            .update(pullRequests)
            .set({ reviewCount })
            .where(eq(pullRequests.id, prId));
        } catch {
          // Skip review fetch errors
        }

        // Compute quality score
        const score = computeQualityScore({
          additions,
          deletions,
          filesChanged,
          hasTests: /test|spec/i.test(pr.title || ""),
          commitMessages: [pr.title],
          description: pr.body || "",
          hasDescription: !!pr.body && pr.body.length > 50,
        });

        const existingScore = await db.query.qualityScores.findFirst({
          where: eq(qualityScores.prId, prId),
        });

        if (!existingScore) {
          await db.insert(qualityScores).values({
            id: nanoid(),
            prId,
            overallScore: score.overall,
            scopeCheck: score.scopeCheck,
            codeQuality: score.codeQuality,
            testCoverage: score.testCoverage,
            security: score.security,
            antiSlop: score.antiSlop,
            gitHygiene: score.gitHygiene,
            prTemplate: score.prTemplate,
            scoredAt: new Date(),
          });

          await db
            .update(pullRequests)
            .set({ qualityScore: score.overall })
            .where(eq(pullRequests.id, prId));
        }

        synced++;
      }

      if (agentPRs.length > 0) {
        syncedRepos.push(repoFullName);
      }
    } catch {
      // Skip repos that error
    }
  }

  return { synced, repos: syncedRepos };
}
