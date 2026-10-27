import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileSignature } from "lucide-react";
import { PageHeader, ErrorState, EmptyState } from "@/components/shared/StateViews";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WeightDisplay } from "@/components/shared/WeightDisplay";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { epr, recyclers } from "@/lib/api";
import { formatDate, formatGrams } from "@/lib/api/formatters";
import type { EprDraft, RecyclerReceipt } from "@/lib/api/types";
import { useAppSession } from "@/lib/app-session";

export const Route = createFileRoute("/epr/drafts/")({
  head: () => ({
    meta: [
      { title: "EPR Drafts — WeaveLoop" },
      { name: "description", content: "Internal EPR draft reservations with review history. Drafts are not legal claims." },
      { property: "og:title", content: "EPR Drafts — WeaveLoop" },
      { property: "og:description", content: "Internal EPR draft reservations — not legally verified claims." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EprDraftsPage,
});

function EprDraftsPage() {
  const { activeOrg } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const drafts = useQuery({
    queryKey: ["epr-drafts", orgId],
    queryFn: () => epr.listDrafts(orgId),
    enabled: !!orgId,
  });
  const receipts = useQuery({
    queryKey: ["recycler-receipts", orgId],
    queryFn: () => recyclers.listReceipts(orgId, { pageSize: 100 }),
    enabled: !!orgId,
  });

  const eligible = (receipts.data?.data ?? []).filter(
    (r: RecyclerReceipt) => !r.reservedByDraftId && (r.documents ?? []).some((d) => d.reviewStatus === "ACCEPTED"),
  );

  const [open, setOpen] = useState(false);
  const [receiptId, setReceiptId] = useState("");
  const [periodKey, setPeriodKey] = useState("2026-Q4");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () => epr.createDraft(orgId, { recyclerReceiptId: receiptId, periodKey }),
    onSuccess: (draft) => {
      toast.success("EPR draft reserved", { description: `${draft.draftReference} created for period ${draft.periodKey}. Status: DRAFT — internal only.` });
      setOpen(false);
      setReceiptId("");
      qc.invalidateQueries({ queryKey: ["epr-drafts"] });
      qc.invalidateQueries({ queryKey: ["recycler-receipts"] });
    },
    onError: (err) => {
      const fe = (err as { fieldErrors?: Record<string, string> }).fieldErrors;
      setFieldErrors(Object.fromEntries(Object.entries(fe ?? {}).filter(([, v]) => v)));
      toast.error("Could not create draft", { description: err instanceof Error ? err.message : undefined });
    },
  });

  const columns: Column<EprDraft>[] = [
    { key: "ref", header: "Draft ID", sortValue: (r) => r.draftReference, render: (r) => <span className="id-mono font-medium">{r.draftReference}</span> },
    { key: "period", header: "Period", render: (r) => r.periodKey },
    { key: "receipt", header: "Recycler receipt", render: (r) => <span className="id-mono text-xs">{r.recyclerReceipt?.reference ?? r.recyclerReceiptId}</span> },
    { key: "lot", header: "Source lot", render: (r) => <span className="id-mono text-xs">{r.recyclerReceipt?.sourceMaterialLot?.code ?? r.sourceMaterialLotId ?? "—"}</span> },
    { key: "grams", header: "Candidate eligible", align: "right", sortValue: (r) => r.candidateEligibleGrams, render: (r) => <WeightDisplay grams={r.candidateEligibleGrams} /> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "reviews", header: "Reviews", align: "right", render: (r) => <span className="tabular-nums">{r.reviews?.length ?? 0}</span> },
    { key: "created", header: "Created", sortValue: (r) => r.createdAt, render: (r) => <span className="text-muted-foreground">{formatDate(r.createdAt)}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="EPR Drafts"
        description="Internal draft reservations against recycler receipts. DRAFT is the only persisted status — internal review does not constitute regulatory approval."
        actions={
          <PermissionGate capability="write">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><FileSignature className="mr-2 h-4 w-4" /> New draft</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create EPR draft reservation</DialogTitle>
                  <DialogDescription>The organization is taken from your session — it is never submitted from the client.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Recycler receipt</Label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={receiptId} onChange={(e) => setReceiptId(e.target.value)} aria-label="Recycler receipt">
                      <option value="">Choose an eligible receipt…</option>
                      {eligible.map((r: RecyclerReceipt) => (
                        <option key={r.id} value={r.id}>{r.reference} · {formatGrams(r.receivedGrams)}</option>
                      ))}
                    </select>
                    {eligible.length === 0 ? (
                      <p className="text-xs text-warning">No eligible receipts: a receipt needs at least one accepted evidence document and no existing draft reservation.</p>
                    ) : null}
                    {fieldErrors["recyclerReceiptId"] ? <p className="text-xs text-destructive">{fieldErrors["recyclerReceiptId"]}</p> : null}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="epr-period">Reporting period</Label>
                    <Input id="epr-period" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} placeholder="2026-Q4" className="id-mono" />
                    {fieldErrors["periodKey"] ? <p className="text-xs text-destructive">{fieldErrors["periodKey"]}</p> : null}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => create.mutate()} disabled={!receiptId || create.isPending}>
                    {create.isPending ? "Reserving…" : "Reserve draft"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        }
      />

      <Alert>
        <FileSignature className="h-4 w-4" />
        <AlertTitle>Terminology</AlertTitle>
        <AlertDescription>
          READY_FOR_VERIFICATION means ready for further independent checking — it does not mean verified recycling or approved EPR compliance.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="p-0">
          {drafts.isError ? (
            <ErrorState error={drafts.error} onRetry={() => drafts.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              rows={drafts.data}
              isLoading={drafts.isLoading}
              error={drafts.error}
              onRetry={() => drafts.refetch()}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate({ to: "/epr/drafts/$draftId", params: { draftId: r.id } })}
              emptyTitle="No EPR drafts"
              emptyDescription="Reserve a draft against an eligible recycler receipt with accepted evidence."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Eligible receipts</CardTitle>
          <CardDescription>Receipts with accepted evidence and no draft reservation</CardDescription>
        </CardHeader>
        <CardContent>
          {eligible.length === 0 ? (
            <p className="text-sm text-muted-foreground">None right now. Link and accept evidence documents on recycler receipts first.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {eligible.map((r: RecyclerReceipt) => (
                <li key={r.id} className="flex items-center justify-between rounded-md border p-2">
                  <span className="id-mono">{r.reference}</span>
                  <span className="text-muted-foreground">{formatGrams(r.receivedGrams)} · {(r.documents ?? []).filter((d) => d.reviewStatus === "ACCEPTED").length} accepted doc(s)</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Drafts link to <Link to="/epr/drafts" className="text-primary hover:underline">MRV traceability</Link> once a real MRV endpoint is integrated; the trace view inside each draft uses currently available records.
      </p>
    </div>
  );
}
