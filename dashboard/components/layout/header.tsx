"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import { ConnectionStatusIndicator } from "./connection-status-indicator";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="ml-auto flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger>
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-2 text-green-400 border-green-400/30 cursor-default"
            >
              PII sanitizer active
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="text-xs space-y-1 max-w-[220px]">
              <p className="font-medium">PII Sanitizer Plugin</p>
              <p>
                Strips emails, phones, IPs from tool results.
                Content showing ＠ or [REDACTED_EMAIL] is sanitized.
              </p>
              <p className="text-green-400">Zero 403 content filter errors.</p>
            </div>
          </TooltipContent>
        </Tooltip>
        <ConnectionStatusIndicator />
        <ThemeToggle />
      </div>
    </header>
  );
}
