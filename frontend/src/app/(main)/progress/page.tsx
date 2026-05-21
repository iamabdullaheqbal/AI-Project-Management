"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useProjects, useDashboard } from "@/lib/queries";
import { CardSkeleton, ChartSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";

function ProjectCard({ projectId, name, description }: { projectId: string; name: string; description?: string }) {
  const { data: dash, isLoading } = useDashboard(projectId);

  if (isLoading) return <CardSkeleton />;
  if (!dash) return null;

  const daysLeft = 30; // Could be derived from project due_date when added to model

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">{name}</h3>
        <Badge variant="outline" className="text-xs">{dash.completion}%</Badge>
      </div>
      {description && <p className="text-xs text-muted-foreground mt-1 truncate">{description}</p>}
      <Progress value={dash.completion} className="mt-3" />
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Tasks done</p><p className="font-medium">{dash.done}/{dash.total}</p></div>
        <div><p className="text-xs text-muted-foreground">In progress</p><p className="font-medium">{dash.inProgress}</p></div>
        <div><p className="text-xs text-muted-foreground">Blocked</p><p className="font-medium">{dash.blocked}</p></div>
      </div>
    </Card>
  );
}

export default function ProgressPage() {
  const { data: projects, isLoading } = useProjects();

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Progress tracker</h1>
        <p className="mt-1 text-muted-foreground">Project health and velocity at a glance.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton /><CardSkeleton />
        </div>
      ) : !projects || projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create a project to start tracking progress." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard key={p.id} projectId={p.id} name={p.name} description={p.description} />
          ))}
        </div>
      )}

      {projects && projects.length > 0 && (
        <BurndownSection projectId={projects[0].id} />
      )}
    </div>
  );
}

function BurndownSection({ projectId }: { projectId: string }) {
  const { data: dash, isLoading } = useDashboard(projectId);

  // Build a simple burndown from current stats
  // In a real app this would come from a dedicated /dashboard/{id}/burndown endpoint
  const burndown = dash ? [
    { day: "Start", planned: dash.total, actual: dash.total },
    { day: "Now", planned: Math.round(dash.total * 0.5), actual: dash.total - dash.done },
    { day: "Target", planned: 0, actual: null },
  ] : [];

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="font-serif text-xl font-semibold">Burndown</h2>
        <p className="text-sm text-muted-foreground">Remaining tasks over time</p>
      </div>
      {isLoading ? <ChartSkeleton height={288} /> : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={burndown}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip contentStyle={{ background: "white", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="planned" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
