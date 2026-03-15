"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DashboardSettings } from "@/lib/types";

interface QualitySettingsProps {
  qualityThreshold: number;
  autoMerge: boolean;
  requiredReviews: number;
  onSave: (settings: Partial<DashboardSettings>) => void;
}

export function QualitySettings({
  qualityThreshold,
  autoMerge,
  requiredReviews,
  onSave,
}: QualitySettingsProps) {
  const [threshold, setThreshold] = useState(qualityThreshold);
  const [merge, setMerge] = useState(autoMerge);
  const [reviews, setReviews] = useState(requiredReviews);

  const handleSave = () => {
    onSave({
      qualityThreshold: threshold,
      autoMerge: merge,
      requiredReviews: reviews,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quality Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium">
            Minimum Quality Threshold
          </label>
          <Slider
            value={[threshold]}
            onValueChange={(v) => setThreshold(Array.isArray(v) ? v[0] : v)}
            min={0}
            max={100}
            step={5}
          />
          <p className="text-sm text-muted-foreground">
            {threshold} / 100 - PRs below this score will not be submitted.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Auto-Merge</p>
            <p className="text-xs text-muted-foreground">
              When enabled, PRs scoring above threshold are auto-merged if all
              checks pass and required approvals received.
            </p>
          </div>
          <Switch checked={merge} onCheckedChange={setMerge} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Required Reviews Before Merge
          </label>
          <Select
            value={String(reviews)}
            onValueChange={(v) => v && setReviews(parseInt(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave}>Save Changes</Button>
      </CardContent>
    </Card>
  );
}
