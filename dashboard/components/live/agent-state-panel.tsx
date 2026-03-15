"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import type { AgentState } from "@/lib/types";

interface AgentStatePanelProps {
  state: AgentState | null;
  isLoading: boolean;
}

const skillColors: Record<string, string> = {
  "oss-discover": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "oss-triage": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "oss-implement": "bg-green-500/20 text-green-300 border-green-500/30",
  "oss-followup": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "repo-analyzer": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "systematic-debugging": "bg-red-500/20 text-red-300 border-red-500/30",
  "test-driven-development": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

function getSkillBadgeClass(skill: string): string {
  return (
    skillColors[skill] ||
    "bg-gray-500/20 text-gray-300 border-gray-500/30"
  );
}

export function AgentStatePanel({ state, isLoading }: AgentStatePanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Agent State</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!state) {
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Agent State</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="text-center py-6 space-y-2">
            <div className="text-2xl opacity-40">...</div>
            <p className="text-xs text-muted-foreground">
              No state reported yet
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              State will appear when the agent completes a cycle
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const workQueue = (state.workQueue || []) as Array<{
    priority: string;
    repo: string;
    issue: string;
    title: string;
    solvabilityScore?: number;
  }>;

  const pipeline = state.pipelineState as {
    activePRs?: Array<{
      repo: string;
      number: number;
      title: string;
      status: string;
    }>;
    statsToday?: {
      submitted: number;
      merged: number;
      rejected: number;
      abandoned: number;
    };
  } | null;

  const repos = (state.activeRepos || []) as string[];

  // Staleness check
  const stateAge = state.timestamp
    ? Date.now() - new Date(state.timestamp).getTime()
    : Infinity;
  const isStale = stateAge > 30 * 60 * 1000; // 30 min

  return (
    <div className="space-y-3">
      {/* Current Activity */}
      <Card className={isStale ? "border-yellow-500/30" : ""}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              Current Activity
              {!isStale && state.currentSkill && (
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              )}
            </span>
            <span
              className={`text-[10px] font-normal ${
                isStale ? "text-yellow-400" : "text-muted-foreground"
              }`}
            >
              {isStale && "stale -- "}
              {formatRelativeTime(state.timestamp)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2.5 text-xs">
          {state.currentSkill && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Skill</span>
              <Badge
                variant="outline"
                className={`text-[10px] h-5 px-2 font-mono border ${getSkillBadgeClass(state.currentSkill)}`}
              >
                {state.currentSkill}
              </Badge>
            </div>
          )}
          {state.currentRepo && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Repo</span>
              <span className="font-mono text-blue-400 truncate max-w-[140px] text-[11px]">
                {state.currentRepo}
              </span>
            </div>
          )}
          {state.currentIssue && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Issue</span>
              <span className="font-mono text-green-400 text-[11px]">
                {state.currentIssue}
              </span>
            </div>
          )}
          {!state.currentSkill &&
            !state.currentRepo &&
            !state.currentIssue && (
              <p className="text-muted-foreground text-center py-1 italic">
                Idle -- waiting for next heartbeat
              </p>
            )}
        </CardContent>
      </Card>

      {/* Active Repos */}
      {repos.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Active Repos</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                {repos.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-1.5">
              {repos.map((repo) => (
                <Badge
                  key={repo}
                  variant="secondary"
                  className="text-[10px] h-5 px-2 font-mono"
                >
                  {repo.includes("/") ? repo.split("/")[1] : repo}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Work Queue */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Work Queue</span>
            <Badge
              variant={workQueue.length > 0 ? "default" : "outline"}
              className="text-[10px] h-4 px-1.5"
            >
              {workQueue.length} items
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-1.5">
          {workQueue.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3 italic">
              Queue empty -- agent will run discovery
            </p>
          ) : (
            workQueue.slice(0, 8).map((item, i) => {
              const priorityColors: Record<string, string> = {
                HIGH: "bg-red-500/20 text-red-300 border-red-500/30",
                "1": "bg-red-500/20 text-red-300 border-red-500/30",
                "2": "bg-orange-500/20 text-orange-300 border-orange-500/30",
                MEDIUM:
                  "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
                "3": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
                LOW: "bg-gray-500/20 text-gray-300 border-gray-500/30",
              };
              const pColor =
                priorityColors[item.priority] || priorityColors.MEDIUM;

              return (
                <div
                  key={i}
                  className={`flex items-start gap-1.5 text-[11px] rounded px-2 py-1 ${
                    i === 0 ? "bg-muted/50 border border-border" : ""
                  }`}
                >
                  <Badge
                    variant="outline"
                    className={`text-[8px] h-3.5 px-1 shrink-0 mt-0.5 border ${pColor}`}
                  >
                    P{item.priority}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-blue-400 font-mono text-[10px]">
                        {item.repo?.includes("/")
                          ? item.repo.split("/")[1]
                          : item.repo}
                      </span>
                      <span className="text-green-400 font-mono text-[10px]">
                        #{item.issue}
                      </span>
                      {item.solvabilityScore != null && (
                        <span
                          className={`text-[9px] ml-auto ${
                            (item.solvabilityScore ?? 0) >= 7
                              ? "text-green-400"
                              : (item.solvabilityScore ?? 0) >= 5
                              ? "text-yellow-400"
                              : "text-red-400"
                          }`}
                        >
                          s:{item.solvabilityScore}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate leading-tight text-[10px]">
                      {item.title}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          {workQueue.length > 8 && (
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              +{workQueue.length - 8} more
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pipeline */}
      {pipeline && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2 text-xs">
            {pipeline.activePRs && pipeline.activePRs.length > 0 ? (
              <div className="space-y-1.5">
                <span className="text-muted-foreground font-medium text-[11px]">
                  Active PRs
                </span>
                {pipeline.activePRs.map((pr, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 bg-muted/30 rounded px-2 py-1"
                  >
                    <Badge
                      variant="secondary"
                      className="text-[9px] h-3.5 px-1"
                    >
                      #{pr.number}
                    </Badge>
                    <span className="truncate text-[10px]">{pr.title}</span>
                    <Badge
                      variant="outline"
                      className="text-[8px] h-3 px-1 ml-auto shrink-0"
                    >
                      {pr.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-1 italic text-[11px]">
                No active PRs
              </p>
            )}
            {pipeline.statsToday && (
              <div className="border-t pt-2 space-y-1">
                <span className="text-muted-foreground font-medium text-[11px]">
                  Today
                </span>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-sm font-bold">
                      {pipeline.statsToday.submitted}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      sent
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-green-400">
                      {pipeline.statsToday.merged}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      merged
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-red-400">
                      {pipeline.statsToday.rejected}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      rejected
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-yellow-400">
                      {pipeline.statsToday.abandoned}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      dropped
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
