import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary" | "secondary";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info-soft text-info border-info/20",
  primary: "bg-primary-soft text-primary-dark border-primary/20",
  secondary: "bg-secondary/10 text-secondary border-secondary/20",
};

const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  // Bags
  ISSUED: { label: "Issued", tone: "info" },
  ACTIVE: { label: "Active", tone: "primary" },
  CLOSED: { label: "Closed", tone: "neutral" },
  // Custody
  PENDING: { label: "Pending", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  // Collection points
  INACTIVE: { label: "Inactive", tone: "neutral" },
  // Documents
  UPLOADED: { label: "Uploaded", tone: "info" },
  CLEAN: { label: "Scan clean", tone: "success" },
  INFECTED: { label: "Scan infected", tone: "danger" },
  ERROR: { label: "Scan error", tone: "danger" },
  PENDING_REVIEW: { label: "Awaiting review", tone: "warning" },
  // Reviews
  REVIEW_ACCEPTED: { label: "Accepted", tone: "success" },
  REVIEW_REJECTED: { label: "Rejected", tone: "danger" },
  // EPR
  DRAFT: { label: "Draft — internal only", tone: "warning" },
  REQUEST_CHANGES: { label: "Changes requested", tone: "warning" },
  READY_FOR_VERIFICATION: { label: "Ready for verification", tone: "info" },
  // Lots
  AVAILABLE: { label: "Available", tone: "success" },
  PARTIALLY_CONSUMED: { label: "Partially consumed", tone: "warning" },
  CONSUMED: { label: "Consumed", tone: "neutral" },
  // Consistency
  CONSISTENT: { label: "Mass consistent", tone: "success" },
  DISCREPANCY: { label: "Mass discrepancy", tone: "danger" },
  EVIDENCE_INCOMPLETE: { label: "Evidence incomplete", tone: "warning" },
  REVIEW_PENDING: { label: "Internal review pending", tone: "warning" },
};

export function StatusBadge({ status, className, labelOverride }: { status: string; className?: string; labelOverride?: string }) {
  const mapped = STATUS_MAP[status] ?? { label: status.replaceAll("_", " ").toLowerCase(), tone: "neutral" as Tone };
  return (
    <Badge variant="outline" className={cn("font-medium", TONES[mapped.tone], className)}>
      {labelOverride ?? mapped.label}
    </Badge>
  );
}
