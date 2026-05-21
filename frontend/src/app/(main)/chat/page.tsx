"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, User, Wifi, WifiOff, ChevronDown, FolderOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  getSocket, onSocketMessage, onSocketStatus,
  sendSocketMessage, disconnectSocket, isSocketConnected,
} from "@/lib/socket";
import { useChatStore } from "@/stores/chat";
import { useChatHistory, useProjects, type Project } from "@/lib/queries";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SUGGESTIONS = [
  "What is blocking deployment?",
  "What should the team focus on today?",
  "Which tasks are critical and why?",
  "Summarize this week's progress",
  "Who has the most tasks?",
];

export default function ChatPage() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Auto-select first project when projects load
  useEffect(() => {
    if (projects && projects.length > 0 && !activeProject) {
      setActiveProject(projects[0]);
    }
  }, [projects, activeProject]);

  const projectId = activeProject?.id ?? "";

  const { messages, typing, addMessage, setMessages, setTyping } = useChatStore();
  const history = useChatHistory(projectId);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const list = messages[projectId] ?? [];

  // Hydrate from history when project changes
  useEffect(() => {
    if (!projectId) return;
    if (history.data && (messages[projectId]?.length ?? 0) === 0) {
      const seed = history.data.length > 0
        ? history.data
        : [{
            id: "intro",
            role: "assistant" as const,
            content: `Hi — I'm FlowMind. I'm ready to help with **${activeProject?.name ?? "your project"}**. Ask me about tasks, blockers, priorities, or team workload.`,
            timestamp: Date.now(),
          }];
      setMessages(projectId, seed);
    }
  }, [history.data, projectId, messages, setMessages, activeProject?.name]);

  // WebSocket — reconnect when project changes
  useEffect(() => {
    if (!projectId) return;

    setConnected(false);

    try {
      getSocket(projectId);
    } catch {
      return;
    }

    if (isSocketConnected()) setConnected(true);

    const unsubStatus = onSocketStatus((status) => {
      setConnected(status === "open");
    });

    const unsubMsg = onSocketMessage((payload) => {
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
      unsubStatus();
      unsubMsg();
      disconnectSocket();
    };
  }, [projectId, addMessage, setTyping]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [list, typing]);

  const switchProject = (project: Project) => {
    disconnectSocket();
    setConnected(false);
    setActiveProject(project);
  };

  const send = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || typing || !projectId) return;

    addMessage(projectId, { id: `m${Date.now()}`, role: "user", content, timestamp: Date.now() });
    setInput("");
    setTyping(true);

    const sent = sendSocketMessage({ content, project_id: projectId });

    if (!sent) {
      setTimeout(() => {
        setTyping(false);
        addMessage(projectId, {
          id: `m${Date.now() + 1}`,
          role: "assistant",
          content: "I'm in offline mode — make sure the FastAPI backend is running at localhost:8000.",
          timestamp: Date.now(),
        });
      }, 700);
    } else {
      setTimeout(() => setTyping(false), 12000);
    }
  };

  if (!projectsLoading && (!projects || projects.length === 0)) {
    return (
      <div className="p-6 lg:p-8">
        <EmptyState
          title="No projects yet"
          description="Create a project first, then come back to chat with your AI assistant."
          action={
            <Link href="/">
              <button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
                Go to Dashboard
              </button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">

      {/* Header with project selector */}
      <div className="border-b border-border bg-card/40 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl font-semibold">FlowMind Assistant</h1>
            <p className="text-xs text-muted-foreground">Real-time AI · project-aware</p>
          </div>

          {/* Project selector */}
          {projects && projects.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted transition max-w-[200px]">
                  <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate font-medium">{activeProject?.name ?? "Select project"}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {projects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => switchProject(p)}
                    className={`flex items-center gap-2 ${p.id === projectId ? "bg-accent" : ""}`}
                  >
                    <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">{p.name}</p>
                      {p.description && (
                        <p className="truncate text-xs text-muted-foreground">{p.description}</p>
                      )}
                    </div>
                    {p.id === projectId && (
                      <span className="ml-auto text-[10px] text-primary font-medium">Active</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Connection status */}
          <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border shrink-0 ${
            connected
              ? "border-success/30 bg-success/10 text-success"
              : "border-muted-foreground/20 bg-muted text-muted-foreground"
          }`}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Active project info bar */}
        {activeProject && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{activeProject.name}</span>
            {activeProject.description && (
              <>
                <span>·</span>
                <span className="truncate">{activeProject.description}</span>
              </>
            )}
            <span className="ml-auto">
              {list.length > 1 ? `${list.length - 1} message${list.length === 2 ? "" : "s"}` : "New conversation"}
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
          {list.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
              <Card className={`max-w-[80%] px-4 py-3 text-sm ${
                m.role === "user" ? "bg-primary text-primary-foreground border-primary" : "prose prose-sm max-w-none"
              }`}>
                {m.role === "assistant" ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-sm">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      h1: ({ children }) => <h1 className="font-serif text-base font-semibold mb-1">{children}</h1>,
                      h2: ({ children }) => <h2 className="font-serif text-sm font-semibold mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="font-semibold text-sm mb-1">{children}</h3>,
                      code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                ) : (
                  m.content
                )}
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

      {/* Input */}
      <div className="border-t border-border bg-card/40 px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={!projectId}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={projectId ? `Ask about ${activeProject?.name ?? "your project"}…` : "Select a project to start chatting"}
              className="flex-1"
              disabled={!projectId}
            />
            <Button type="submit" disabled={typing || !projectId}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
