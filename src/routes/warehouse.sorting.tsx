import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ScanSearch } from "lucide-react";
import { PageHeader, ErrorState, EmptyState } from "@/components/shared/StateViews";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MassBalance } from "@/components/shared/MassBalance";
import { WeightDisplay } from "@/components/shared/WeightDisplay";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { warehouse } from "@/lib/api";
import { formatDateTime } from "@/lib/api/formatters";
import type { SortingRecord, WarehouseReceipt } from "@/lib/api/types";
import { useAppSession } from "@/lib/app-session";

export const Route = createFileRoute("/warehouse/sorting")({
  head: () => ({
    meta: [
      { title: "Sorting Records — WeaveLoop" },
      { name: "description", content: "Accepted, rejected and loss mass per warehouse receipt, with mass-balance checks." },
      { property: "og:title", content: "Sorting Records — WeaveLoop" },
      { property: "og:description", content: "Sorting outcomes with mass-balance visualization." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SortingPage,
});

function SortingPage() {
  const { activeOrg } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const qc = useQueryClient();

  const sortings = useQuery({
    queryKey: ["sorting-records", orgId],
    queryFn: () => warehouse.listSorting(orgId),
    enabled: !!orgId,
  });
  const receipts = useQuery({
    queryKey: ["warehouse-receipts", orgId, "all"],
    queryFn: () => warehouse.listReceipts(orgId, { pageSize: 100 }),
    enabled: !!orgId,
  });

  const pending = useMemo(
    () => (receipts.data?.data ?? []).filter((r) => !(sortings.data ?? []).some((s) => s.warehouseReceiptId === r.id)),
    [receipts.data, sortings.data],
  );

  const [open, setOpen] = useState(false);
  const [receiptId, setReceiptId] = useState("");
  const [acceptedKg, setAcceptedKg] = useState("");
  const [rejectedKg, setRejectedKg] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const selectedReceipt = (receipts.data?.data ?? []).find((r) => r.id === receiptId);
  const lossKg = selectedReceipt
    ? Math.max(0, selectedReceipt.receivedGrams / 1000 - (parseFloat(acceptedKg.replace(",", ".")) || 0) - (parseFloat(rejectedKg.replace(",", ".")) || 0))
    : 0;

  const create = useMutation({
    mutationFn: () =>
      warehouse.createSorting(orgId, {
        warehouseReceiptId: receiptId,
        acceptedGrams: Math.round(parseFloat(acceptedKg.replace(",", ".")) * 1000),
        rejectedGrams: Math.round(parseFloat(rejectedKg.replace(",", ".")) * 1000),
        lossGrams: Math.round(lossKg * 1000),
        materialType: materialType || undefined,
      }),
    onSuccess: (s) => {
      toast.success("Sorting recorded", {
        description: `${(s.acceptedGrams / 1000).toFixed(1)} kg accepted · ${(s.rejectedGrams / 1000).toFixed(1)} kg rejected · ${(s.lossGrams / 1000).toFixed(1)} kg loss. A material lot was created from the accepted mass.`,
      });
      setOpen(false);
      setReceiptId("");
      setAcceptedKg("");
      setRejectedKg("");
      setMaterialType("");
      qc.invalidateQueries({ queryKey: ["sorting-records"] });
      qc.invalidateQueries({ queryKey: ["material-lots"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => {
      const fe = (err as { fieldErrors?: Record<string, string> }).fieldErrors;
      setFieldErrors(Object.fromEntries(Object.entries(fe ?? {}).filter(([, v]) => v)));
      toast.error("Could not record sorting", { description: err instanceof Error ? err.message : undefined });
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sorting Records"
        description="Accepted, rejected and lost mass per warehouse receipt. Balances are never forced — discrepancies stay visible."
        actions={
          <PermissionGate capability="write">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={pending.length === 0}><ScanSearch className="mr-2 h-4 w-4" /> Record sorting</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record a sorting outcome</DialogTitle>
                  <DialogDescription>Accepted + rejected + loss must equal the received mass exactly.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Warehouse receipt</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={receiptId}
                      onChange={(e) => setReceiptId(e.target.value)}
                      aria-label="Warehouse receipt"
                    >
                      <option value="">Choose a receipt awaiting sorting…</option>
                      {pending.map((r: WarehouseReceipt) => (
                        <option key={r.id} value={r.id}>
                          {r.bag?.code} · {(r.receivedGrams / 1000).toFixed(2)} kg
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="sr-acc">Accepted (kg)</Label>
                      <Input id="sr-acc" inputMode="decimal" value={acceptedKg} onChange={(e) => setAcceptedKg(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sr-rej">Rejected (kg)</Label>
                      <Input id="sr-rej" inputMode="decimal" value={rejectedKg} onChange={(e) => setRejectedKg(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sr-type">Material type</Label>
                    <Input id="sr-type" value={materialType} onChange={(e) => setMaterialType(e.target.value)} placeholder="PET bottles, HDPE…" />
                  </div>
                  {selectedReceipt ? (
                    <p className="rounded-md bg-muted px-3 py-2 text-xs tabular-nums">
                      Received {(selectedReceipt.receivedGrams / 1000).toFixed(3)} kg · loss auto-calculated {lossKg.toFixed(3)} kg
                      {fieldErrors["lossGrams"] ? <span className="block text-destructive">{fieldErrors["lossGrams"]}</span> : null}
                    </p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => create.mutate()} disabled={!receiptId || !acceptedKg || create.isPending}>
                    {create.isPending ? "Recording…" : "Record sorting"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        }
      />

      {pending.length > 0 ? (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          {pending.length} warehouse receipt{pending.length > 1 ? "s" : ""} without a sorting record — the received mass is unaccounted for until sorting is recorded.
        </p>
      ) : null}

      {sortings.isError ? (
        <Card><ErrorState error={sortings.error} onRetry={() => sortings.refetch()} /></Card>
      ) : sortings.isLoading ? (
        <Card><CardContent className="space-y-3 p-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}</CardContent></Card>
      ) : (sortings.data?.length ?? 0) === 0 ? (
        <Card><EmptyState title="No sorting records yet" description="Record a sorting outcome for a warehouse receipt to see mass balances here." icon={ScanSearch} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(sortings.data ?? []).map((s: SortingRecord) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">Receipt for {s.warehouseReceipt?.bag?.code ?? s.warehouseReceiptId}</CardTitle>
                  <StatusBadge status={s.acceptedGrams + s.rejectedGrams + s.lossGrams === (s.warehouseReceipt?.receivedGrams ?? 0) ? "CONSISTENT" : "DISCREPANCY"} />
                </div>
                <CardDescription>
                  Sorted {formatDateTime(s.sortedAt)} by {s.sortedByName}
                  {s.materialType ? ` · ${s.materialType}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MassBalance
                  receivedGrams={s.warehouseReceipt?.receivedGrams ?? s.acceptedGrams + s.rejectedGrams + s.lossGrams}
                  acceptedGrams={s.acceptedGrams}
                  rejectedGrams={s.rejectedGrams}
                  lossGrams={s.lossGrams}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  Total received: <WeightDisplay grams={s.warehouseReceipt?.receivedGrams ?? 0} size="sm" />
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
