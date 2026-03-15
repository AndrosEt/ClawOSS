"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type RoleFilter = "all" | "assistant" | "user" | "tool_call" | "tool_result" | "system" | "thinking";

interface MessageFiltersProps {
  activeFilter: RoleFilter;
  onFilterChange: (filter: RoleFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const FILTERS: { value: RoleFilter; label: string; color: string }[] = [
  { value: "all", label: "All", color: "text-foreground" },
  { value: "assistant", label: "Agent", color: "text-blue-400" },
  { value: "tool_call", label: "Tools", color: "text-yellow-400" },
  { value: "tool_result", label: "Results", color: "text-purple-400" },
  { value: "system", label: "System", color: "text-gray-400" },
  { value: "thinking", label: "Think", color: "text-orange-400" },
];

export function MessageFilters({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: MessageFiltersProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20 overflow-x-auto">
      <div className="flex items-center gap-1">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={activeFilter === f.value ? "default" : "ghost"}
            size="sm"
            className={`text-[10px] h-6 px-2 ${activeFilter !== f.value ? f.color : ""}`}
            onClick={() => onFilterChange(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <div className="ml-auto">
        <Input
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-6 text-xs w-40"
        />
      </div>
    </div>
  );
}
