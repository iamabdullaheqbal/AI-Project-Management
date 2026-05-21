import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types (matching backend TaskOut / MemberWorkloadOut shapes)
// ---------------------------------------------------------------------------

export interface PriorityBreakdown {
  urgency: number;
  complexity: number;
  blocking: number;
  staleness: number;
  final: number;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  assignee_id?: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  priority_score: number;
  priority_label: "low" | "medium" | "high" | "critical";
  due_date?: string;
  complexity: number;
  dependencies: string[];
  tag?: string;
  created_at: string;
  updated_at: string;
  score?: PriorityBreakdown;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  status: string;
  assigned: number;
  capacity: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
  blocked: number;
  completion: number;
  total_tasks: number;
  todo_count: number;
  in_progress_count: number;
  done_count: number;
  blocked_count: number;
  completion_percentage: number;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const useProjects = () =>
  useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => (await api.get("/projects")).data,
    staleTime: 0,
    refetchOnMount: true,
  });

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      api.post<Project>("/projects", body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
    onError: () => toast.error("Failed to create project"),
  });
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const useTasks = (projectId: string) =>
  useQuery<Task[]>({
    queryKey: ["tasks", projectId],
    queryFn: async () => (await api.get(`/tasks/${projectId}`)).data,
    staleTime: 30_000,
    enabled: !!projectId,
  });

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: Partial<Task> & { project_id: string }) =>
      api.post<Task>("/tasks", task).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Failed to create task"),
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Task> & { id: string }) =>
      api.put<Task>(`/tasks/${id}`, patch).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tasks", data.project_id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Failed to update task"),
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Failed to delete task"),
  });
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const useDashboard = (projectId: string) =>
  useQuery<DashboardStats>({
    queryKey: ["dashboard", projectId],
    queryFn: async () => (await api.get(`/dashboard/${projectId}`)).data,
    staleTime: 30_000,
    enabled: !!projectId,
  });

export const useCriticalTasks = (projectId: string) =>
  useQuery<Task[]>({
    queryKey: ["dashboard", projectId, "critical"],
    queryFn: async () => (await api.get(`/dashboard/${projectId}/critical`)).data,
    staleTime: 30_000,
    enabled: !!projectId,
  });

export const useBlockers = (projectId: string) =>
  useQuery<Task[]>({
    queryKey: ["dashboard", projectId, "blockers"],
    queryFn: async () => (await api.get(`/dashboard/${projectId}/blockers`)).data,
    staleTime: 30_000,
    enabled: !!projectId,
  });

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export const useTeam = () =>
  useQuery<Member[]>({
    queryKey: ["team"],
    queryFn: async () => (await api.get("/team")).data,
    staleTime: 60_000,
  });

// ---------------------------------------------------------------------------
// Chat history
// ---------------------------------------------------------------------------

export const useChatHistory = (projectId: string) =>
  useQuery({
    queryKey: ["chat", projectId],
    queryFn: async () =>
      (await api.get(`/chat/history/${projectId}`)).data as Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        timestamp: number;
      }>,
    enabled: !!projectId,
  });
