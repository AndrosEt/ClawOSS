"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatRelativeTime } from "@/lib/utils";
import type { PullRequest } from "@/lib/types";

interface PRDetailDialogProps {
  pr: PullRequest | null;
  open: boolean;
  onClose: () => void;
}

export function PRDetailDialog({ pr, open, onClose }: PRDetailDialogProps) {
  if (!pr) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            #{pr.number} {pr.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge>{pr.status}</Badge>
            <span className="text-sm text-muted-foreground">{pr.repo}</span>
            <span className="text-sm text-muted-foreground">
              {formatRelativeTime(pr.createdAt)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Files Changed</p>
              <p className="font-medium">{pr.filesChanged}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Additions</p>
              <p className="font-medium text-green-500">+{pr.additions}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Deletions</p>
              <p className="font-medium text-red-500">-{pr.deletions}</p>
            </div>
          </div>

          {pr.qualityBreakdown && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3">Quality Breakdown</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: "Scope Check (10%)", value: pr.qualityBreakdown.scopeCheck },
                    { label: "Code Quality (20%)", value: pr.qualityBreakdown.codeQuality },
                    { label: "Test Coverage (20%)", value: pr.qualityBreakdown.testCoverage },
                    { label: "Security (10%)", value: pr.qualityBreakdown.security },
                    { label: "Anti-Slop (15%)", value: pr.qualityBreakdown.antiSlop },
                    { label: "Git Hygiene (10%)", value: pr.qualityBreakdown.gitHygiene },
                    { label: "PR Template (15%)", value: pr.qualityBreakdown.prTemplate },
                  ].map((gate) => (
                    <div key={gate.label} className="flex justify-between">
                      <span className="text-muted-foreground">{gate.label}</span>
                      <span className="font-mono">
                        {gate.value != null ? gate.value.toFixed(0) : "--"}
                      </span>
                    </div>
                  ))}
                  <div className="col-span-2 flex justify-between border-t pt-2 font-semibold">
                    <span>Overall Score</span>
                    <span className="font-mono">
                      {pr.qualityBreakdown.overallScore.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {pr.reviews && pr.reviews.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3">Reviews</h3>
                <div className="space-y-2">
                  {pr.reviews.map((review) => (
                    <div
                      key={review.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Badge variant="outline" className="text-xs">
                        {review.state}
                      </Badge>
                      <div>
                        <span className="font-medium">@{review.reviewer}</span>
                        {review.body && (
                          <p className="text-muted-foreground mt-0.5">
                            {review.body}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {pr.body && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {pr.body}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
