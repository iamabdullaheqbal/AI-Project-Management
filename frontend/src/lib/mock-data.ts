export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Status = "Todo" | "In Progress" | "Done" | "Blocked";

export interface PriorityBreakdown {
  urgency: number;
  complexity: number;
  blocking: number;
  staleness: number;
  final: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignee: string;
  priority: Priority;
  due: string;
  tag: string;
  status: Status;
  score: PriorityBreakdown;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  status: "Active" | "Away" | "Busy";
  assigned: number;
  capacity: number;
}

const mk = (u: number, c: number, b: number, s: number): PriorityBreakdown => {
  const final = +(u * 0.4 + b * 0.3 + s * 0.2 + c * 0.1).toFixed(2);
  return { urgency: u, complexity: c, blocking: b, staleness: s, final };
};

export const initialTasks: Task[] = [
  { id: "t1", title: "Fix production payment outage", description: "Stripe webhooks failing for EU customers since 14:00 UTC.", assignee: "Alex Morgan", priority: "CRITICAL", due: "Today", tag: "Incident", status: "In Progress", score: mk(0.98, 0.7, 0.95, 0.6) },
  { id: "t2", title: "Redesign onboarding flow", description: "Reduce step count from 6 to 3, add progress indicator.", assignee: "Sara Chen", priority: "HIGH", due: "Tomorrow", tag: "Design", status: "In Progress", score: mk(0.78, 0.6, 0.55, 0.3) },
  { id: "t3", title: "API rate limiting blocked by infra review", description: "Awaiting platform team sign-off on Redis cluster.", assignee: "Daniel Park", priority: "HIGH", due: "Fri", tag: "Backend", status: "Blocked", score: mk(0.82, 0.65, 0.85, 0.7) },
  { id: "t4", title: "Marketing site copy refresh", description: "Rewrite hero + features for the new positioning.", assignee: "Mia Patel", priority: "LOW", due: "Next Mon", tag: "Marketing", status: "Todo", score: mk(0.3, 0.4, 0.15, 0.2) },
  { id: "t5", title: "Launch beta to design partners", description: "Send invites + onboarding kit to 12 partners.", assignee: "Alex Morgan", priority: "CRITICAL", due: "Overdue", tag: "Launch", status: "In Progress", score: mk(0.99, 0.55, 0.9, 0.95) },
  { id: "t6", title: "Migrate analytics pipeline", description: "Cut over from Segment to in-house event bus.", assignee: "Daniel Park", priority: "MEDIUM", due: "Thu", tag: "Data", status: "In Progress", score: mk(0.55, 0.8, 0.4, 0.3) },
  { id: "t7", title: "User interview synthesis", description: "Synthesize findings from 8 interviews into themes.", assignee: "Sara Chen", priority: "MEDIUM", due: "Wed", tag: "Research", status: "Todo", score: mk(0.6, 0.5, 0.35, 0.5) },
  { id: "t8", title: "Brand guidelines v2", description: "Updated typography, color, and motion principles.", assignee: "Mia Patel", priority: "LOW", due: "Aug 30", tag: "Brand", status: "Done", score: mk(0.2, 0.3, 0.1, 0.1) },
  { id: "t9", title: "Setup CI for mobile app", description: "EAS build + TestFlight auto-publish on main.", assignee: "Daniel Park", priority: "HIGH", due: "Tomorrow", tag: "DevOps", status: "Todo", score: mk(0.75, 0.6, 0.6, 0.4) },
  { id: "t10", title: "Pricing page experiment", description: "A/B test simplified tiers, 50/50 split.", assignee: "Mia Patel", priority: "MEDIUM", due: "Aug 28", tag: "Growth", status: "Done", score: mk(0.5, 0.4, 0.25, 0.2) },
  { id: "t11", title: "Database backups not running", description: "Nightly snapshot job failed 3 nights in a row.", assignee: "Daniel Park", priority: "CRITICAL", due: "Today", tag: "Infra", status: "Blocked", score: mk(0.95, 0.7, 0.92, 0.85) },
  { id: "t12", title: "Quarterly OKR review prep", description: "Compile metrics + narrative for leadership review.", assignee: "Alex Morgan", priority: "MEDIUM", due: "Sep 5", tag: "Strategy", status: "Todo", score: mk(0.5, 0.5, 0.3, 0.25) },
];

export const team: Member[] = [
  { id: "m1", name: "Alex Morgan", role: "Product Lead", status: "Active", assigned: 8, capacity: 10 },
  { id: "m2", name: "Sara Chen", role: "Design Lead", status: "Busy", assigned: 6, capacity: 8 },
  { id: "m3", name: "Daniel Park", role: "Staff Engineer", status: "Active", assigned: 9, capacity: 10 },
  { id: "m4", name: "Mia Patel", role: "Growth Marketer", status: "Away", assigned: 4, capacity: 8 },
  { id: "m5", name: "Jordan Lee", role: "QA Engineer", status: "Active", assigned: 5, capacity: 9 },
  { id: "m6", name: "Riya Shah", role: "Data Analyst", status: "Busy", assigned: 7, capacity: 8 },
];

export const initials = (name: string) =>
  name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

export const priorityClass = (p: Priority) => {
  switch (p) {
    case "CRITICAL":
      return "bg-destructive/12 text-destructive border-destructive/25";
    case "HIGH":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "MEDIUM":
      return "bg-warning/15 text-warning-foreground border-warning/30";
    case "LOW":
      return "bg-success/10 text-success border-success/20";
  }
};

export const statusClass = (s: Status) => {
  switch (s) {
    case "Todo":
      return "bg-muted text-muted-foreground";
    case "In Progress":
      return "bg-primary/10 text-primary";
    case "Done":
      return "bg-success/10 text-success";
    case "Blocked":
      return "bg-destructive/10 text-destructive";
  }
};
