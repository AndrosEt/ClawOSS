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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TerminalLoop } from "@/components/ascii/terminal-loop";
import { ScrambleText } from "@/components/ascii/scramble-text";
import { BreathingText } from "@/components/ascii/breathing-text";
import { LifeField } from "@/components/ascii/life-field";
import { CharSand } from "@/components/ascii/char-sand";
import { GlyphMorph } from "@/components/ascii/glyph-morph";
import { DnaHelix } from "@/components/ascii/dna-helix";
import { MatrixRain } from "@/components/ascii/matrix-rain";
import { useEffect, useState } from "react";

function InlineClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-muted-foreground/30 tabular-nums text-[10px]" suppressHydrationWarning>
      [{time}]
    </span>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed relative overflow-hidden">
      <CardHeader>
        <CardTitle className="text-center text-sm font-mono">
          <ScrambleText text="Waiting for Agent Data" speed={35} scrambleFrames={12} />
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4 relative z-10">
        <div className="flex justify-center">
          <div className="h-10 w-10 rounded-full border border-muted-foreground/20 flex items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30 animate-pulse" />
          </div>
        </div>
        <p className="text-muted-foreground text-xs font-mono">
          <ScrambleText text="Waiting for telemetry from the ClawOSS agent." speed={25} stagger={15} scrambleFrames={10} />
        </p>
        <div className="text-muted-foreground max-w-sm mx-auto font-mono">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground/50">To connect:</p>
          <ol className="text-left list-decimal list-inside space-y-1 text-[11px]">
            <li>Set <code className="text-[10px] bg-muted px-1 py-0.5">CLAW_API_KEY</code> in agent env</li>
            <li>The dashboard-reporter hook will auto-send telemetry</li>
          </ol>
        </div>
      </CardContent>
      <div className="absolute inset-0 flex items-end pointer-events-none">
        <GlyphMorph width={80} rows={3} speed={50} className="w-full" />
      </div>
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
        <div className="flex-1 space-y-3 p-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col relative noise-overlay">
      <Header title="Overview" />
      <div className="flex-1 space-y-3 p-4 relative z-10">
        {/* System header */}
        <div className="system-header corner-brackets font-mono text-[11px] px-3 py-2 flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
          <div className="flex items-center gap-3">
            <span className="text-foreground/80 font-bold tracking-tight">
              <ScrambleText text="CLAWOSS" speed={40} scrambleFrames={14} stagger={30} />
            </span>
            <span className="text-muted-foreground/20">|</span>
            <span className="text-muted-foreground/50">
              <ScrambleText text="autonomous oss contributor" speed={25} scrambleFrames={8} stagger={12} />
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground/40">
            <span>kimi-k2.5</span>
            <span className="text-muted-foreground/15">|</span>
            <span>parallel-agents</span>
            <span className="text-muted-foreground/15">|</span>
            <span>reproduce-first</span>
            {connectionData && (
              <>
                <span className="text-muted-foreground/15">|</span>
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    connectionData.connection.state === "connected" ? "bg-emerald-500" : "bg-red-500"
                  }`} />
                  <span className={
                    connectionData.connection.state === "connected" ? "text-emerald-400/60" : "text-red-400/60"
                  }>
                    {connectionData.connection.state}
                  </span>
                </span>
              </>
            )}
            <span className="text-muted-foreground/15">|</span>
            <InlineClock />
          </div>
        </div>

        {/* Hero decode wave -- full-width art marquee */}
        <GlyphMorph width={120} rows={3} speed={45} className="w-full" />

        {!hasData && <EmptyState />}

        {data?.agentStatus && <AgentStatusCard status={data.agentStatus} />}

        <MetricCards
          totalPRs={data?.stats?.totalPRs || 0}
          mergeRate={data?.stats?.mergeRate || 0}
          tokensUsedToday={data?.stats?.tokensUsedToday || 0}
          costToday={data?.stats?.costToday || 0}
        />

        {/* Character sand divider */}
        <div className="relative overflow-hidden rounded-sm" style={{ height: 48 }}>
          <CharSand cols={100} rows={5} speed={70} spawnRate={0.08} />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/60 pointer-events-none" />
        </div>

        {/* Pipeline telemetry bar */}
        {connectionData && (
          <div className="pipeline-bar corner-brackets px-3 py-1.5">
            <div className="flex items-center gap-3 text-[10px] font-mono flex-wrap text-muted-foreground/40">
              <span className="uppercase tracking-wider text-muted-foreground/25">pipeline</span>
              <span className="text-muted-foreground/10">|</span>
              <span>hb/hr <span className="text-foreground/45 tabular-nums">{connectionData.pipeline.heartbeatsLastHour}</span></span>
              <span>err/hr <span className={connectionData.pipeline.errorsLastHour > 0 ? "text-red-400/60" : "text-foreground/45"}>
                {connectionData.pipeline.errorsLastHour}
              </span></span>
              <span className="text-muted-foreground/10">|</span>
              <span>model <span className="text-foreground/45">kimi-k2.5</span></span>
              <span>cost <span className="text-foreground/45">$0.60/$3.00/M</span></span>
              <span className="text-muted-foreground/10">|</span>
              <span>pii <span className="text-foreground/45">off</span></span>
            </div>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-3">
          {/* Main content: 2 cols */}
          <div className="lg:col-span-2 space-y-3">
            <ActivityTimeline items={data?.recentActivity || []} />

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-3">
                <CurrentTaskCard task={data?.currentTask || null} />
                <TerminalLoop />
              </div>
              <RecentPRsList prs={data?.recentPRs || []} />
            </div>
          </div>

          {/* Sidebar: 1 col -- art-heavy */}
          <div className="space-y-3">
            <AgentStatePanel state={stateData?.state || null} isLoading={stateLoading} />

            {/* Game of Life gallery piece */}
            <div className="art-frame relative rounded-md overflow-hidden">
              <LifeField cols={50} rows={14} speed={200} density={0.18} palette="gradient" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <span className="font-mono text-[10px] text-foreground/25 uppercase tracking-[0.3em] bg-background/50 px-4 py-1.5 rounded-sm backdrop-blur-sm border border-border/20">
                  <ScrambleText text="cellular automata" speed={30} scrambleFrames={10} stagger={18} />
                </span>
              </div>
            </div>

            {/* DNA + Matrix rain side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="art-frame relative rounded-md overflow-hidden flex justify-center py-1">
                <DnaHelix height={10} speed={140} />
              </div>
              <div className="art-frame relative rounded-md overflow-hidden">
                <MatrixRain cols={20} rows={10} speed={80} density={0.05} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer breathing wave */}
        <BreathingText width={140} rows={3} speed={80} className="mx-auto max-w-full" />
      </div>
    </div>
  );
}
