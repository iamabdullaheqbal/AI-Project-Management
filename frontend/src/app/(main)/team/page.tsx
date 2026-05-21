"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useProjectTeam, useInviteMember, useUpdateMemberRole,
  useRemoveMember, useProjects, TEAM_ROLES, type Member,
} from "@/lib/queries";
import { CardSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { Users, UserPlus, MoreHorizontal, Pencil, Trash2, Crown } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const roleColor = (role: string) => {
  switch (role) {
    case "Owner": return "bg-primary/10 text-primary border-primary/20";
    case "Manager": return "bg-purple-100 text-purple-700 border-purple-200";
    case "Developer": return "bg-blue-100 text-blue-700 border-blue-200";
    case "Designer": return "bg-pink-100 text-pink-700 border-pink-200";
    case "QA": return "bg-orange-100 text-orange-700 border-orange-200";
    case "DevOps": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "Analyst": return "bg-teal-100 text-teal-700 border-teal-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export default function TeamPage() {
  const user = useAuthStore((s) => s.user);
  const { data: projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const projectId = selectedProjectId || projects?.[0]?.id || "";
  const selectedProject = projects?.find((p) => p.id === projectId);

  const { data: team, isLoading } = useProjectTeam(projectId);
  const inviteMember = useInviteMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Member");

  const [editMember, setEditMember] = useState<Member | null>(null);
  const [editRole, setEditRole] = useState("Member");

  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !projectId) return;
    await inviteMember.mutateAsync({ project_id: projectId, email: inviteEmail.trim(), team_role: inviteRole });
    toast.success(`${inviteEmail} added to the team`);
    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole("Member");
  };

  const handleUpdateRole = async () => {
    if (!editMember) return;
    await updateRole.mutateAsync({ projectId, memberId: editMember.id, team_role: editRole });
    toast.success("Role updated");
    setEditMember(null);
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    await removeMember.mutateAsync({ projectId, memberId: removeTarget.id });
    toast.success(`${removeTarget.name} removed from team`);
    setRemoveTarget(null);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Team</h1>
          <p className="mt-1 text-muted-foreground">Manage members, roles, and workload.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Project selector */}
          {projects && projects.length > 1 && (
            <Select value={projectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setInviteOpen(true)} disabled={!projectId}>
            <UserPlus className="h-4 w-4 mr-1" /> Invite member
          </Button>
        </div>
      </div>

      {/* Project context */}
      {selectedProject && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{selectedProject.name}</span>
          {selectedProject.description && <><span>·</span><span>{selectedProject.description}</span></>}
          {team && <><span>·</span><span>{team.length} member{team.length === 1 ? "" : "s"}</span></>}
        </div>
      )}

      {/* Team grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : !team || team.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members yet"
          description="Invite teammates by email to collaborate on this project."
          action={
            <Button onClick={() => setInviteOpen(true)} disabled={!projectId}>
              <UserPlus className="h-4 w-4 mr-1" /> Invite member
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m) => {
            const pct = Math.round((m.assigned / m.capacity) * 100);
            const isMe = m.user_id === user?.id;
            return (
              <Card key={m.id} className="p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary font-semibold text-sm">
                      {initials(m.name)}
                    </div>
                    {m.team_role === "Owner" && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Crown className="h-3 w-3" />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {m.name} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                      {/* Actions — only show for non-self members */}
                      {!isMe && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditMember(m); setEditRole(m.team_role); }}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Change role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setRemoveTarget(m)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <Badge variant="outline" className={`mt-2 text-[10px] ${roleColor(m.team_role)}`}>
                      {m.team_role}
                    </Badge>
                  </div>
                </div>

                {/* Workload */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Workload</span>
                    <span className="font-medium">{m.assigned} / {m.capacity} tasks</span>
                  </div>
                  <Progress value={pct} />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {pct >= 90 ? "At capacity" : pct >= 70 ? "Heavily loaded" : "Has bandwidth"}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Invite team member</DialogTitle>
            <DialogDescription>
              Enter the email of a registered FlowMind user to add them to{" "}
              <strong>{selectedProject?.name ?? "this project"}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEAM_ROLES.filter((r) => r !== "Owner").map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The user must already have a FlowMind account.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviteMember.isPending}
            >
              {inviteMember.isPending ? "Inviting…" : "Add to team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit role dialog */}
      <Dialog open={!!editMember} onOpenChange={(o) => !o && setEditMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Change role</DialogTitle>
            <DialogDescription>
              Update the role for <strong>{editMember?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEAM_ROLES.filter((r) => r !== "Owner").map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
            <Button onClick={handleUpdateRole} disabled={updateRole.isPending}>
              {updateRole.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removeTarget?.name}</strong> will be removed from{" "}
              <strong>{selectedProject?.name}</strong>. They will lose access to this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemove}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
