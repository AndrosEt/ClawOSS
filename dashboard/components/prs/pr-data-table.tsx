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

function QualityCell({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return <span className="text-muted-foreground/40 font-mono text-xs">--</span>;
  }
  const cls = score >= 80 ? "q-high" : score >= 60 ? "q-mid" : "q-low";
  return <span className={`quality-ring ${cls}`}>{score.toFixed(0)}</span>;
}

export function PRDataTable({ data, onRowClick }: PRDataTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-mono text-[10px] uppercase tracking-wider">Title</TableHead>
          <TableHead className="font-mono text-[10px] uppercase tracking-wider">Repository</TableHead>
          <TableHead className="font-mono text-[10px] uppercase tracking-wider">Status</TableHead>
          <TableHead className="font-mono text-[10px] uppercase tracking-wider">Quality</TableHead>
          <TableHead className="font-mono text-[10px] uppercase tracking-wider">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
              <p>No pull requests found</p>
              <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Adjust filters or wait for new PRs</p>
            </TableCell>
          </TableRow>
        ) : (
          data.map((pr) => (
            <TableRow
              key={pr.id}
              className="cursor-pointer table-row-hover group"
              onClick={() => onRowClick(pr)}
            >
              <TableCell className="max-w-[300px]">
                <p className="font-medium truncate group-hover:text-foreground transition-colors">
                  <span className="text-muted-foreground/60">#{pr.number}</span>{" "}
                  {pr.title}
                </p>
              </TableCell>
              <TableCell>
                <span className="text-[11px] text-muted-foreground font-mono">{pr.repo}</span>
              </TableCell>
              <TableCell>
                <Badge
                  variant={statusVariant[pr.status] || "outline"}
                  className="text-[10px]"
                >
                  {pr.status}
                </Badge>
              </TableCell>
              <TableCell>
                <QualityCell score={pr.qualityScore} />
              </TableCell>
              <TableCell>
                <span className="text-[11px] text-muted-foreground/60 font-mono">
                  {formatRelativeTime(pr.createdAt)}
                </span>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
