import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, withMockFallback } from "./api";
import { initialTasks, team, type Task } from "./mock-data";

export const DEFAULT_PROJECT_ID = "default";

// ---------- TASKS ----------
export const useTasks = (projectId: string = DEFAULT_PROJECT_ID) =>
  useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () =>
      withMockFallback<Task[]>(
        async () => (await api.get(`/tasks/${projectId}`)).data,
        () => initialTasks,
      ),
    staleTime: 30_000,
  });

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: Partial<Task>) =>
      withMockFallback<Task>(
        async () => (await api.post("/tasks", task)).data,
        () => ({ ...(task as Task), id: `t${Date.now()}` }),
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      // optimistic local insert when offline
      qc.setQueryData<Task[]>(["tasks", DEFAULT_PROJECT_ID], (old = []) => [
        { ...(vars as Task), id: `t${Date.now()}` } as Task,
        ...old,
      ]);
    },
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Task> & { id: string }) =>
      withMockFallback<Task>(
        async () => (await api.put(`/tasks/${id}`, patch)).data,
        () => ({ ...(patch as Task), id }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
};

// ---------- DASHBOARD ----------
export const useDashboard = (projectId: string = DEFAULT_PROJECT_ID) =>
  useQuery({
    queryKey: ["dashboard", projectId],
    queryFn: () =>
      withMockFallback(
        async () => (await api.get(`/dashboard/${projectId}`)).data,
        () => {
          const total = initialTasks.length;
          const done = initialTasks.filter((t) => t.status === "Done").length;
          const inProgress = initialTasks.filter((t) => t.status === "In Progress").length;
          const overdue = initialTasks.filter((t) => t.due === "Overdue").length;
          const blocked = initialTasks.filter((t) => t.status === "Blocked").length;
          return {
            total,
            done,
            inProgress,
            overdue,
            blocked,
            completion: Math.round((done / total) * 100),
          };
        },
      ),
    staleTime: 30_000,
  });

export const useCriticalTasks = (projectId: string = DEFAULT_PROJECT_ID) =>
  useQuery({
    queryKey: ["dashboard", projectId, "critical"],
    queryFn: () =>
      withMockFallback<Task[]>(
        async () => (await api.get(`/dashboard/${projectId}/critical`)).data,
        () =>
          [...initialTasks]
            .sort((a, b) => b.score.final - a.score.final)
            .slice(0, 6),
      ),
    staleTime: 30_000,
  });

export const useBlockers = (projectId: string = DEFAULT_PROJECT_ID) =>
  useQuery({
    queryKey: ["dashboard", projectId, "blockers"],
    queryFn: () =>
      withMockFallback<Task[]>(
        async () => (await api.get(`/dashboard/${projectId}/blockers`)).data,
        () => initialTasks.filter((t) => t.status === "Blocked" || t.due === "Overdue"),
      ),
    staleTime: 30_000,
  });

// ---------- TEAM ----------
import type { Member } from "./mock-data";
export const useTeam = () =>
  useQuery({
    queryKey: ["team"],
    queryFn: () =>
      withMockFallback<Member[]>(
        async () => (await api.get("/team")).data,
        () => team,
      ),
    staleTime: 60_000,
  });

// ---------- CHAT HISTORY ----------
export const useChatHistory = (projectId: string = DEFAULT_PROJECT_ID) =>
  useQuery({
    queryKey: ["chat", projectId],
    queryFn: () =>
      withMockFallback(
        async () => (await api.get(`/chat/history/${projectId}`)).data,
        () => [] as Array<{ id: string; role: "user" | "assistant"; content: string; timestamp: number }>,
      ),
  });
