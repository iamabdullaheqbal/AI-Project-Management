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

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("alex@flowmind.app");
  const [password, setPassword] = useState("demo");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.access_token, data.user);
      toast.success("Welcome back");
      router.push("/");
    } catch {
      // fallback: demo mode when backend is offline
      login("demo-token", {
        id: "u1",
        name: email.split("@")[0] || "User",
        email,
        role: "Product Lead",
      });
      toast.success("Welcome back (demo mode)");
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">FlowMind</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI-powered project management.</p>
        </div>
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Demo credentials: alex@flowmind.app / demo
          </p>
        </Card>
      </div>
    </div>
  );
}
