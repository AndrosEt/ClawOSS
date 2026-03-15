"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitPullRequest,
  Activity,
  BarChart3,
  ScrollText,
  Settings,
  Radio,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { ConnectionStatusIndicator } from "./connection-status-indicator";

const navItems = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Live Feed", href: "/live", icon: Radio },
  { title: "Pull Requests", href: "/prs", icon: GitPullRequest },
  { title: "Health", href: "/health", icon: Activity },
  { title: "Quality", href: "/quality", icon: BarChart3 },
  { title: "Logs", href: "/logs", icon: ScrollText },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">ClawOSS</span>
        </div>
        <div className="mt-2">
          <ConnectionStatusIndicator />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          ClawOSS Monitoring Dashboard
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
