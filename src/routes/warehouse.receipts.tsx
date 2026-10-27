import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { PageHeader, ErrorState } from "@/components/shared/StateViews";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WeightDisplay, WeightExact } from "@/components/shared/WeightDisplay";
import { IdChip } from "@/components/shared/IdChip";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { warehouse } from "@/lib/api";
import { formatDateTime } from "@/lib/api/formatters";
import type { WarehouseReceipt } from "@/lib/api/types";
import { useAppSession } from "@/lib/app-session";

export const Route = createFileRoute("/warehouse/receipts")({
  head: () => ({
    meta: [
      { title: "Warehouse Receipts — WeaveLoop" },
      { name: "description", content: "Record warehouse intake for bags with accepted custody and inspect received weights." },
      { property: "og:title", content: "Warehouse Receipts — WeaveLoop" },
      { property: "og:description", content: "Warehouse intake records with idempotency and received-weight inspection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
  }),

  component: WarehouseReceiptsPage,
});

function WarehouseReceiptsPage() {
  const { activeOrg } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();

  const receipts = useQuery({
    queryKey: ["warehouse-receipts", orgId, search],
    queryFn: () => warehouse.listReceipts(orgId, { search: search.q, page: 1, pageSize: 50 }),
    enabled: !!orgId,
  });

  const [open, setOpen] = useState(false);
  const [bagCode, setBagCode] = useState("");
  const [receivedKg, setReceivedKg] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const bagLookup = useQuery({
    queryKey: ["bag-lookup", orgId, bagCode],
    queryFn: () => import("@/lib/api").then((m) => m.collection.lookupBagByCode(orgId, bagCode)),
    enabled: bagCode.trim().length >= 4,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      warehouse.createReceipt(
        orgId,
        {
          bagId: bagLookup.data!.id,
          receivedGrams: Math.round(parseFloat(receivedKg.replace(",", ".")) * 1000),
          receivedAt: new Date().toISOString(),
          notes: notes || undefined,
        },
        `wr-${bagLookup.data!.id}-${Date.now()}`,
      ),
    onSuccess: (r) => {
      toast.success("Warehouse receipt recorded", { description: `${(r.receivedGrams / 1000).toFixed(2)} kg received for bag ${r.bag?.code}.` });
      setOpen(false);
      setBagCode("");
      setReceivedKg("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["warehouse-receipts"] });
    },
    onError: (err) => {
      const fe = (err as { fieldErrors?: Record<string, string> }).fieldErrors;
      setFieldErrors(Object.fromEntries(Object.entries(fe ?? {}).filter(([, v]) => v)));
      toast.error("Could not record receipt", { description: err instanceof Error ? err.message : undefined });
    },
  });

  const columns: Column<WarehouseReceipt>[] = [
    { key: "bag", header: "Bag", sortValue: (r) => r.bag?.code ?? "", render: (r) => <span className="id-mono font-medium">{r.bag?.code ?? r.bagId}</span> },
    {
      key: "grams",
      header: "Received",
      align: "right",
      sortValue: (r) => r.receivedGrams,
      render: (r) => (
        <span className="flex flex-col items-end">
          <WeightDisplay grams={r.receivedGrams} />
          <WeightExact grams={r.receivedGrams} />
        </span>
      ),
    },
    { key: "at", header: "Received at", sortValue: (r) => r.receivedAt, render: (r) => <span className="text-muted-foreground">{formatDateTime(r.receivedAt)}</span> },
    { key: "recorder", header: "Recorder", render: (r) => r.recordedByName ?? "—" },
    { key: "idem", header: "Idempotency", render: (r) => (r.idempotencyKey ? <IdChip id={r.idempotencyKey} /> : "—") },
    {
      key: "sorting",
      header: "Sorting",
      render: () => <StatusBadge status="PENDING_REVIEW" labelOverride="Check sorting" />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Warehouse Receipts"
        description="Intake records for bags handed over by accepted custody transfers."
        actions={
          <PermissionGate capability="write">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><PackageCheck className="mr-2 h-4 w-4" /> Record intake</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record warehouse intake</DialogTitle>
                  <DialogDescription>Custody for the bag must be accepted before intake. One receipt per bag; duplicates are rejected.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="wr-bag">Bag code</Label>
                    <Input id="wr-bag" className="id-mono" value={bagCode} onChange={(e) => setBagCode(e.target.value)} placeholder="BAG-SGN-001-012" />
                    {bagCode.trim().length >= 4 ? (
                      bagLookup.data ? (
                        <p className="text-xs text-success">Found bag {bagLookup.data.code}</p>
                      ) : bagLookup.isError ? (
                        <p className="text-xs text-destructive">No bag found for this code.</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Looking up bag…</p>
                      )
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="wr-weight">Received weight (kg)</Label>
                    <Input id="wr-weight" inputMode="decimal" value={receivedKg} onChange={(e) => setReceivedKg(e.target.value)} placeholder="13.200" />
                    {fieldErrors["receivedGrams"] ? <p className="text-xs text-destructive">{fieldErrors["receivedGrams"]}</p> : null}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="wr-notes">Notes</Label>
                    <Input id="wr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => create.mutate()} disabled={!bagLookup.data || !receivedKg || create.isPending}>
                    {create.isPending ? "Recording…" : "Record receipt"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Input
            placeholder="Search bag code…"
            className="max-w-xs"
            value={search.q ?? ""}
            onChange={(e) => navigate({ search: { ...search, q: e.target.value || undefined } })}
          />
        </CardContent>
      </Card>

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
              emptyTitle="No warehouse receipts"
              emptyDescription="Recorded intake appears here after accepted custody transfers."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
