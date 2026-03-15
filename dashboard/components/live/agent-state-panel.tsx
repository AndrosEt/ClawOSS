"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import type { AgentState } from "@/lib/types";

interface AgentStatePanelProps {
  state: AgentState | null;
  isLoading: boolean;
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
          <p className="text-xs text-muted-foreground text-center py-4">
            No state reported yet
          </p>
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
    activePRs?: Array<{ repo: string; number: number; title: string; status: string }>;
    statsToday?: { submitted: number; merged: number; rejected: number; abandoned: number };
  } | null;

  const repos = (state.activeRepos || []) as string[];

  return (
    <div className="space-y-3">
      {/* Current Activity */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Current Activity</span>
            <span className="text-[10px] text-muted-foreground font-normal">
              {formatRelativeTime(state.timestamp)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2 text-xs">
          {state.currentSkill && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Skill</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                {state.currentSkill}
              </Badge>
            </div>
          )}
          {state.currentRepo && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Repo</span>
              <span className="font-mono text-blue-400 truncate max-w-[140px]">
                {state.currentRepo}
              </span>
            </div>
          )}
          {state.currentIssue && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Issue</span>
              <span className="font-mono text-green-400">
                {state.currentIssue}
              </span>
            </div>
          )}
          {!state.currentSkill && !state.currentRepo && !state.currentIssue && (
            <p className="text-muted-foreground text-center py-1">Idle</p>
          )}
        </CardContent>
      </Card>

      {/* Active Repos */}
      {repos.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Repos</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {repos.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-1">
              {repos.map((repo) => (
                <Badge key={repo} variant="secondary" className="text-[9px] h-4 px-1.5 font-mono">
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
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              {workQueue.length} items
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-1.5">
          {workQueue.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Empty</p>
          ) : (
            workQueue.slice(0, 8).map((item, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px]">
                <Badge
                  variant={item.priority === "HIGH" ? "destructive" : "outline"}
                  className="text-[8px] h-3.5 px-1 shrink-0 mt-0.5"
                >
                  {item.priority}
                </Badge>
                <div className="min-w-0">
                  <span className="text-blue-400 font-mono text-[10px]">
                    {item.repo?.includes("/") ? item.repo.split("/")[1] : item.repo}
                    {item.issue}
                  </span>
                  <p className="text-muted-foreground truncate leading-tight">
                    {item.title}
                  </p>
                </div>
              </div>
            ))
          )}
          {workQueue.length > 8 && (
            <p className="text-[10px] text-muted-foreground text-center">
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
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Active PRs</span>
                {pipeline.activePRs.map((pr, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
                      #{pr.number}
                    </Badge>
                    <span className="truncate text-[10px]">{pr.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-1">No active PRs</p>
            )}
            {pipeline.statsToday && (
              <div className="border-t pt-2 grid grid-cols-2 gap-1">
                <span className="text-muted-foreground">Submitted</span>
                <span className="text-right">{pipeline.statsToday.submitted}</span>
                <span className="text-muted-foreground">Merged</span>
                <span className="text-right text-green-400">{pipeline.statsToday.merged}</span>
                <span className="text-muted-foreground">Rejected</span>
                <span className="text-right text-red-400">{pipeline.statsToday.rejected}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
