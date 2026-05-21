import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";

let socket: Socket | null = null;

export function getSocket(projectId: string): Socket {
  if (socket && socket.connected) return socket;
  // ws://localhost:8000/ws/chat/{project_id}
  socket = io(`${API_BASE_URL}/ws/chat/${projectId}`, {
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 3,
    timeout: 4000,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
