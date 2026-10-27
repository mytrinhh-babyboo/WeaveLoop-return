import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Upload } from "lucide-react";
import { PageHeader, ErrorState, EmptyState } from "@/components/shared/StateViews";
import { EvidenceViewer } from "@/components/shared/EvidenceViewer";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recyclers } from "@/lib/api";
import { useAppSession } from "@/lib/app-session";
import type { RecyclerDocument } from "@/lib/api/types";

export const Route = createFileRoute("/recycling/documents")({
  head: () => ({
    meta: [
      { title: "Evidence Review — WeaveLoop" },
      { name: "description", content: "Human review of recycler documents with separate malware-scan and review states." },
      { property: "og:title", content: "Evidence Review — WeaveLoop" },
      { property: "og:description", content: "Separate scan and human review states for recycler evidence documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EvidenceReviewPage,
});

function EvidenceReviewPage() {
  const { activeOrg, role } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const qc = useQueryClient();

  const documents = useQuery({
    queryKey: ["documents-pending", orgId],
    queryFn: () => recyclers.listPendingReviewDocuments(orgId),
    enabled: !!orgId,
  });

  const [note, setNote] = useState<Record<string, string>>({});
  const review = useMutation({
    mutationFn: ({ docId, decision }: { docId: string; decision: "ACCEPTED" | "REJECTED" }) =>
      recyclers.reviewDocument(orgId, docId, decision, note[docId] || undefined),
    onSuccess: (doc) => {
      toast.success(`Document ${doc.reviewStatus.toLowerCase()}`, {
        description: doc.reviewStatus === "ACCEPTED" ? "The document is now usable as supporting evidence." : "The document is rejected and cannot support any claim.",
      });
      qc.invalidateQueries({ queryKey: ["documents-pending"] });
      qc.invalidateQueries({ queryKey: ["recycler-receipts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error("Could not record review", { description: err instanceof Error ? err.message : undefined }),
  });

  const finalize = useMutation({
    mutationFn: (docId: string) => recyclers.finalizeUpload(orgId, docId),
    onSuccess: () => {
      toast.success("Upload finalized", { description: "The malware scan completed for this document." });
      qc.invalidateQueries({ queryKey: ["documents-pending"] });
    },
    onError: (err) => toast.error("Could not finalize upload", { description: err instanceof Error ? err.message : undefined }),
  });

  return (

    <div className="space-y-4">
      <PageHeader
        title="Evidence Review Center"
        description="Scan status and human review are separate checks. A clean scan means the file passed the technical scan only — it never proves authenticity or that recycling occurred."
      />

      {role === "VIEWER" ? (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
          Your role ({role}) is read-only: reviews can be inspected but not recorded.
        </p>
      ) : null}

      {documents.isError ? (
        <Card><ErrorState error={documents.error} onRetry={() => documents.refetch()} /></Card>
      ) : documents.isLoading ? (
        <Card><CardContent className="space-y-3 p-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}</CardContent></Card>
      ) : (documents.data?.length ?? 0) === 0 ? (
        <Card><EmptyState title="No documents awaiting review" description="Every linked document has been scanned and reviewed, or nothing is linked yet." icon={ClipboardCheck} /></Card>
      ) : (
        <>
          <StatesBanner docs={documents.data} />
          <div className="grid gap-4 lg:grid-cols-2">
            {(documents.data ?? []).map((doc: RecyclerDocument) => (
              <Card key={doc.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm">{doc.fileName}</CardTitle>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge status={doc.status} />
                      <StatusBadge status={doc.scanStatus} />
                      <StatusBadge status={doc.reviewStatus} />
                    </div>
                  </div>
                  <CardDescription>Linked to recycler receipt · uploaded by {doc.uploadedByName ?? "—"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {doc.scanStatus === "PENDING" ? (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-info-soft px-3 py-2 text-xs text-info-foreground">
                      <span>Malware scan pending — human review is blocked until the scan completes.</span>
                      <PermissionGate capability="write">
                        <Button size="sm" variant="outline" onClick={() => finalize.mutate(doc.id)} disabled={finalize.isPending}>
                          <Upload className="mr-2 h-3.5 w-3.5" /> Finalize upload
                        </Button>
                      </PermissionGate>
                    </div>
                  ) : doc.reviewStatus === "PENDING_REVIEW" ? (
                    <PermissionGate
                      capability="review"
                      fallback={<p className="text-xs text-muted-foreground">Your role ({role}) cannot record review decisions. Required: OWNER, ADMIN or AUDITOR.</p>}
                    >
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label htmlFor={`note-${doc.id}`}>Review note</Label>
                          <Textarea
                            id={`note-${doc.id}`}
                            rows={2}
                            value={note[doc.id] ?? ""}
                            onChange={(e) => setNote({ ...note, [doc.id]: e.target.value })}
                            placeholder="Matches weighbridge record… (required when rejecting)"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => review.mutate({ docId: doc.id, decision: "ACCEPTED" })}
                            disabled={review.isPending}
                          >
                            Accept as evidence
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            onClick={() => review.mutate({ docId: doc.id, decision: "REJECTED" })}
                            disabled={review.isPending || !(note[doc.id] ?? "").trim()}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </PermissionGate>
                  ) : null}
                  <EvidenceViewer documents={[doc]} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function splitByState(docs: RecyclerDocument[] | undefined) {
  const list = docs ?? [];
  return {
    pendingScan: list.filter((d) => d.scanStatus === "PENDING"),
    pendingReview: list.filter((d) => d.scanStatus !== "PENDING" && d.reviewStatus === "PENDING_REVIEW"),
    problem: list.filter((d) => d.scanStatus === "INFECTED" || d.scanStatus === "ERROR"),
  };
}

function StatesBanner({ docs }: { docs: RecyclerDocument[] | undefined }) {
  const { pendingScan, pendingReview, problem } = splitByState(docs);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Awaiting malware scan</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{pendingScan.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Review blocked until scan completes</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Awaiting human review</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{pendingReview.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Scan finished; human judgment pending</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Infected / scan errors</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">{problem.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Can never be accepted as evidence</p>
        </CardContent>
      </Card>
    </div>
  );
}
