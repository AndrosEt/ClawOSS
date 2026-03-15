"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { DashboardSettings } from "@/lib/types";

interface NotificationSettingsProps {
  notifications: DashboardSettings["notifications"];
  onSave: (notifications: DashboardSettings["notifications"]) => void;
}

export function NotificationSettings({
  notifications,
  onSave,
}: NotificationSettingsProps) {
  const [state, setState] = useState(notifications);

  const handleSave = () => {
    onSave(state);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Slack Webhook URL</label>
          <Input
            placeholder="https://hooks.slack.com/services/..."
            value={state.slackWebhookUrl}
            onChange={(e) =>
              setState({ ...state, slackWebhookUrl: e.target.value })
            }
          />
        </div>

        {[
          { key: "onError" as const, label: "On Error" },
          { key: "onPRMerged" as const, label: "On PR Merged" },
          { key: "onPRRejected" as const, label: "On PR Rejected" },
          { key: "onAgentOffline" as const, label: "On Agent Offline" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <p className="text-sm font-medium">{label}</p>
            <Switch
              checked={state[key]}
              onCheckedChange={(v) => setState({ ...state, [key]: v })}
            />
          </div>
        ))}

        <Button onClick={handleSave}>Save Changes</Button>
      </CardContent>
    </Card>
  );
}
