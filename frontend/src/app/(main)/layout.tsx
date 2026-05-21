"use client";

import { AppSidebar } from "@/components/AppSidebar";
import { AuthGuard } from "@/components/AuthGuard";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {/* suppressHydrationWarning tolerates browser-extension injected nodes (e.g. screen-reader sections) */}
      <div className="flex min-h-screen w-full" suppressHydrationWarning>
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4">
            <div className="h-5 w-px bg-border" />
            <span className="text-sm text-muted-foreground">FlowMind workspace</span>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">All systems operational</span>
              <span className="h-2 w-2 rounded-full bg-success" />
            </div>
          </header>
          <main className="flex-1 page-fade">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
