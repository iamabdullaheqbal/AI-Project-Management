"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, Tag, Gauge } from "lucide-react";
import { useTasks, useCreateTask, useProjects, type Task } from "@/lib/queries";
import { EmptyState } from "@/components/EmptyState";

type Status = "todo" | "in_progress" | "done" | "blocked";

const COLUMNS: { key: Status; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
  { key: "blocked", label: "Blocked" },
];

const columnAccent: Record<Status, string> = {
  todo: "border-l-muted-foreground/30",
  in_progress: "border-l-primary",
  done: "border-l-success",
  blocked: "border-l-destructive",
};

function priorityClass(label: string) {
  switch (label) {
    case "critical": return "bg-destructive/12 text-destructive border-destructive/25";
    case "high": return "bg-orange-100 text-orange-700 border-orange-200";
    case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    default: return "bg-green-100 text-green-700 border-green-200";
  }
}

export default function TasksPage() {
  const { data: projects } = useProjects();
  const projectId = projects?.[0]?.id ?? "";
  const { data: tasks = [], isLoading } = useTasks(projectId);
  const createTask = useCreateTask();

  const [filterLabel, setFilterLabel] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Task | null>(null);
  const [form, setForm] = useState({
    title: "",
    complexity: 3,
    tag: "",
    status: "todo" as Status,
  });

  const tags = useMemo(() => Array.from(new Set(tasks.map((t) => t.tag).filter(Boolean))), [tasks]);

  const filtered = tasks.filter((t) =>
    (filterLabel === "all" || t.priority_label === filterLabel) &&
    (filterTag === "all" || t.tag === filterTag),
  );

  const submit = () => {
    if (!form.title.trim() || !projectId) return;
    createTask.mutate({
      project_id: projectId,
      title: form.title,
      complexity: form.complexity,
      tag: form.tag || undefined,
      status: form.status,
    });
    setOpen(false);
    setForm({ title: "", complexity: 3, tag: "", status: "todo" });
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-1 text-muted-foreground">Plan, prioritize, and ship work across the team.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!projectId}><Plus className="h-4 w-4 mr-1" /> Add task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">New task</DialogTitle>
              <DialogDescription>Add a task to the board.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Complexity (1-5)</Label>
                  <Select value={String(form.complexity)} onValueChange={(v) => setForm({ ...form, complexity: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Column</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Tag</Label>
                  <Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="e.g. Backend, Design" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={createTask.isPending}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by</span>
        <Select value={filterLabel} onValueChange={setFilterLabel}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {["critical","high","medium","low"].map((p) => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map((t) => <SelectItem key={t!} value={t!}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {tasks.length} tasks</span>
      </Card>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map(({ key, label }) => {
          const items = filtered.filter((t) => t.status === key);
          return (
            <div key={key} className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{label}</h3>
                <span className="text-xs text-muted-foreground rounded-full bg-muted px-2 py-0.5">{items.length}</span>
              </div>
              <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3 min-h-[200px]">
                {isLoading ? (
                  <div className="h-24 rounded bg-muted animate-pulse" />
                ) : items.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-8">No tasks</div>
                ) : (
                  items.map((t) => (
                    <Card key={t.id} onClick={() => setActive(t)} className={`p-3 hover:shadow-md transition-shadow cursor-pointer border-l-4 ${columnAccent[t.status as Status]}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{t.title}</p>
                        <Badge variant="outline" className={`${priorityClass(t.priority_label)} shrink-0 text-[10px]`}>{t.priority_label.toUpperCase()}</Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        {t.tag && <><Tag className="h-3 w-3" /><span>{t.tag}</span></>}
                        <span className="ml-auto inline-flex items-center gap-1 font-mono text-primary">
                          <Gauge className="h-3 w-3" /> {t.priority_score.toFixed(2)}
                        </span>
                      </div>
                      {t.due_date && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(t.due_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task detail modal */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-lg">
          {active && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={`${priorityClass(active.priority_label)} text-[10px]`}>{active.priority_label.toUpperCase()}</Badge>
                  {active.tag && <span className="text-xs text-muted-foreground">{active.tag}</span>}
                </div>
                <DialogTitle className="font-serif text-xl">{active.title}</DialogTitle>
                <DialogDescription>{active.description ?? "No description provided."}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><p className="text-muted-foreground">Status</p><p className="font-medium mt-0.5">{active.status.replace("_", " ")}</p></div>
                <div><p className="text-muted-foreground">Complexity</p><p className="font-medium mt-0.5">{active.complexity}/5</p></div>
                <div><p className="text-muted-foreground">Due</p><p className="font-medium mt-0.5">{active.due_date ? new Date(active.due_date).toLocaleDateString() : "—"}</p></div>
              </div>
              {active.score && (
                <div className="mt-2 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Priority score breakdown</p>
                    <span className="font-mono text-lg text-primary">{active.score.final.toFixed(2)}</span>
                  </div>
                  {[
                    { label: "Urgency", value: active.score.urgency, weight: "40%" },
                    { label: "Blocking", value: active.score.blocking, weight: "20%" },
                    { label: "Staleness", value: active.score.staleness, weight: "15%" },
                    { label: "Complexity", value: active.score.complexity, weight: "25%" },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{s.label} <span className="text-[10px]">· w {s.weight}</span></span>
                        <span className="font-mono">{s.value.toFixed(2)}</span>
                      </div>
                      <Progress value={s.value * 100} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
