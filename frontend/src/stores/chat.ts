import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatState {
  messages: Record<string, ChatMessage[]>;
  typing: boolean;
  setMessages: (projectId: string, messages: ChatMessage[]) => void;
  addMessage: (projectId: string, message: ChatMessage) => void;
  setTyping: (typing: boolean) => void;
  clear: (projectId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  typing: false,
  setMessages: (projectId, messages) =>
    set((s) => ({ messages: { ...s.messages, [projectId]: messages } })),
  addMessage: (projectId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [projectId]: [...(s.messages[projectId] ?? []), message],
      },
    })),
  setTyping: (typing) => set({ typing }),
  clear: (projectId) =>
    set((s) => ({ messages: { ...s.messages, [projectId]: [] } })),
}));
