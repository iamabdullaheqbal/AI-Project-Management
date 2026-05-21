import { API_BASE_URL } from "./api";
import { useAuthStore } from "@/stores/auth";

const WS_BASE = API_BASE_URL.replace(/^https?/, (m) => (m === "https" ? "wss" : "ws"));

let socket: WebSocket | null = null;
let currentProjectId: string | null = null;

type MessageHandler = (payload: { type: string; content?: string; commands?: unknown[] }) => void;
const handlers: Set<MessageHandler> = new Set();

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
  // Token passed as query param — required by backend WS auth
  socket = new WebSocket(`${WS_BASE}/ws/chat/${projectId}?token=${encodeURIComponent(token)}`);

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);
      handlers.forEach((h) => h(data));
    } catch {
      // ignore malformed messages
    }
  };

  socket.onerror = () => {
    handlers.forEach((h) => h({ type: "error", content: "Connection error" }));
  };

  return socket;
}

export function onSocketMessage(handler: MessageHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
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
    socket.close();
    socket = null;
    currentProjectId = null;
  }
}
