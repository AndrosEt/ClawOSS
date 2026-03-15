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
import { AsciiLogo, AsciiDivider } from "@/components/layout/ascii-logo";

function EmptyState() {
  return (
    <Card className="border-dashed animate-fade-up">
      <CardHeader>
        <CardTitle className="text-center">Waiting for Agent Data</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center">
            <span className="h-3 w-3 rounded-full bg-muted-foreground/30 animate-pulse" />
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          The dashboard is waiting for telemetry data from the ClawOSS agent.
        </p>
        <div className="text-sm text-muted-foreground max-w-md mx-auto font-mono">
          <p className="font-medium mb-2 text-xs uppercase tracking-wider">To connect:</p>
          <ol className="text-left list-decimal list-inside space-y-1 text-xs">
            <li>Set <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">CLAW_API_KEY</code> in agent env</li>
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
        {/* ASCII Art Hero */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <AsciiLogo />
            <div>
              <h2 className="text-2xl font-bold claw-title">Autonomous OSS Contributor</h2>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                {">"} Kimi K2.5 | Parallel sub-agents | Reproduce-first workflow
              </p>
            </div>
          </div>
        </div>

        <AsciiDivider />

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
          <div className="pipeline-bar rounded-lg px-4 py-2.5 animate-fade-up">
            <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${
                  connectionData.connection.state === "connected"
                    ? "bg-green-500 glow-dot glow-dot-green"
                    : connectionData.connection.state === "degraded"
                    ? "bg-yellow-500 glow-dot glow-dot-yellow"
                    : "bg-red-500"
                }`} />
                <span className="text-muted-foreground/70">Pipeline</span>
                <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${
                  connectionData.connection.state === "connected"
                    ? "text-green-400 border-green-400/30"
                    : connectionData.connection.state === "degraded"
                    ? "text-yellow-400 border-yellow-400/30"
                    : "text-red-400 border-red-400/30"
                }`}>
                  {connectionData.connection.state}
                </Badge>
              </div>
              <span className="text-muted-foreground/20">|</span>
              <span>
                <span className="text-muted-foreground/50">hb/hr:</span>{" "}
                <span className="text-green-400">{connectionData.pipeline.heartbeatsLastHour}</span>
              </span>
              <span>
                <span className="text-muted-foreground/50">err/hr:</span>{" "}
                <span className={connectionData.pipeline.errorsLastHour > 0 ? "text-red-400 font-bold" : "text-green-400"}>
                  {connectionData.pipeline.errorsLastHour}
                </span>
              </span>
              <span className="text-muted-foreground/20">|</span>
              <span>
                <span className="text-muted-foreground/50">model:</span>{" "}
                <span className="text-cyan-400">Kimi K2.5</span>
              </span>
              <span>
                <span className="text-muted-foreground/50">pricing:</span>{" "}
                <span className="text-emerald-400">$0.60/$3.00/M</span>
              </span>
              <span className="text-muted-foreground/20">|</span>
              <span>
                <span className="text-muted-foreground/30">pii:</span>{" "}
                <span className="text-muted-foreground/40">off</span>
              </span>
            </div>
          </div>
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
