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
import type { LogEntry } from "@/lib/types";

interface LogStreamProps {
  entries: LogEntry[];
  onEntryClick: (entry: LogEntry) => void;
}

const levelVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  debug: "outline",
  info: "secondary",
  warn: "default",
  error: "destructive",
};

export function LogStream({ entries, onEntryClick }: LogStreamProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[140px]">Timestamp</TableHead>
          <TableHead className="w-[80px]">Level</TableHead>
          <TableHead className="w-[100px]">Source</TableHead>
          <TableHead>Message</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              No log entries found
            </TableCell>
          </TableRow>
        ) : (
          entries.map((entry) => {
            const ts =
              typeof entry.timestamp === "string"
                ? new Date(entry.timestamp)
                : entry.timestamp;
            return (
              <TableRow
                key={entry.id}
                className="cursor-pointer font-mono text-xs"
                onClick={() => onEntryClick(entry)}
              >
                <TableCell>
                  {ts instanceof Date && !isNaN(ts.getTime())
                    ? ts.toLocaleTimeString()
                    : String(entry.timestamp)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={levelVariant[entry.level] || "outline"}
                    className="text-xs"
                  >
                    {entry.level.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.source || "-"}
                </TableCell>
                <TableCell className="max-w-[400px] truncate">
                  {entry.message}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
