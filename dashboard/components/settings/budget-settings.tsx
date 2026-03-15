"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardSettings } from "@/lib/types";

interface BudgetSettingsProps {
  settings: DashboardSettings;
  onSave: (updates: Partial<DashboardSettings>) => Promise<void>;
  saving: boolean;
}

export function BudgetSettings({ settings, onSave, saving }: BudgetSettingsProps) {
  const [budget, setBudget] = useState(settings.dailyBudgetUsd);
  const [maxPRs, setMaxPRs] = useState(settings.maxPRsPerDay);
  const [maxPRsPerRepo, setMaxPRsPerRepo] = useState(settings.maxPRsPerRepoPerDay);

  const handleSave = () => {
    onSave({
      dailyBudgetUsd: budget,
      maxPRsPerDay: maxPRs,
      maxPRsPerRepoPerDay: maxPRsPerRepo,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Daily Budget</CardTitle>
          <CardDescription>
            Maximum API spend per day in USD
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm">$</span>
            <Input
              type="number"
              min={0}
              step={5}
              value={budget}
              onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
              className="w-[120px]"
            />
            <span className="text-sm text-muted-foreground">/ day</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PR Rate Limits</CardTitle>
          <CardDescription>
            Control how many PRs the agent can create per day
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium">Max PRs per Day</p>
              <p className="text-xs text-muted-foreground">
                Total across all repositories
              </p>
            </div>
            <Input
              type="number"
              min={1}
              max={50}
              value={maxPRs}
              onChange={(e) => setMaxPRs(parseInt(e.target.value) || 1)}
              className="w-[80px]"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium">Max PRs per Repo per Day</p>
              <p className="text-xs text-muted-foreground">
                Prevents flooding any single repository
              </p>
            </div>
            <Input
              type="number"
              min={1}
              max={20}
              value={maxPRsPerRepo}
              onChange={(e) => setMaxPRsPerRepo(parseInt(e.target.value) || 1)}
              className="w-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}
