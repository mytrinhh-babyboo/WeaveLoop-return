import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
  footer?: ReactNode;
}

export function StatCard({ label, value, unit, icon: Icon, hint, tone = "default", footer }: StatCardProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1.5 flex items-baseline gap-1 text-2xl font-semibold tracking-tight text-foreground">
              <span className="tabular-nums">{value}</span>
              {unit ? <span className="text-sm font-normal text-muted-foreground">{unit}</span> : null}
            </p>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          <div
            className={cn(
              "rounded-md p-2",
              tone === "default" && "bg-primary-soft text-primary-dark",
              tone === "warning" && "bg-warning-soft text-warning",
              tone === "danger" && "bg-destructive/10 text-destructive",
              tone === "success" && "bg-success-soft text-success",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-7 w-28" />
        <Skeleton className="mt-2 h-3 w-32" />
      </CardContent>
    </Card>
  );
}
