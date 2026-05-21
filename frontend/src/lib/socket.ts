import { API_BASE_URL } from "./api";
import { useAuthStore } from "@/stores/auth";

const WS_BASE = API_BASE_URL.replace(/^https?/, (m) => (m === "https" ? "wss" : "ws"));

let socket: WebSocket | null = null;
let currentProjectId: string | null = null;

type MessageHandler = (payload: { type: string; content?: string; commands?: unknown[] }) => void;
const handlers: Set<MessageHandler> = new Set();

type StatusHandler = (status: "open" | "close" | "error") => void;
const statusHandlers: Set<StatusHandler> = new Set();

export function getSocket(projectId: string): WebSocket {
  if (socket && socket.readyState === WebSocket.OPEN && currentProjectId === projectId) {
    return socket;
  }

  disconnectSocket();

  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error("Not authenticated");
  }

  currentProjectId = projectId;
  socket = new WebSocket(`${WS_BASE}/ws/chat/${projectId}?token=${encodeURIComponent(token)}`);

  socket.onopen = () => {
    statusHandlers.forEach((h) => h("open"));
  };

  socket.onclose = () => {
    statusHandlers.forEach((h) => h("close"));
  };

  // Absorb the native ErrorEvent — never let it propagate as an unhandled rejection
  socket.onerror = (_event: Event) => {
    statusHandlers.forEach((h) => h("error"));
    handlers.forEach((h) => h({ type: "error", content: "Connection error" }));
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);
      handlers.forEach((h) => h(data));
    } catch {
      // ignore malformed messages
    }
  };

  return socket;
}

export function onSocketMessage(handler: MessageHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function onSocketStatus(handler: StatusHandler): () => void {
  statusHandlers.add(handler);
  return () => statusHandlers.delete(handler);
}

export function sendSocketMessage(payload: object): boolean {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

export function isSocketConnected(): boolean {
  return socket !== null && socket.readyState === WebSocket.OPEN;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.close();
    socket = null;
    currentProjectId = null;
  }
}
