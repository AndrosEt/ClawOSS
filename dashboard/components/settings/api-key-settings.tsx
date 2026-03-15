"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface APIKeySettingsProps {
  hasGitHubToken: boolean;
  hasClawApiKey: boolean;
}

export function APIKeySettings({
  hasGitHubToken,
  hasClawApiKey,
}: APIKeySettingsProps) {
  const [githubToken, setGithubToken] = useState("");
  const [clawApiKey, setClawApiKey] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">GitHub Token</label>
            <Badge variant={hasGitHubToken ? "default" : "destructive"}>
              {hasGitHubToken ? "Configured" : "Missing"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Used for PR sync. Set via GITHUB_TOKEN environment variable.
          </p>
          <Input
            type="password"
            placeholder="ghp_xxxx..."
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">CLAW API Key</label>
            <Badge variant={hasClawApiKey ? "default" : "destructive"}>
              {hasClawApiKey ? "Configured" : "Missing"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Shared secret for agent-to-dashboard communication. Set via
            CLAW_API_KEY environment variable.
          </p>
          <Input
            type="password"
            placeholder="your-shared-secret"
            value={clawApiKey}
            onChange={(e) => setClawApiKey(e.target.value)}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          API keys are configured via environment variables on Vercel. Updates
          here will not persist across deployments.
        </p>
      </CardContent>
    </Card>
  );
}
