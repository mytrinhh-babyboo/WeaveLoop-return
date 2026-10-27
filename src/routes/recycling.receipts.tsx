import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Recycle, Upload } from "lucide-react";
import { PageHeader, ErrorState } from "@/components/shared/StateViews";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WeightDisplay } from "@/components/shared/WeightDisplay";
import { EvidenceViewer } from "@/components/shared/EvidenceViewer";
import { IdChip } from "@/components/shared/IdChip";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { organizations, recyclers } from "@/lib/api";
import { formatDate, formatGrams } from "@/lib/api/formatters";
import type { MaterialLot, Partner, RecyclerReceipt } from "@/lib/api/types";
import { useAppSession } from "@/lib/app-session";

export const Route = createFileRoute("/recycling/receipts")({
  head: () => ({
    meta: [
      { title: "Recycler Receipts — WeaveLoop" },
      { name: "description", content: "Documented recycler handovers with linked evidence and document review states." },
      { property: "og:title", content: "Recycler Receipts — WeaveLoop" },
      { property: "og:description", content: "Recycler handovers with evidence and document review states." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecyclerReceiptsPage,
});

function RecyclerReceiptsPage() {
  const { activeOrg } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const receipts = useQuery({
    queryKey: ["recycler-receipts", orgId],
    queryFn: () => recyclers.listReceipts(orgId, { page: 1, pageSize: 50 }),
    enabled: !!orgId,
  });
  const recyclableLots = useQuery({
    queryKey: ["material-lots", orgId],
    queryFn: () => import("@/lib/api").then((m) => m.materials.listLots(orgId)),
    enabled: !!orgId,
  });
  const partners = useQuery({
    queryKey: ["partners", orgId],
    queryFn: () => organizations.listPartners(orgId),
    enabled: !!orgId,
  });

  const [open, setOpen] = useState(false);
  const [lotId, setLotId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [receivedKg, setReceivedKg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () =>
      recyclers.createReceipt(orgId, {
        sourceMaterialLotId: lotId,
        recyclerPartnerId: partnerId,
        receivedGrams: Math.round(parseFloat(receivedKg.replace(",", ".")) * 1000),
        receivedAt: new Date().toISOString(),
      }),
    onSuccess: (r) => {
      toast.success("Recycler receipt recorded", { description: `${r.reference} — ${formatGrams(r.receivedGrams)} handed to ${r.recyclerPartner?.name}.` });
      setOpen(false);
      setLotId("");
      setPartnerId("");
      setReceivedKg("");
      qc.invalidateQueries({ queryKey: ["recycler-receipts"] });
      qc.invalidateQueries({ queryKey: ["material-lots"] });
    },
    onError: (err) => {
      const fe = (err as { fieldErrors?: Record<string, string> }).fieldErrors;
      setFieldErrors(Object.fromEntries(Object.entries(fe ?? {}).filter(([, v]) => v)));
      toast.error("Could not record receipt", { description: err instanceof Error ? err.message : undefined });
    },
  });

  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = (receipts.data?.data ?? []).find((r) => r.id === detailId) ?? null;
  const [newDocName, setNewDocName] = useState("");
  const prepareDoc = useMutation({
    mutationFn: () => recyclers.prepareDocument(orgId, detail!.id, newDocName),
    onSuccess: () => {
      toast.success("Document prepared", { description: "Finalize the upload to complete the malware scan." });
      setNewDocName("");
      qc.invalidateQueries({ queryKey: ["recycler-receipts"] });
    },
    onError: (err) => toast.error("Could not prepare document", { description: err instanceof Error ? err.message : undefined }),
  });

  const columns: Column<RecyclerReceipt>[] = [
    { key: "ref", header: "Reference", sortValue: (r) => r.reference, render: (r) => <span className="id-mono font-medium">{r.reference}</span> },
    { key: "partner", header: "Recycler", render: (r) => r.recyclerPartner?.name ?? "—" },
    { key: "lot", header: "Source lot", render: (r) => <span className="id-mono text-xs">{r.sourceMaterialLot?.code ?? r.sourceMaterialLotId}</span> },
    { key: "mass", header: "Received", align: "right", sortValue: (r) => r.receivedGrams, render: (r) => <WeightDisplay grams={r.receivedGrams} /> },
    { key: "date", header: "Received at", sortValue: (r) => r.receivedAt, render: (r) => <span className="text-muted-foreground">{formatDate(r.receivedAt)}</span> },
    {
      key: "docs",
      header: "Evidence",
      render: (r) => {
        const docs = r.documents ?? [];
        const accepted = docs.filter((d) => d.reviewStatus === "ACCEPTED").length;
        const pending = docs.filter((d) => d.reviewStatus === "PENDING_REVIEW").length;
        return (
          <span className="text-xs text-muted-foreground">
            {accepted} accepted · {pending} awaiting review
          </span>
        );
      },
    },
    { key: "reserved", header: "EPR", render: (r) => (r.reservedByDraftId ? <StatusBadge status="DRAFT" labelOverride="Reserved by draft" /> : <StatusBadge status="AVAILABLE" labelOverride="Available" />) },
  ];

  const availableLots = (recyclableLots.data ?? []).filter((l: MaterialLot) => l.consumptionStatus === "AVAILABLE");
  const recyclerPartners = (partners.data ?? []).filter((p: Partner) => p.type === "RECYCLER");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recycler Receipts"
        description="Documented handovers of material lots to recycler partners. Evidence and review states are tracked per document."
        actions={
          <PermissionGate capability="write">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Recycle className="mr-2 h-4 w-4" /> Record receipt</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record a recycler receipt</DialogTitle>
                  <DialogDescription>One receipt per material lot. Received mass cannot exceed the lot mass.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Source material lot</Label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={lotId} onChange={(e) => setLotId(e.target.value)} aria-label="Source material lot">
                      <option value="">Choose an available lot…</option>
                      {availableLots.map((l: MaterialLot) => (
                        <option key={l.id} value={l.id}>{l.code} · {(l.massGrams / 1000).toFixed(2)} kg</option>
                      ))}
                    </select>
                    {fieldErrors["sourceMaterialLotId"] ? <p className="text-xs text-destructive">{fieldErrors["sourceMaterialLotId"]}</p> : null}
                  </div>
                  <div className="space-y-1">
                    <Label>Recycler partner</Label>
                    <Select value={partnerId} onValueChange={setPartnerId}>
                      <SelectTrigger><SelectValue placeholder="Choose a recycler" /></SelectTrigger>
                      <SelectContent>
                        {recyclerPartners.map((p: Partner) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors["recyclerPartnerId"] ? <p className="text-xs text-destructive">{fieldErrors["recyclerPartnerId"]}</p> : null}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rr-kg">Received mass (kg)</Label>
                    <Input id="rr-kg" inputMode="decimal" value={receivedKg} onChange={(e) => setReceivedKg(e.target.value)} />
                    {fieldErrors["receivedGrams"] ? <p className="text-xs text-destructive">{fieldErrors["receivedGrams"]}</p> : null}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => create.mutate()} disabled={!lotId || !partnerId || !receivedKg || create.isPending}>
                    {create.isPending ? "Recording…" : "Record receipt"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        }
      />

      <Card>
        <CardContent className="p-0">
          {receipts.isError ? (
            <ErrorState error={receipts.error} onRetry={() => receipts.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              rows={receipts.data?.data}
              isLoading={receipts.isLoading}
              error={receipts.error}
              onRetry={() => receipts.refetch()}
              rowKey={(r) => r.id}
              onRowClick={(r) => setDetailId(r.id)}
              emptyTitle="No recycler receipts"
              emptyDescription="Record a handover of an available material lot to a recycler partner."
            />
          )}
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">{detail?.reference} <IdChip id={detail?.id ?? ""} /></SheetTitle>
            <SheetDescription>
              {detail ? `${formatGrams(detail.receivedGrams)} to ${detail.recyclerPartner?.name} · ${formatDate(detail.receivedAt)}` : ""}
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="mt-4 space-y-5">
              <section>
                <h3 className="mb-2 text-sm font-semibold">Linked evidence documents</h3>
                <EvidenceViewer documents={detail.documents} />
                <PermissionGate capability="write">
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="e.g. weighbridge-ticket.pdf"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      aria-label="Document file name"
                    />
                    <Button size="sm" variant="outline" onClick={() => prepareDoc.mutate()} disabled={!newDocName.trim() || prepareDoc.isPending}>
                      <Upload className="mr-2 h-4 w-4" /> Prepare document
                    </Button>
                  </div>
                </PermissionGate>
                <p className="mt-2 text-xs text-muted-foreground">
                  Prepared documents are scanned for malware after upload finalization, then reviewed by a human reviewer. Review happens in Evidence Review.
                </p>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold">Source record</h3>
                <p className="text-sm text-muted-foreground">
                  Material lot <span className="id-mono text-foreground">{detail.sourceMaterialLot?.code}</span> ·{" "}
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate({ to: "/materials/lots/$lotId", params: { lotId: detail.sourceMaterialLotId } })}>
                    Open lineage
                  </Button>
                </p>
              </section>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
