"use client";

import { Header } from "@/components/layout/header";
import { AgentStatusCard } from "@/components/overview/agent-status-card";
import { MetricCards } from "@/components/overview/metric-cards";
import { ActivityTimeline } from "@/components/overview/activity-timeline";
import { CurrentTaskCard } from "@/components/overview/current-task-card";
import { RecentPRsList } from "@/components/overview/recent-prs-list";
import { AgentStatePanel } from "@/components/live/agent-state-panel";
import { useAgentStatus } from "@/lib/hooks/use-agent-status";
import { useConnectionStatus } from "@/lib/hooks/use-connection-status";
import { useAgentState } from "@/lib/hooks/use-agent-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-center">Waiting for Agent Data</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground">
          The dashboard is waiting for telemetry data from the ClawOSS agent.
          Data will appear here automatically once the agent starts running.
        </p>
        <div className="text-sm text-muted-foreground max-w-md mx-auto">
          <p className="font-medium mb-2">To connect the agent:</p>
          <ol className="text-left list-decimal list-inside space-y-1">
            <li>Set <code className="text-xs bg-muted px-1 rounded">CLAW_API_KEY</code> in the agent environment</li>
            <li>The dashboard-reporter hook will auto-send telemetry</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  const { data, isLoading } = useAgentStatus();
  const { data: connectionData } = useConnectionStatus();
  const { data: stateData, isLoading: stateLoading } = useAgentState();

  const hasData = connectionData?.hasAnyData ||
    (data?.stats && (data.stats.totalPRs > 0 || data.stats.tokensUsedToday > 0)) ||
    (data?.recentActivity && data.recentActivity.length > 0);

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <Header title="Overview" />
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title="Overview" />
      <div className="flex-1 space-y-6 p-6">
        {!hasData && <EmptyState />}

        {data?.agentStatus && <AgentStatusCard status={data.agentStatus} />}

        <MetricCards
          totalPRs={data?.stats?.totalPRs || 0}
          mergeRate={data?.stats?.mergeRate || 0}
          tokensUsedToday={data?.stats?.tokensUsedToday || 0}
          costToday={data?.stats?.costToday || 0}
        />

        {/* Pipeline status bar */}
        {connectionData && (
          <Card className="bg-muted/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${
                    connectionData.connection.state === "connected"
                      ? "bg-green-500 animate-pulse"
                      : connectionData.connection.state === "degraded"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`} />
                  <span className="text-muted-foreground">Pipeline</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {connectionData.connection.state}
                  </Badge>
                </div>
                <span className="text-muted-foreground">|</span>
                <span>
                  <span className="text-muted-foreground">heartbeats/hr:</span>{" "}
                  {connectionData.pipeline.heartbeatsLastHour}
                </span>
                <span>
                  <span className="text-muted-foreground">errors/hr:</span>{" "}
                  <span className={connectionData.pipeline.errorsLastHour > 0 ? "text-red-400" : ""}>
                    {connectionData.pipeline.errorsLastHour}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">model:</span>{" "}
                  Kimi K2.5
                </span>
                <span>
                  <span className="text-muted-foreground">pricing:</span>{" "}
                  $0.45/$2.20/M
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <ActivityTimeline items={data?.recentActivity || []} />
            <div className="grid gap-6 md:grid-cols-2">
              <CurrentTaskCard task={data?.currentTask || null} />
              <RecentPRsList prs={data?.recentPRs || []} />
            </div>
          </div>
          <div>
            <AgentStatePanel state={stateData?.state || null} isLoading={stateLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
