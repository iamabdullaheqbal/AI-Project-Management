"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Mode = "signup" | "login";

export default function AuthPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data } = await api.post("/auth/register", { name, email, password });
        login(data.access_token, data.refresh_token, data.user);
        toast.success("Account created — welcome to FlowMind!");
      } else {
        const { data } = await api.post("/auth/login", { email, password });
        login(data.access_token, data.refresh_token, data.user);
        toast.success("Welcome back");
      }
      router.push("/");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (mode === "signup" ? "Could not create account" : "Invalid credentials");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setName("");
    setEmail("");
    setPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">FlowMind</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI-powered project management.</p>
        </div>

        <Card className="p-6">
          {/* Tab switcher */}
          <div className="flex rounded-lg bg-muted p-1 mb-6">
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign in
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Alex Morgan"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={mode === "signup" ? 8 : 1}
              />
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? mode === "signup" ? "Creating account…" : "Signing in…"
                : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {mode === "signup" ? (
              <>Already have an account?{" "}
                <button type="button" onClick={() => switchMode("login")} className="underline hover:text-foreground">
                  Sign in
                </button>
              </>
            ) : (
              <>Don&apos;t have an account?{" "}
                <button type="button" onClick={() => switchMode("signup")} className="underline hover:text-foreground">
                  Sign up
                </button>
              </>
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}
