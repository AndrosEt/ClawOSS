"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgentStatus } from "@/lib/hooks/use-agent-status";

export function BudgetPanel() {
  const { data, isLoading } = useAgentStatus();
  const budget = data?.budgetInfo;

  if (isLoading || !budget || budget.budgetUsd <= 0) return null;

  const pct = budget.pctUsed ?? 0;
  const exceeded = budget.exceeded ?? false;
  const spent = budget.spentUsd ?? 0;
  const remaining = budget.remainingUsd ?? budget.budgetUsd - spent;

  const barColor = exceeded
    ? "bg-red-500"
    : pct >= 80
    ? "bg-amber-500"
    : "bg-emerald-500";

  const borderColor = exceeded
    ? "border-red-500/40"
    : pct >= 80
    ? "border-amber-500/30"
    : "border-border";

  return (
    <Card className={`border ${borderColor}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground/60 flex items-center justify-between">
          <span>Token Budget</span>
          {exceeded && (
            <span className="text-red-500 text-[10px] font-semibold animate-pulse">
              BUDGET EXCEEDED — AGENT PAUSED
            </span>
          )}
          {!exceeded && pct >= 80 && (
            <span className="text-amber-500 text-[10px] font-semibold">
              {(100 - pct).toFixed(1)}% REMAINING
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>

        {/* Numbers */}
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-muted-foreground/60">
            spent{" "}
            <span className={exceeded ? "text-red-400" : "text-foreground/70"}>
              ${spent.toFixed(4)}
            </span>
          </span>
          <span className="text-muted-foreground/40">
            {pct.toFixed(1)}%
          </span>
          <span className="text-muted-foreground/60">
            budget{" "}
            <span className="text-foreground/70">${budget.budgetUsd.toFixed(2)}</span>
          </span>
        </div>

        {!exceeded && (
          <p className="text-[10px] text-muted-foreground/40 font-mono">
            ${remaining.toFixed(4)} remaining until agent pauses
          </p>
        )}
        {exceeded && (
          <p className="text-[10px] text-red-400/70 font-mono">
            Budget limit reached. Restart with a higher TOKEN_BUDGET_USD to resume.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
