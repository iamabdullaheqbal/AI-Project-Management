"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useTeam } from "@/lib/queries";
import { initials } from "@/lib/mock-data";
import { CardSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { Users } from "lucide-react";

const statusDot = (s: string) =>
  s === "Active" ? "bg-success" : s === "Busy" ? "bg-destructive" : "bg-warning";

const statusBadge = (s: string) =>
  s === "Active"
    ? "bg-success/10 text-success border-success/20"
    : s === "Busy"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-warning/15 text-warning-foreground border-warning/30";

export default function TeamPage() {
  const { data: team, isLoading } = useTeam();

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-muted-foreground">Roles, workload, and availability across the team.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !team || team.length === 0 ? (
        <EmptyState icon={Users} title="No team members yet" description="Invite teammates to start collaborating." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m) => {
            const pct = Math.round((m.assigned / m.capacity) * 100);
            return (
              <Card key={m.id} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary font-serif text-lg font-semibold">
                      {initials(m.name)}
                    </div>
                    <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-card ${statusDot(m.status)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium truncate">{m.name}</h3>
                      <Badge variant="outline" className={`${statusBadge(m.status)} text-[10px]`}>{m.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{m.role}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.assigned} active tasks</p>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Workload</span>
                    <span className="font-medium">{m.assigned} / {m.capacity} tasks</span>
                  </div>
                  <Progress value={pct} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {pct >= 90 ? "At capacity" : pct >= 70 ? "Heavily loaded" : "Has bandwidth"}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
