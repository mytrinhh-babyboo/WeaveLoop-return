import { FileWarning, ScanSearch, ShieldCheck, UserCheck } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { formatDateTime } from "@/lib/api/formatters";
import type { RecyclerDocument } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * EvidenceViewer renders a recycler document with its three independent
 * checks kept visibly separate: upload state, malware scan, and human review.
 * A clean scan never implies authenticity — the labels say so.
 */
export function EvidenceViewer({ documents, className }: { documents: RecyclerDocument[] | undefined; className?: string }) {
  if (!documents || documents.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No evidence documents linked. A recycling claim is incomplete without reviewed evidence.
      </p>
    );
  }
  return (
    <ul className={cn("space-y-3", className)}>
      {documents.map((doc) => (
        <li key={doc.id} className="rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileWarning className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate text-sm font-medium">{doc.fileName}</span>
              <span className="text-xs text-muted-foreground">{Math.round(doc.fileSizeBytes / 1024)} KB</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={doc.status} />
              <ScanBadge status={doc.scanStatus} />
              <StatusBadge status={doc.reviewStatus} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {doc.uploadedAt ? <span>Uploaded {formatDateTime(doc.uploadedAt)} · {doc.uploadedByName}</span> : <span>Awaiting upload finalization</span>}
            {doc.reviewedAt ? <span>Reviewed {formatDateTime(doc.reviewedAt)} · {doc.reviewedByName}</span> : null}
          </div>
          {doc.reviewNote ? <p className="mt-1.5 text-xs text-muted-foreground italic">“{doc.reviewNote}”</p> : null}
          {doc.scanStatus === "INFECTED" ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
              <ShieldCheck className="h-3.5 w-3.5" /> Malware scan flagged this file. It can never be used as evidence, regardless of review.
            </p>
          ) : null}
          {doc.scanStatus === "CLEAN" && doc.reviewStatus === "PENDING_REVIEW" ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5" /> A clean scan means the file passed the technical check only — human review is still required.
            </p>
          ) : null}
          {doc.scanStatus === "ERROR" ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
              <ScanSearch className="h-3.5 w-3.5" /> Scan failed — resubmit the document or contact an administrator.
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ScanBadge({ status }: { status: RecyclerDocument["scanStatus"] }) {
  const label = status === "PENDING" ? "Scan pending" : status === "CLEAN" ? "Scan clean" : status === "INFECTED" ? "Scan infected" : "Scan error";
  return <StatusBadge status={status} labelOverride={label} />;
}
