"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LogFilterState } from "@/lib/types";

interface LogFiltersProps {
  filters: LogFilterState;
  onFilterChange: (filters: LogFilterState) => void;
}

export function LogFilters({ filters, onFilterChange }: LogFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Select
          value={filters.source}
          onValueChange={(v) => v && onFilterChange({ ...filters, source: v })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="github">GitHub</SelectItem>
            <SelectItem value="model">Model</SelectItem>
            <SelectItem value="heartbeat">Heartbeat</SelectItem>
            <SelectItem value="queue">Queue</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.dateRange}
          onValueChange={(v) =>
            v && onFilterChange({
              ...filters,
              dateRange: v as LogFilterState["dateRange"],
            })
          }
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search logs..."
          value={filters.search}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          className="w-[200px]"
        />
      </div>

      <Tabs
        value={filters.level}
        onValueChange={(v: string | null) =>
          v && onFilterChange({
            ...filters,
            level: v as LogFilterState["level"],
          })
        }
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="warn">Warning</TabsTrigger>
          <TabsTrigger value="error">Error</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
