"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { DashboardSettings } from "@/lib/types";

interface GeneralSettingsProps {
  settings: DashboardSettings;
  onSave: (settings: Partial<DashboardSettings>) => void;
}

export function GeneralSettings({ settings, onSave }: GeneralSettingsProps) {
  const [repos, setRepos] = useState(settings.targetRepos);
  const [newRepo, setNewRepo] = useState("");
  const [paused, setPaused] = useState(settings.agentPaused);
  const [interval, setInterval] = useState(settings.heartbeatIntervalMinutes);

  const addRepo = () => {
    if (newRepo && !repos.includes(newRepo)) {
      setRepos([...repos, newRepo]);
      setNewRepo("");
    }
  };

  const removeRepo = (repo: string) => {
    setRepos(repos.filter((r) => r !== repo));
  };

  const handleSave = () => {
    onSave({
      targetRepos: repos,
      agentPaused: paused,
      heartbeatIntervalMinutes: interval,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium">Target Repositories</label>
          <div className="flex flex-wrap gap-2">
            {repos.map((repo) => (
              <Badge key={repo} variant="secondary" className="gap-1">
                {repo}
                <button onClick={() => removeRepo(repo)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="owner/repo"
              value={newRepo}
              onChange={(e) => setNewRepo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRepo()}
            />
            <Button variant="outline" onClick={addRepo}>
              Add
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Pause Agent</p>
            <p className="text-xs text-muted-foreground">
              {paused ? "Agent is paused" : "Agent is running"}
            </p>
          </div>
          <Switch checked={paused} onCheckedChange={setPaused} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Heartbeat Interval (minutes)
          </label>
          <Input
            type="number"
            min={1}
            max={60}
            value={interval}
            onChange={(e) => setInterval(parseInt(e.target.value) || 5)}
          />
        </div>

        <Button onClick={handleSave}>Save Changes</Button>
      </CardContent>
    </Card>
  );
}
