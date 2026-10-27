import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileSearch, ShieldQuestion } from "lucide-react";
import { PageHeader, ErrorState } from "@/components/shared/StateViews";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WeightDisplay } from "@/components/shared/WeightDisplay";
import { EvidenceViewer } from "@/components/shared/EvidenceViewer";
import { Timeline, type TimelineEntry } from "@/components/shared/Timeline";
import { PermissionGate, can } from "@/components/shared/PermissionGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { epr } from "@/lib/api";
import { formatDate, formatGrams } from "@/lib/api/formatters";
import type { EprDraft, Role } from "@/lib/api/types";

import { useAppSession } from "@/lib/app-session";

export const Route = createFileRoute("/epr/drafts/$draftId")({
  head: () => ({
    meta: [
      { title: "EPR Draft Detail — WeaveLoop" },
      { name: "description", content: "Draft information, internal review history, MRV trace view and mass consistency." },
      { property: "og:title", content: "EPR Draft Detail — WeaveLoop" },
      { property: "og:description", content: "Internal draft review, source trace and mass consistency — not regulatory approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EprDraftDetailPage,
});

function EprDraftDetailPage() {
  const { draftId } = Route.useParams();
  const { activeOrg, role, user } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const draft = useQuery({
    queryKey: ["epr-draft", orgId, draftId],
    queryFn: async () => {
      const drafts = await epr.listDrafts(orgId);
      return drafts.find((d) => d.id === draftId) ?? Promise.reject(new Error("EPR draft not found in this organization."));
    },
    enabled: !!orgId,
    retry: false,
  });

  const [decision, setDecision] = useState<"REQUEST_CHANGES" | "READY_FOR_VERIFICATION">("REQUEST_CHANGES");
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submitReview = useMutation({
    mutationFn: () => epr.createReview(orgId, draftId, { decision, note }),
    onSuccess: (review) => {
      toast.success(`Review recorded: ${review.decision.replaceAll("_", " ").toLowerCase()}`, {
        description: review.decision === "READY_FOR_VERIFICATION"
          ? "Flagged for further independent checking — this is not an approval."
          : "The draft owner should address the requested changes.",
      });
      setNote("");
      qc.invalidateQueries({ queryKey: ["epr-draft"] });
    },
    onError: (err) => {
      const fe = (err as { fieldErrors?: Record<string, string> }).fieldErrors;
      setFieldErrors(Object.fromEntries(Object.entries(fe ?? {}).filter(([, v]) => v)));
      toast.error("Could not record review", { description: err instanceof Error ? err.message : undefined });
    },
  });

  if (draft.isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/epr/drafts" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to drafts
        </Button>
        <Card><ErrorState error={draft.error} onRetry={() => draft.refetch()} /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/epr/drafts" })}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to drafts
      </Button>

      {draft.isLoading || !draft.data ? (
        <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 w-full" /></div>
      ) : (
        <DraftView draft={draft.data} role={role} userName={user.fullName} decision={decision} setDecision={setDecision} note={note} setNote={setNote} fieldErrors={fieldErrors} submit={() => submitReview.mutate()} submitting={submitReview.isPending} />
      )}
    </div>
  );
}

function DraftView({
  draft,
  role,
  userName,
  decision,
  setDecision,
  note,
  setNote,
  fieldErrors,
  submit,
  submitting,
}: {
  draft: EprDraft;
  role: Role;

  userName: string;
  decision: "REQUEST_CHANGES" | "READY_FOR_VERIFICATION";
  setDecision: (d: "REQUEST_CHANGES" | "READY_FOR_VERIFICATION") => void;
  note: string;
  setNote: (n: string) => void;
  fieldErrors: Record<string, string>;
  submit: () => void;
  submitting: boolean;
}) {
  const receipt = draft.recyclerReceipt;
  const lotMass = receipt?.sourceMaterialLot?.massGrams ?? 0;
  const receivedMass = receipt?.receivedGrams ?? 0;
  const massStatus = !receipt ? "EVIDENCE_INCOMPLETE" : Math.abs(lotMass - receivedMass) <= lotMass * 0.05 ? "CONSISTENT" : "DISCREPANCY";
  const docs = receipt?.documents ?? [];
  const acceptedDocs = docs.filter((d) => d.reviewStatus === "ACCEPTED").length;

  const reviewTimeline: TimelineEntry[] = (draft.reviews ?? []).map((r) => ({
    title: r.decision === "REQUEST_CHANGES" ? "Changes requested" : "Flagged ready for verification",
    actor: r.reviewerName,
    timestamp: r.createdAt,
    detail: r.note,
    tone: r.decision === "READY_FOR_VERIFICATION" ? "info" : "warning",
  }));

  const recordedBySelf = receipt?.recordedByName === userName;

  return (
    <div className="space-y-4">
      <PageHeader
        title={draft.draftReference}
        description={`Reporting period ${draft.periodKey} · created ${formatDate(draft.createdAt)}`}
        actions={<StatusBadge status={draft.status} />}
      />

      <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        This is an internal, unverified trace. DRAFT status and internal review decisions never imply verified recycling, approved EPR compliance, or certified waste processing.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">MRV trace view</CardTitle>
              <CardDescription>Source identifiers for every record in the chain</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-0">
                <TraceRow label="EPR draft" value={draft.draftReference} href="/epr/drafts" />
                <TraceRow label="Recycler receipt" value={receipt?.reference ?? receipt?.id ?? "—"} href="/recycling/receipts" />

                <TraceRow label="Material lot" value={receipt?.sourceMaterialLot?.code ?? receipt?.sourceMaterialLotId ?? "—"} href={receipt ? `/materials/lots/${receipt.sourceMaterialLotId}` : undefined} />
                <TraceRow label="Recycler evidence" value={`${acceptedDocs} accepted document(s) of ${docs.length}`} />
                <TraceRow label="Document scan & review" value={docs.map((d) => `${d.scanStatus.toLowerCase()}/${d.reviewStatus.toLowerCase()}`).join(", ") || "no documents"} />
                <TraceRow label="Internal review history" value={`${draft.reviews?.length ?? 0} event(s)`} />
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Mass consistency</CardTitle>
              <CardDescription>Computed from the linked records — never from forced balance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Source lot mass</p>
                  <p className="mt-1 font-semibold"><WeightDisplay grams={lotMass} /></p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Recycler received</p>
                  <p className="mt-1 font-semibold"><WeightDisplay grams={receivedMass} /></p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Candidate EPR-eligible</p>
                  <p className="mt-1 font-semibold"><WeightDisplay grams={draft.candidateEligibleGrams} /></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={massStatus} />
                <span className="text-xs text-muted-foreground">
                  {massStatus === "DISCREPANCY"
                    ? `Difference between lot mass and received mass: ${formatGrams(Math.abs(lotMass - receivedMass))} (${((Math.abs(lotMass - receivedMass) / Math.max(lotMass, 1)) * 100).toFixed(1)}%).`
                    : "Within the 5% tolerance used for internal consistency."}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Evidence hygiene</CardTitle>
              <CardDescription>Human review, scan status and document references stay separate</CardDescription>
            </CardHeader>
            <CardContent>
              <EvidenceViewer documents={docs} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Internal review history</CardTitle>
              <CardDescription>Actor, decision, note and time for every review event</CardDescription>
            </CardHeader>
            <CardContent>
              <Timeline entries={reviewTimeline} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Draft information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Row label="Status"><StatusBadge status={draft.status} /></Row>
              <Row label="Period">{draft.periodKey}</Row>
              <Row label="Candidate grams"><span className="tabular-nums">{draft.candidateEligibleGrams.toLocaleString()} g</span></Row>
              <Row label="Receipt">{receipt?.reference ?? draft.recyclerReceiptId}</Row>
              <Row label="Source lot">{receipt?.sourceMaterialLot?.code ?? "—"}</Row>
            </CardContent>
          </Card>

          <PermissionGate
            capability="review"
            fallback={
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Internal review</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Your role ({role}) cannot record review decisions. Required: OWNER, ADMIN or AUDITOR.
                  </p>
                </CardContent>
              </Card>
            }
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Record a review decision</CardTitle>
                <CardDescription>
                  {recordedBySelf
                    ? "Separation of duties: you recorded the underlying recycler receipt, so readiness decisions are blocked for you."
                    : "READY_FOR_VERIFICATION flags the draft for independent checking — it is not an approval."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Decision</Label>
                  <Select value={decision} onValueChange={(v) => setDecision(v as typeof decision)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REQUEST_CHANGES">Request changes</SelectItem>
                      <SelectItem value="READY_FOR_VERIFICATION" disabled={recordedBySelf}>Ready for verification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rv-note">Explanatory note</Label>
                  <Textarea id="rv-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change, or why the draft is ready for independent checking…" />
                  {fieldErrors["note"] ? <p className="text-xs text-destructive">{fieldErrors["note"]}</p> : null}
                </div>
                <Button className="w-full" onClick={submit} disabled={submitting || note.trim().length < 10}>
                  {submitting ? "Recording…" : "Record review"}
                </Button>
                {can("review", role) && decision === "READY_FOR_VERIFICATION" ? (
                  <p className="text-xs text-muted-foreground">Duplicate readiness events by the same reviewer are rejected by the backend.</p>
                ) : null}
              </CardContent>
            </Card>
          </PermissionGate>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Manifests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <FileSearch className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Internal evidence manifests with SHA-256 integrity fingerprints are under active backend development. This panel activates when the manifest endpoint is merged and verified — no manifests are shown or generated in the meantime.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TraceRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {href ? (
        <Link to={href} className="id-mono text-sm text-primary hover:underline">{value}</Link>
      ) : (
        <span className="id-mono text-sm">{value}</span>
      )}
    </li>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
