"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import type { PullRequest } from "@/lib/types";

interface PRDataTableProps {
  data: PullRequest[];
  onRowClick: (pr: PullRequest) => void;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "default",
  merged: "secondary",
  closed: "destructive",
};

export function PRDataTable({ data, onRowClick }: PRDataTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Repository</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Quality</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              No pull requests found
            </TableCell>
          </TableRow>
        ) : (
          data.map((pr) => (
            <TableRow
              key={pr.id}
              className="cursor-pointer"
              onClick={() => onRowClick(pr)}
            >
              <TableCell className="max-w-[300px]">
                <p className="font-medium truncate">
                  #{pr.number} {pr.title}
                </p>
              </TableCell>
              <TableCell className="text-muted-foreground">{pr.repo}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[pr.status] || "outline"}>
                  {pr.status}
                </Badge>
              </TableCell>
              <TableCell>
                {pr.qualityScore != null ? (
                  <span
                    className={
                      pr.qualityScore >= 80
                        ? "text-green-500"
                        : pr.qualityScore >= 60
                          ? "text-yellow-500"
                          : "text-red-500"
                    }
                  >
                    {pr.qualityScore.toFixed(0)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatRelativeTime(pr.createdAt)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
