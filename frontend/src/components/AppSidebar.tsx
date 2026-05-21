"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, KanbanSquare, Sparkles, LineChart,
  Users, Settings, LogOut, PanelLeft,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { initials } from "@/lib/mock-data";
import { useState } from "react";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Tasks", url: "/tasks", icon: KanbanSquare },
  { title: "AI Assistant", url: "/chat", icon: Sparkles },
  { title: "Progress", url: "/progress", icon: LineChart },
  { title: "Team", url: "/team", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 h-screen sticky top-0 border-r border-border bg-sidebar transition-all duration-200",
        collapsed ? "w-14" : "w-56",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-serif text-base font-semibold">FlowMind</span>
              <span className="text-[10px] text-muted-foreground">AI Project OS</span>
            </div>
          </Link>
        )}
        {collapsed && (
          <Link href="/" className="mx-auto">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition shrink-0",
            collapsed && "mx-auto",
          )}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {!collapsed && (
          <p className="px-2 mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
        )}
        {items.map((item) => (
          <Link
            key={item.title}
            href={item.url}
            title={collapsed ? item.title : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
              isActive(item.url)
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <SidebarUser collapsed={collapsed} />
    </aside>
  );
}

function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  if (!user) return null;

  return (
    <div className="border-t border-border p-2">
      <div className={cn("flex items-center gap-2 rounded-lg bg-muted/50 p-2", collapsed && "justify-center")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
          {initials(user.name)}
        </div>
        {!collapsed && (
          <>
            <div className="flex flex-col leading-tight min-w-0 flex-1">
              <span className="text-sm font-medium truncate">{user.name}</span>
              <span className="text-xs text-muted-foreground truncate">{user.role}</span>
            </div>
            <button
              onClick={() => { logout(); router.push("/login"); }}
              className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground transition"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
