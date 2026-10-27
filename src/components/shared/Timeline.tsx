import { cn } from "@/lib/utils";

export interface TimelineEntry {
  title: string;
  actor?: string;
  timestamp: string;
  detail?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}

const DOT: Record<NonNullable<TimelineEntry["tone"]>, string> = {
  default: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
};

/** Vertical operational timeline (custody, weighing, review history). */
export function Timeline({ entries, className }: { entries: TimelineEntry[]; className?: string }) {
  if (entries.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted-foreground">No events recorded yet.</p>;
  }
  return (
    <ol className={cn("relative space-y-5 border-l border-border pl-5", className)}>
      {entries.map((entry, i) => (
        <li key={i} className="relative">
          <span
            className={cn("absolute -left-[25.5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-card", DOT[entry.tone ?? "default"])}
            aria-hidden
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-sm font-medium text-foreground">{entry.title}</p>
            <time className="text-xs text-muted-foreground tabular-nums">
              {new Date(entry.timestamp).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </time>
          </div>
          {entry.actor ? <p className="text-xs text-muted-foreground">by {entry.actor}</p> : null}
          {entry.detail ? <p className="mt-1 text-xs text-muted-foreground">{entry.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}
