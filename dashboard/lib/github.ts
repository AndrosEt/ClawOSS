import { Octokit } from "@octokit/rest";
import { db, ensureDb } from "./db";
import { pullRequests, prReviews, qualityScores } from "./schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { computeQualityScore } from "./quality";
import { classifyPRType } from "./pr-type";

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

  // Dynamic discovery: search for ALL PRs by the agent across GitHub
  // This replaces the old hardcoded targetRepos approach
  const searchResults = await octokit.search.issuesAndPullRequests({
    q: `author:${agentUsername} is:pr sort:updated-desc`,
    per_page: 100,
  });

  // Also check target repos from settings for any PRs the search might miss
  const settingsRow = await db.query.settings.findFirst({
    where: eq(
      (await import("./schema")).settings.key,
      "dashboard_settings"
    ),
  });
  const settings = settingsRow?.value as { targetRepos?: string[] } | null;
  const targetRepos = settings?.targetRepos || [];

  // Collect all PRs: from search + from target repos
  type PRInfo = { owner: string; repo: string; repoFullName: string; number: number };
  const prMap = new Map<string, PRInfo>();

  // Add PRs from search results
  for (const item of searchResults.data.items) {
    if (!item.pull_request) continue;
    // Extract owner/repo from repository_url: "https://api.github.com/repos/owner/repo"
    const match = item.repository_url?.match(/repos\/([^/]+)\/([^/]+)$/);
    if (!match) continue;
    const [, owner, repo] = match;
    const repoFullName = `${owner}/${repo}`;
    const key = `${repoFullName}#${item.number}`;
    prMap.set(key, { owner, repo, repoFullName, number: item.number });
  }

  // Also scan target repos for any PRs search might have missed
  for (const repoFullName of targetRepos) {
    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) continue;
    try {
      const { data: prs } = await octokit.pulls.list({
        owner, repo, state: "all", sort: "updated", direction: "desc", per_page: 30,
      });
      for (const pr of prs) {
        if (pr.user?.login === agentUsername) {
          const key = `${repoFullName}#${pr.number}`;
          if (!prMap.has(key)) {
            prMap.set(key, { owner, repo, repoFullName, number: pr.number });
          }
        }
      }
    } catch {
      // Skip repos that error
    }
  }

  let synced = 0;
  const syncedRepos: string[] = [];

  for (const [, info] of prMap) {
    const { owner, repo, repoFullName } = info;

    try {
      // Fetch full PR details
      const { data: pr } = await octokit.pulls.get({
        owner, repo, pull_number: info.number,
      });

      if (pr.user?.login !== agentUsername) continue;

      {
        const prId = `${repoFullName}#${pr.number}`;

        const status = pr.merged_at
          ? "merged"
          : pr.state === "closed"
            ? "closed"
            : "open";

        // pulls.get already includes additions/deletions/changed_files
        const additions = pr.additions;
        const deletions = pr.deletions;
        const filesChanged = pr.changed_files;
        const htmlUrl = pr.html_url;

        const prType = classifyPRType(pr.title, pr.body);

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
            htmlUrl,
            prType,
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
              htmlUrl,
              prType,
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

        // Check if PR actually modifies test files (not just title)
        let hasTests = false;
        try {
          const { data: files } = await octokit.pulls.listFiles({
            owner, repo, pull_number: pr.number, per_page: 100,
          });
          hasTests = files.some((f) =>
            /(?:test|spec|__tests__|__mocks__)/i.test(f.filename)
          );
        } catch {
          // Fall back to title check if file listing fails
          hasTests = /test|spec/i.test(pr.title || "");
        }

        // Compute quality score
        const score = computeQualityScore({
          additions,
          deletions,
          filesChanged,
          hasTests,
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
        if (!syncedRepos.includes(repoFullName)) {
          syncedRepos.push(repoFullName);
        }
      }
    } catch {
      // Skip PRs that error
    }
  }

  return { synced, repos: syncedRepos };
}
