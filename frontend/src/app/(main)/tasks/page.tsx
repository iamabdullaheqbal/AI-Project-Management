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
import { initials, priorityClass, type Task, type Priority, type Status } from "@/lib/mock-data";
import { useTasks, useCreateTask } from "@/lib/queries";
import { EmptyState } from "@/components/EmptyState";

const COLUMNS: Status[] = ["Todo", "In Progress", "Done", "Blocked"];
const columnAccent: Record<Status, string> = {
  "Todo": "border-l-muted-foreground/30",
  "In Progress": "border-l-primary",
  "Done": "border-l-success",
  "Blocked": "border-l-destructive",
};

export default function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const createTask = useCreateTask();
  const [priority, setPriority] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [tag, setTag] = useState("all");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Task | null>(null);
  const [form, setForm] = useState({
    title: "",
    assignee: "Alex Morgan",
    priority: "MEDIUM" as Priority,
    due: "This week",
    tag: "General",
    status: "Todo" as Status,
  });

  const assignees = useMemo(() => Array.from(new Set(tasks.map((t) => t.assignee))), [tasks]);
  const tags = useMemo(() => Array.from(new Set(tasks.map((t) => t.tag))), [tasks]);
  const filtered = tasks.filter((t) =>
    (priority === "all" || t.priority === priority) &&
    (assignee === "all" || t.assignee === assignee) &&
    (tag === "all" || t.tag === tag),
  );

  const submit = () => {
    if (!form.title.trim()) return;
    createTask.mutate({ ...form, score: { urgency: 0.5, complexity: 0.4, blocking: 0.3, staleness: 0.2, final: 0.4 } });
    setOpen(false);
    setForm({ ...form, title: "" });
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
            <Button><Plus className="h-4 w-4 mr-1" /> Add task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">New task</DialogTitle>
              <DialogDescription>Add a task to the board.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Assignee</Label>
                  <Select value={form.assignee} onValueChange={(v) => setForm({ ...form, assignee: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{assignees.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(["CRITICAL","HIGH","MEDIUM","LOW"] as Priority[]).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Due</Label><Input value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Tag</Label><Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></div>
                <div className="space-y-1.5 col-span-2"><Label>Column</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COLUMNS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by</span>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {(["CRITICAL","HIGH","MEDIUM","LOW"] as Priority[]).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {assignees.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {tasks.length} tasks</span>
      </Card>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = filtered.filter((t) => t.status === col);
          return (
            <div key={col} className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{col}</h3>
                <span className="text-xs text-muted-foreground rounded-full bg-muted px-2 py-0.5">{items.length}</span>
              </div>
              <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3 min-h-[200px]">
                {isLoading ? (
                  <div className="h-24 rounded bg-muted animate-pulse" />
                ) : items.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-8">No tasks</div>
                ) : (
                  items.map((t) => (
                    <Card key={t.id} onClick={() => setActive(t)} className={`p-3 hover:shadow-md transition-shadow cursor-pointer border-l-4 ${columnAccent[t.status]}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{t.title}</p>
                        <Badge variant="outline" className={`${priorityClass(t.priority)} shrink-0 text-[10px]`}>{t.priority}</Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Tag className="h-3 w-3" /> <span>{t.tag}</span>
                        <span className="ml-auto inline-flex items-center gap-1 font-mono text-primary">
                          <Gauge className="h-3 w-3" /> {t.score.final.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-primary text-[10px] font-semibold" title={t.assignee}>
                          {initials(t.assignee)}
                        </div>
                        <span className={`flex items-center gap-1 text-xs ${t.due === "Overdue" ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          <Calendar className="h-3 w-3" /> {t.due}
                        </span>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-lg">
          {active && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={`${priorityClass(active.priority)} text-[10px]`}>{active.priority}</Badge>
                  <span className="text-xs text-muted-foreground">{active.tag}</span>
                </div>
                <DialogTitle className="font-serif text-xl">{active.title}</DialogTitle>
                <DialogDescription>{active.description ?? "No description provided."}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><p className="text-muted-foreground">Assignee</p><p className="font-medium mt-0.5">{active.assignee}</p></div>
                <div><p className="text-muted-foreground">Status</p><p className="font-medium mt-0.5">{active.status}</p></div>
                <div><p className="text-muted-foreground">Due</p><p className={`font-medium mt-0.5 ${active.due === "Overdue" ? "text-destructive" : ""}`}>{active.due}</p></div>
              </div>
              <div className="mt-2 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Priority score breakdown</p>
                  <span className="font-mono text-lg text-primary">{active.score.final.toFixed(2)}</span>
                </div>
                {[
                  { label: "Urgency", value: active.score.urgency, weight: "40%" },
                  { label: "Blocking", value: active.score.blocking, weight: "30%" },
                  { label: "Staleness", value: active.score.staleness, weight: "20%" },
                  { label: "Complexity", value: active.score.complexity, weight: "10%" },
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
