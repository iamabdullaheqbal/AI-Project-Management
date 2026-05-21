"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.token);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState(user?.role ?? "");
  const [email] = useState(user?.email ?? ""); // email is read-only
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState(["Design", "Engineering", "Marketing", "Research", "Operations"]);
  const [cat, setCat] = useState("");

  const { responseStyle, setResponseStyle } = useSettingsStore();

  const handleSaveProfile = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.put("/auth/me", { name: name.trim(), role: role.trim() });
      // Update the auth store so the sidebar and dashboard reflect the new name immediately
      if (token && refreshToken) {
        login(token, refreshToken, { ...data });
      }
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your profile, notifications, and AI preferences.</p>
      </div>

      <Card className="p-6">
        <h2 className="font-serif text-xl font-semibold mb-4">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} disabled className="opacity-60 cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSaveProfile} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-serif text-xl font-semibold mb-4">Notifications</h2>
        <div className="space-y-4">
          {[
            { label: "Task assignments", desc: "When someone assigns you a task", def: true },
            { label: "Mentions & comments", desc: "When you're @mentioned anywhere", def: true },
            { label: "Weekly digest", desc: "Sunday summary of activity", def: false },
            { label: "AI suggestions", desc: "Proactive insights from FlowMind", def: true },
          ].map((n) => (
            <div key={n.label} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <Switch defaultChecked={n.def} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-serif text-xl font-semibold mb-1">AI Assistant</h2>
        <p className="text-sm text-muted-foreground mb-4">Choose how FlowMind should respond.</p>
        <RadioGroup value={responseStyle} onValueChange={(v) => setResponseStyle(v as "concise" | "detailed")} className="grid sm:grid-cols-2 gap-3">
          {[
            { v: "concise", t: "Concise", d: "Short, actionable answers" },
            { v: "detailed", t: "Detailed", d: "Thorough analysis with context" },
          ].map((o) => (
            <label key={o.v} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${responseStyle === o.v ? "border-primary bg-accent/40" : "border-border"}`}>
              <RadioGroupItem value={o.v} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium">{o.t}</p>
                <p className="text-xs text-muted-foreground">{o.d}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </Card>

      <Card className="p-6">
        <h2 className="font-serif text-xl font-semibold mb-4">Project categories</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((c) => (
            <Badge key={c} variant="outline" className="gap-1 pl-3 pr-1.5 py-1 text-sm">
              {c}
              <button onClick={() => setCategories(categories.filter((x) => x !== c))} className="rounded-full p-0.5 hover:bg-muted">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); const v = cat.trim(); if (v && !categories.includes(v)) { setCategories([...categories, v]); setCat(""); } }} className="flex gap-2">
          <Input value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Add a category…" className="max-w-xs" />
          <Button type="submit" variant="outline"><Plus className="h-4 w-4 mr-1" />Add</Button>
        </form>
      </Card>
    </div>
  );
}
