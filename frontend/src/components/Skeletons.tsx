import { Card } from "@/components/ui/card";

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <Card className={`p-5 animate-pulse ${className}`}>
      <div className="h-4 w-24 bg-muted rounded mb-3" />
      <div className="h-8 w-16 bg-muted rounded mb-2" />
      <div className="h-3 w-32 bg-muted rounded" />
    </Card>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 animate-pulse">
      <div className="h-5 w-16 bg-muted rounded" />
      <div className="h-4 flex-1 bg-muted rounded" />
      <div className="h-6 w-6 bg-muted rounded-full" />
    </div>
  );
}

export function ChartSkeleton({ height = 256 }: { height?: number }) {
  return (
    <div className="w-full animate-pulse rounded-lg bg-muted/60" style={{ height }} />
  );
}
