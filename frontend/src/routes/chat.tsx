import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, User, Wifi, WifiOff } from "lucide-react";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { useChatStore } from "@/stores/chat";
import { useChatHistory, DEFAULT_PROJECT_ID } from "@/lib/queries";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "AI Assistant — FlowMind" }] }),
  component: ChatPage,
});

const SUGGESTIONS = [
  "What is blocking deployment?",
  "What should the team focus on today?",
  "Which tasks are critical and why?",
  "Summarize this week's progress",
  "Who has the most tasks?",
];

function mockReply(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("block")) return "Two deployment blockers right now:\n\n1. **Database backups** — nightly job has failed 3 nights running. Daniel Park is on it.\n2. **API rate limiting** — awaiting platform team sign-off on the Redis cluster.\n\nUnblocking these clears the critical path to release.";
  if (p.includes("focus") || p.includes("today")) return "Top focus for today:\n\n• Resolve the **production payment outage** (score 0.91)\n• Push the **beta launch** invites — currently overdue\n• Sara to finalize the onboarding redesign for tomorrow's review";
  if (p.includes("critical")) return "Three tasks have a priority score above 0.85:\n\n1. **Fix production payment outage** (0.91) — high urgency, blocking revenue\n2. **Launch beta to design partners** (0.92) — overdue, high staleness\n3. **Database backups not running** (0.89) — critical infra risk";
  if (p.includes("week") || p.includes("progress")) return "This week the team closed **12 tasks**, against a planned 14. Velocity is healthy. Two items slipped:\n\n• Pricing experiment (now Done)\n• Migrate analytics pipeline (in progress, on track for Thursday)\n\nOverall sprint completion: **72%**.";
  if (p.includes("most tasks") || p.includes("who")) return "Daniel Park has the heaviest load right now: **9 of 10 capacity**, with 2 blocked items. Consider redistributing the analytics migration if more critical work lands.";
  return "I'm running in offline demo mode — connect the FastAPI backend at ws://localhost:8000 to get live answers grounded in your project data.";
}

function ChatPage() {
  const projectId = DEFAULT_PROJECT_ID;
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
        : [{ id: "intro", role: "assistant" as const, content: "Hi Alex — I'm FlowMind. Ask me about your project's priorities, blockers, or team load.", timestamp: Date.now() }];
      setMessages(projectId, seed);
    }
  }, [history.data, projectId, messages, setMessages]);

  // Socket lifecycle
  useEffect(() => {
    const socket = getSocket(projectId);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onMessage = (payload: { content: string }) => {
      setTyping(false);
      addMessage(projectId, {
        id: `m${Date.now()}`,
        role: "assistant",
        content: payload.content,
        timestamp: Date.now(),
      });
    };
    const onTyping = () => setTyping(true);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("message", onMessage);
    socket.on("typing", onTyping);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("message", onMessage);
      socket.off("typing", onTyping);
      disconnectSocket();
    };
  }, [projectId, addMessage, setTyping]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [list, typing]);

  const send = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || typing) return;
    addMessage(projectId, {
      id: `m${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    });
    setInput("");
    setTyping(true);

    const socket = getSocket(projectId);
    if (socket.connected) {
      socket.emit("message", { content, project_id: projectId });
      // Failsafe: drop typing if no reply in 12s
      setTimeout(() => setTyping(false), 12000);
    } else {
      // Offline fallback so the UI is usable in preview
      setTimeout(() => {
        setTyping(false);
        addMessage(projectId, {
          id: `m${Date.now() + 1}`,
          role: "assistant",
          content: mockReply(content),
          timestamp: Date.now(),
        });
      }, 700);
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
          <span
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${connected ? "border-success/30 bg-success/10 text-success" : "border-muted-foreground/20 bg-muted text-muted-foreground"}`}
            title={connected ? "Socket connected" : "Offline — using demo replies"}
          >
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
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition"
              >
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about tasks, priorities, or progress…"
              className="flex-1"
            />
            <Button type="submit" disabled={typing}><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}
