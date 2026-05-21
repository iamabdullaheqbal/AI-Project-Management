import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export const Route = createFileRoute("/progress")({
  head: () => ({ meta: [{ title: "Progress — FlowMind" }] }),
  component: ProgressPage,
});

const projects = [
  { name: "Mobile App v2", progress: 72, done: 28, total: 39, daysLeft: 12, team: 6 },
  { name: "Marketing Site Refresh", progress: 45, done: 9, total: 20, daysLeft: 21, team: 4 },
  { name: "Analytics Pipeline", progress: 88, done: 22, total: 25, daysLeft: 5, team: 3 },
  { name: "Design System v3", progress: 30, done: 6, total: 20, daysLeft: 34, team: 5 },
];

const burndown = [
  { day: "W1", planned: 40, actual: 40 },
  { day: "W2", planned: 32, actual: 35 },
  { day: "W3", planned: 24, actual: 28 },
  { day: "W4", planned: 16, actual: 20 },
  { day: "W5", planned: 8, actual: 12 },
  { day: "W6", planned: 0, actual: 5 },
];

const milestones = [
  { label: "Kickoff", date: "Jun 1", state: "done" },
  { label: "Design Review", date: "Jun 18", state: "done" },
  { label: "Alpha Build", date: "Jul 10", state: "done" },
  { label: "Beta Launch", date: "Aug 22", state: "current" },
  { label: "GA Release", date: "Sep 30", state: "upcoming" },
];

function ProgressPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Progress tracker</h1>
        <p className="mt-1 text-muted-foreground">Project health, velocity, and milestones at a glance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.name} className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold">{p.name}</h3>
              <Badge variant="outline" className="text-xs">{p.progress}%</Badge>
            </div>
            <Progress value={p.progress} className="mt-3" />
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Tasks done</p><p className="font-medium">{p.done}/{p.total}</p></div>
              <div><p className="text-xs text-muted-foreground">Days left</p><p className="font-medium">{p.daysLeft}</p></div>
              <div><p className="text-xs text-muted-foreground">Team</p><p className="font-medium">{p.team} people</p></div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="mb-4">
          <h2 className="font-serif text-xl font-semibold">Burndown</h2>
          <p className="text-sm text-muted-foreground">Planned vs actual remaining work</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={burndown}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip contentStyle={{ background: "white", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="planned" stroke="var(--muted-foreground)" strokeDasharray="5 5" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="actual" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-serif text-xl font-semibold">Milestones</h2>
        <p className="text-sm text-muted-foreground mb-6">Roadmap timeline</p>
        <div className="relative">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-border" />
          <div className="relative grid grid-cols-5 gap-2">
            {milestones.map((m) => {
              const Icon = m.state === "done" ? CheckCircle2 : m.state === "current" ? Clock : Circle;
              const color = m.state === "done" ? "text-success bg-success/10" : m.state === "current" ? "text-primary bg-primary/10 ring-4 ring-primary/15" : "text-muted-foreground bg-muted";
              return (
                <div key={m.label} className="flex flex-col items-center text-center">
                  <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mt-2 text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.date}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
