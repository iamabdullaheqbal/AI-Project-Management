import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { initials, priorityClass } from "@/lib/mock-data";
import { useDashboard, useCriticalTasks, useBlockers, useTeam } from "@/lib/queries";
import { CheckCircle2, Clock, AlertTriangle, ListTodo, Sparkles, Calendar, ShieldAlert } from "lucide-react";
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { CardSkeleton, ChartSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — FlowMind" },
      { name: "description", content: "Overview of tasks, team activity, and weekly progress." },
    ],
  }),
  component: Dashboard,
});

function Metric({ label, value, icon: Icon, hint, tone }: { label: string; value: string; icon: any; hint: string; tone: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 font-serif text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function Dashboard() {
  const { data: dash, isLoading: dashLoading } = useDashboard();
  const { data: critical, isLoading: critLoading } = useCriticalTasks();
  const { data: blockers, isLoading: blkLoading } = useBlockers();
  const { data: team, isLoading: teamLoading } = useTeam();

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const completion = dash?.completion ?? 0;
  const radial = [{ name: "Done", value: completion, fill: "var(--color-primary)" }];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" /> {today}
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Welcome back, Alex</h1>
          <p className="mt-1 text-muted-foreground">Here's how the team is doing today.</p>
        </div>
        <Card className="max-w-xl p-4 bg-accent/50 border-primary/15">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">AI tip of the day</p>
              <p className="text-sm mt-1">
                {dash && dash.overdue + dash.blocked > 0
                  ? `You have ${dash.overdue} overdue and ${dash.blocked} blocked task${dash.blocked === 1 ? "" : "s"}. Clear blockers before starting new work.`
                  : "All clear — a great day to ship something new."}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashLoading || !dash ? (
          <>
            <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
          </>
        ) : (
          <>
            <Metric label="Total Tasks" value={String(dash.total)} icon={ListTodo} hint="Across all projects" tone="bg-accent text-primary" />
            <Metric label="Completed" value={String(dash.done)} icon={CheckCircle2} hint="This week" tone="bg-success/10 text-success" />
            <Metric label="In Progress" value={String(dash.inProgress)} icon={Clock} hint="Active right now" tone="bg-primary/10 text-primary" />
            <Metric label="Overdue" value={String(dash.overdue)} icon={AlertTriangle} hint="Needs attention" tone="bg-destructive/10 text-destructive" />
          </>
        )}
      </div>

      {/* Overdue / blocker alert */}
      {!blkLoading && blockers && blockers.length > 0 && (
        <Card className="p-4 border-destructive/30 bg-destructive/5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {blockers.length} task{blockers.length === 1 ? "" : "s"} need immediate attention
              </p>
              <p className="text-xs text-destructive/80 mt-0.5">
                {blockers.slice(0, 3).map((b) => b.title).join(" · ")}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Completion ring */}
        <Card className="p-6">
          <h2 className="font-serif text-xl font-semibold">Completion</h2>
          <p className="text-sm text-muted-foreground mb-4">Overall project progress</p>
          {dashLoading ? (
            <ChartSkeleton height={220} />
          ) : (
            <div className="relative h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={radial} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar background={{ fill: "var(--color-muted)" }} dataKey="value" cornerRadius={20} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-serif text-4xl font-semibold">{completion}%</span>
                <span className="text-xs text-muted-foreground">{dash?.done} / {dash?.total} done</span>
              </div>
            </div>
          )}
        </Card>

        {/* Team workload bar chart */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif text-xl font-semibold">Team workload</h2>
              <p className="text-sm text-muted-foreground">Assigned vs capacity</p>
            </div>
          </div>
          {teamLoading || !team ? (
            <ChartSkeleton />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={team} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" width={100} className="text-xs" tickFormatter={(n: string) => n.split(" ")[0]} />
                  <Tooltip contentStyle={{ background: "white", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Bar dataKey="capacity" fill="var(--color-muted)" radius={[0, 6, 6, 0]} />
                  <Bar dataKey="assigned" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Critical tasks feed */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif text-xl font-semibold">Critical tasks</h2>
            <p className="text-sm text-muted-foreground">Highest priority score</p>
          </div>
        </div>
        {critLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/60 rounded animate-pulse" />
            ))}
          </div>
        ) : !critical || critical.length === 0 ? (
          <EmptyState title="Nothing critical" description="You're all caught up — great work." />
        ) : (
          <div className="divide-y divide-border">
            {critical.map((t) => (
              <div key={t.id} className="flex items-center gap-4 py-3">
                <Badge variant="outline" className={`${priorityClass(t.priority)} font-medium text-[10px]`}>{t.priority}</Badge>
                <p className="flex-1 text-sm font-medium truncate">{t.title}</p>
                <span className="hidden sm:inline text-xs text-muted-foreground">{t.tag}</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-primary text-[10px] font-semibold" title={t.assignee}>
                  {initials(t.assignee)}
                </div>
                <span className="text-xs font-mono w-12 text-right text-primary">{t.score.final.toFixed(2)}</span>
                <span className={`text-xs w-20 text-right ${t.due === "Overdue" ? "text-destructive font-medium" : "text-muted-foreground"}`}>{t.due}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
