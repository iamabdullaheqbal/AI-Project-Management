import { API_BASE_URL } from "./api";

// Convert http(s) base URL to ws(s)
const WS_BASE = API_BASE_URL.replace(/^http/, "ws");

let socket: WebSocket | null = null;
let currentProjectId: string | null = null;

type MessageHandler = (payload: { type: string; content?: string }) => void;
const handlers: Set<MessageHandler> = new Set();

export function getSocket(projectId: string): WebSocket {
  if (socket && socket.readyState === WebSocket.OPEN && currentProjectId === projectId) {
    return socket;
  }

  disconnectSocket();

  currentProjectId = projectId;
  socket = new WebSocket(`${WS_BASE}/ws/chat/${projectId}`);

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
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

export function sendSocketMessage(payload: object) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

export function isSocketConnected(): boolean {
  return socket !== null && socket.readyState === WebSocket.OPEN;
}

export function disconnectSocket() {
  if (socket) {
    socket.close();
    socket = null;
    currentProjectId = null;
  }
}
