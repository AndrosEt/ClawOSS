"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Header } from "@/components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "@/components/settings/general-settings";
import { QualitySettings } from "@/components/settings/quality-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { APIKeySettings } from "@/components/settings/api-key-settings";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSettings } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function SettingsPage() {
  const { data: settings, isLoading, mutate } = useSWR<DashboardSettings>(
    "/api/settings",
    fetcher
  );

  const handleSave = useCallback(
    async (updates: Partial<DashboardSettings>) => {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      mutate();
    },
    [mutate]
  );

  const handleNotificationSave = useCallback(
    async (notifications: DashboardSettings["notifications"]) => {
      await handleSave({ notifications });
    },
    [handleSave]
  );

  if (isLoading || !settings) {
    return (
      <div className="flex flex-col">
        <Header title="Settings" />
        <div className="flex-1 p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title="Settings" />
      <div className="flex-1 p-6">
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="general">
              <GeneralSettings settings={settings} onSave={handleSave} />
            </TabsContent>

            <TabsContent value="quality">
              <QualitySettings
                qualityThreshold={settings.qualityThreshold}
                autoMerge={settings.autoMerge}
                requiredReviews={settings.requiredReviews}
                onSave={handleSave}
              />
            </TabsContent>

            <TabsContent value="notifications">
              <NotificationSettings
                notifications={settings.notifications}
                onSave={handleNotificationSave}
              />
            </TabsContent>

            <TabsContent value="api-keys">
              <APIKeySettings
                hasGitHubToken={!!process.env.NEXT_PUBLIC_HAS_GITHUB_TOKEN}
                hasClawApiKey={!!process.env.NEXT_PUBLIC_HAS_CLAW_API_KEY}
              />
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </div>
  );
}
