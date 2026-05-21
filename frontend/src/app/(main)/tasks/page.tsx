"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, Tag, Gauge, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, useProjects, type Task } from "@/lib/queries";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

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

interface TaskForm {
  title: string;
  description: string;
  complexity: number;
  tag: string;
  status: Status;
  due_date: string;
}

const emptyForm = (): TaskForm => ({
  title: "", description: "", complexity: 3, tag: "", status: "todo", due_date: "",
});

export default function TasksPage() {
  const { data: projects } = useProjects();
  const projectId = projects?.[0]?.id ?? "";
  const { data: tasks = [], isLoading } = useTasks(projectId);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [filterLabel, setFilterLabel] = useState("all");
  const [filterTag, setFilterTag] = useState("all");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<TaskForm>(emptyForm());

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState<TaskForm>(emptyForm());

  // Detail dialog
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const tags = useMemo(() => Array.from(new Set(tasks.map((t) => t.tag).filter(Boolean))), [tasks]);
  const filtered = tasks.filter((t) =>
    (filterLabel === "all" || t.priority_label === filterLabel) &&
    (filterTag === "all" || t.tag === filterTag),
  );

  const handleCreate = () => {
    if (!createForm.title.trim() || !projectId) return;
    createTask.mutate({
      project_id: projectId,
      title: createForm.title,
      description: createForm.description || undefined,
      complexity: createForm.complexity,
      tag: createForm.tag || undefined,
      status: createForm.status,
      due_date: createForm.due_date ? new Date(createForm.due_date).toISOString() : undefined,
    });
    setCreateOpen(false);
    setCreateForm(emptyForm());
  };

  const openEdit = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      complexity: task.complexity,
      tag: task.tag ?? "",
      status: task.status as Status,
      due_date: task.due_date ? task.due_date.slice(0, 10) : "",
    });
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!editingTask || !editForm.title.trim()) return;
    updateTask.mutate({
      id: editingTask.id,
      title: editForm.title,
      description: editForm.description || undefined,
      complexity: editForm.complexity,
      tag: editForm.tag || undefined,
      status: editForm.status,
      due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : undefined,
    });
    setEditOpen(false);
    setEditingTask(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteTask.mutate(deleteTarget.id, {
      onSuccess: () => toast.success("Task deleted"),
    });
    setDeleteTarget(null);
    if (detailTask?.id === deleteTarget.id) setDetailTask(null);
  };

  const TaskFormFields = ({ form, setForm }: { form: TaskForm; setForm: (f: TaskForm) => void }) => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Title <span className="text-destructive">*</span></Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Add more context…"
          rows={3}
          className="resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Complexity (1–5)</Label>
          <Select value={String(form.complexity)} onValueChange={(v) => setForm({ ...form, complexity: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tag</Label>
          <Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="e.g. Backend" />
        </div>
        <div className="space-y-1.5">
          <Label>Due date</Label>
          <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="mt-1 text-muted-foreground">Plan, prioritize, and ship work across the team.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={!projectId}><Plus className="h-4 w-4 mr-1" /> Add task</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">New task</DialogTitle>
              <DialogDescription>Add a task to the board.</DialogDescription>
            </DialogHeader>
            <TaskFormFields form={createForm} setForm={setCreateForm} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!createForm.title.trim() || createTask.isPending}>
                {createTask.isPending ? "Creating…" : "Create task"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by</span>
        <Select value={filterLabel} onValueChange={setFilterLabel}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {["critical","high","medium","low"].map((p) => (
              <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
            ))}
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

      {/* Kanban board */}
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
                    <Card
                      key={t.id}
                      onClick={() => setDetailTask(t)}
                      className={`p-3 hover:shadow-md transition-shadow cursor-pointer border-l-4 ${columnAccent[t.status as Status]}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug flex-1">{t.title}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className={`${priorityClass(t.priority_label)} text-[10px]`}>
                            {t.priority_label.toUpperCase()}
                          </Badge>
                          {/* Actions menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={(e) => openEdit(t, e)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        {t.tag && <><Tag className="h-3 w-3" /><span>{t.tag}</span></>}
                        <span className="ml-auto inline-flex items-center gap-1 font-mono text-primary">
                          <Gauge className="h-3 w-3" /> {t.priority_score.toFixed(2)}
                        </span>
                      </div>
                      {t.due_date && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
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
      <Dialog open={!!detailTask} onOpenChange={(o) => !o && setDetailTask(null)}>
        <DialogContent className="max-w-lg">
          {detailTask && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`${priorityClass(detailTask.priority_label)} text-[10px]`}>
                      {detailTask.priority_label.toUpperCase()}
                    </Badge>
                    {detailTask.tag && <span className="text-xs text-muted-foreground">{detailTask.tag}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="sm"
                      onClick={(e) => { openEdit(detailTask, e); setDetailTask(null); }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => { setDeleteTarget(detailTask); setDetailTask(null); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
                <DialogTitle className="font-serif text-xl">{detailTask.title}</DialogTitle>
                <DialogDescription>{detailTask.description ?? "No description provided."}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><p className="text-muted-foreground">Status</p><p className="font-medium mt-0.5 capitalize">{detailTask.status.replace("_", " ")}</p></div>
                <div><p className="text-muted-foreground">Complexity</p><p className="font-medium mt-0.5">{detailTask.complexity}/5</p></div>
                <div><p className="text-muted-foreground">Due</p><p className="font-medium mt-0.5">{detailTask.due_date ? new Date(detailTask.due_date).toLocaleDateString() : "—"}</p></div>
              </div>
              {detailTask.score && (
                <div className="mt-2 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Priority score breakdown</p>
                    <span className="font-mono text-lg text-primary">{detailTask.score.final.toFixed(2)}</span>
                  </div>
                  {[
                    { label: "Urgency", value: detailTask.score.urgency, weight: "40%" },
                    { label: "Complexity", value: detailTask.score.complexity, weight: "25%" },
                    { label: "Blocking", value: detailTask.score.blocking, weight: "20%" },
                    { label: "Staleness", value: detailTask.score.staleness, weight: "15%" },
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

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditingTask(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit task</DialogTitle>
            <DialogDescription>Update the task details.</DialogDescription>
          </DialogHeader>
          <TaskFormFields form={editForm} setForm={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!editForm.title.trim() || updateTask.isPending}>
              {updateTask.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong> will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
