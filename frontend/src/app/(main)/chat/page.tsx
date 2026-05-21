"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, User, Wifi, WifiOff } from "lucide-react";
import { getSocket, onSocketMessage, sendSocketMessage, isSocketConnected, disconnectSocket } from "@/lib/socket";
import { useChatStore } from "@/stores/chat";
import { useChatHistory, useProjects } from "@/lib/queries";

const SUGGESTIONS = [
  "What is blocking deployment?",
  "What should the team focus on today?",
  "Which tasks are critical and why?",
  "Summarize this week's progress",
  "Who has the most tasks?",
];

export default function ChatPage() {
  const { data: projects } = useProjects();
  const projectId = projects?.[0]?.id ?? "";
  const { messages, typing, addMessage, setMessages, setTyping } = useChatStore();
  const history = useChatHistory(projectId);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const list = messages[projectId] ?? [];

  // Hydrate from history once
  useEffect(() => {
    if (history.data && (messages[projectId]?.length ?? 0) === 0) {
      const seed = history.data.length > 0
        ? history.data
        : [{ id: "intro", role: "assistant" as const, content: "Hi — I'm FlowMind. Ask me about your project's priorities, blockers, or team load.", timestamp: Date.now() }];
      setMessages(projectId, seed);
    }
  }, [history.data, projectId, messages, setMessages]);

  // WebSocket lifecycle
  useEffect(() => {
    const ws = getSocket(projectId);

    const onOpen = () => setConnected(true);
    const onClose = () => setConnected(false);

    ws.addEventListener("open", onOpen);
    ws.addEventListener("close", onClose);

    // Check if already open
    if (ws.readyState === WebSocket.OPEN) setConnected(true);

    const unsub = onSocketMessage((payload) => {
      if (payload.type === "typing") {
        setTyping(true);
      } else if (payload.type === "message" && payload.content) {
        setTyping(false);
        addMessage(projectId, {
          id: `m${Date.now()}`,
          role: "assistant",
          content: payload.content,
          timestamp: Date.now(),
        });
      }
    });

    return () => {
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("close", onClose);
      unsub();
      disconnectSocket();
    };
  }, [projectId, addMessage, setTyping]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [list, typing]);

  const send = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || typing) return;

    addMessage(projectId, { id: `m${Date.now()}`, role: "user", content, timestamp: Date.now() });
    setInput("");
    setTyping(true);

    const sent = sendSocketMessage({ content, project_id: projectId });

    if (!sent) {
      // Offline fallback
      setTimeout(() => {
        setTyping(false);
        addMessage(projectId, {
          id: `m${Date.now() + 1}`,
          role: "assistant",
          content: "I'm in offline mode — start the FastAPI backend at localhost:8000 for live responses.",
          timestamp: Date.now(),
        });
      }, 700);
    } else {
      // Failsafe timeout
      setTimeout(() => setTyping(false), 12000);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-b border-border bg-card/40 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="font-serif text-xl font-semibold">FlowMind Assistant</h1>
            <p className="text-xs text-muted-foreground">Real-time AI · project-aware</p>
          </div>
          <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${connected ? "border-success/30 bg-success/10 text-success" : "border-muted-foreground/20 bg-muted text-muted-foreground"}`}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
          {list.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
              <Card className={`max-w-[80%] px-4 py-3 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                {m.content}
              </Card>
              {m.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {typing && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              <Card className="px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </Card>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-border bg-card/40 px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition">
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about tasks, priorities, or progress…" className="flex-1" />
            <Button type="submit" disabled={typing}><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}
