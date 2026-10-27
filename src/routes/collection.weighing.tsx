import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Scale } from "lucide-react";

import { PageHeader, ErrorState } from "@/components/shared/StateViews";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { WeightDisplay, WeightExact } from "@/components/shared/WeightDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { IdChip } from "@/components/shared/IdChip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { collection } from "@/lib/api";
import { formatDateTime, formatGrams } from "@/lib/api/formatters";
import type { WeighingEvent } from "@/lib/api/types";
import { useAppSession } from "@/lib/app-session";
import { PermissionGate } from "@/components/shared/PermissionGate";

export const Route = createFileRoute("/collection/weighing")({
  head: () => ({
    meta: [
      { title: "Weighing Events — WeaveLoop" },
      { name: "description", content: "Record and review bag weighing events. Weights are stored in exact grams." },
      { property: "og:title", content: "Weighing Events — WeaveLoop" },
      { property: "og:description", content: "Record and review bag weighing events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WeighingPage,
});

function WeighingPage() {
  const { activeOrg } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const qc = useQueryClient();

  const weighings = useQuery({
    queryKey: ["weighings", orgId],
    queryFn: () => collection.listWeighings(orgId, { page: 1, pageSize: 30 }),
    enabled: !!orgId,
  });

  const [open, setOpen] = useState(false);
  const [bagCode, setBagCode] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const resolvedBag = useQuery({
    queryKey: ["bag-lookup", orgId, bagCode],
    queryFn: () => collection.lookupBagByCode(orgId, bagCode),
    enabled: bagCode.trim().length >= 4,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => {
      const grams = Math.round(parseFloat(weightKg.replace(",", ".")) * 1000);
      return collection.createWeighing(
        orgId,
        {
          bagId: resolvedBag.data!.id,
          weightGrams: grams,
          occurredAt: new Date().toISOString(),
          source: "OPERATOR_ENTRY",
          notes: notes || undefined,
        },
        `we-${resolvedBag.data!.id}-${grams}-${Date.now()}`,
      );
    },
    onSuccess: (event) => {
      toast.success("Weighing recorded", {
        description: `${formatGrams(event.weightGrams)} recorded for bag ${event.bag?.code}. Exact value preserved in grams.`,
      });
      setOpen(false);
      setBagCode("");
      setWeightKg("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["weighings"] });
    },
    onError: (err) => {
      const fe = (err as { fieldErrors?: Record<string, string> }).fieldErrors;
      setFieldErrors(Object.fromEntries(Object.entries(fe ?? {}).filter(([, v]) => v)));
      toast.error("Could not record weighing", { description: err instanceof Error ? err.message : undefined });
    },
  });

  const columns: Column<WeighingEvent>[] = [
    { key: "bag", header: "Bag", sortValue: (r) => r.bag?.code ?? "", render: (r) => <span className="id-mono font-medium">{r.bag?.code ?? r.bagId}</span> },
    {
      key: "weight",
      header: "Weight",
      align: "right",
      sortValue: (r) => r.weightGrams,
      render: (r) => (
        <span className="flex flex-col items-end">
          <WeightDisplay grams={r.weightGrams} />
          <WeightExact grams={r.weightGrams} />
        </span>
      ),
    },
    { key: "actor", header: "Actor", render: (r) => r.actorName ?? "—" },
    { key: "source", header: "Source", render: (r) => <span className="text-xs text-muted-foreground">{r.source.replaceAll("_", " ").toLowerCase()}</span> },
    {
      key: "occurred",
      header: "Occurred",
      sortValue: (r) => r.occurredAt,
      render: (r) => <span className="text-muted-foreground">{formatDateTime(r.occurredAt)}</span>,
    },
    {
      key: "recorded",
      header: "Recorded",
      render: (r) => <span className="text-xs text-muted-foreground">{r.recordedAt ? formatDateTime(r.recordedAt) : "—"}</span>,
    },
    { key: "bagId", header: "Bag ID", render: (r) => <IdChip id={r.bagId} /> },
  ];

  const bagNotFound = resolvedBag.isError && bagCode.trim().length >= 4;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Weighing Events"
        description="Every recorded weight is preserved in exact grams; the UI shows kg conversions only."
        actions={
          <PermissionGate capability="write">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Scale className="mr-2 h-4 w-4" /> Record weighing</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record a weighing event</DialogTitle>
                  <DialogDescription>Enter the weight in kilograms — it is stored as exact grams without rounding.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="we-bag">Bag code</Label>
                    <Input
                      id="we-bag"
                      placeholder="BAG-SGN-001-012"
                      className="id-mono"
                      value={bagCode}
                      onChange={(e) => setBagCode(e.target.value)}
                    />
                    {bagCode.trim().length >= 4 ? (
                      resolvedBag.isLoading ? (
                        <p className="text-xs text-muted-foreground">Looking up bag…</p>
                      ) : resolvedBag.data ? (
                        <p className="flex items-center gap-1.5 text-xs text-success">
                          Found bag {resolvedBag.data.code} · <StatusBadge status={resolvedBag.data.status} />
                        </p>
                      ) : bagNotFound ? (
                        <p className="text-xs text-destructive">No bag found for this code in this organization.</p>
                      ) : null
                    ) : (
                      <p className="text-xs text-muted-foreground">Type at least 4 characters to look up the bag.</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="we-weight">Weight (kg)</Label>
                    <Input
                      id="we-weight"
                      inputMode="decimal"
                      placeholder="12.450"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                    />
                    {weightKg && !Number.isNaN(parseFloat(weightKg)) ? (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Stored as {Math.round(parseFloat(weightKg.replace(",", ".")) * 1000).toLocaleString()} g
                      </p>
                    ) : null}
                    {fieldErrors["weightGrams"] ? <p className="text-xs text-destructive">{fieldErrors["weightGrams"]}</p> : null}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="we-notes">Notes (optional)</Label>
                    <Textarea id="we-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Material condition, contamination…" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => create.mutate()}
                    disabled={!resolvedBag.data || !weightKg || Number.isNaN(parseFloat(weightKg)) || create.isPending}
                  >
                    {create.isPending ? "Recording…" : "Record weighing"}
                  </Button>
                </DialogFooter>
              </DialogContent>

            </Dialog>
          </PermissionGate>
        }
      />

      <Card>
        <CardContent className="p-0">
          {weighings.isError ? (
            <ErrorState error={weighings.error} onRetry={() => weighings.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              rows={weighings.data?.data}
              isLoading={weighings.isLoading}
              error={weighings.error}
              onRetry={() => weighings.refetch()}
              rowKey={(r) => r.id}
              emptyTitle="No weighing events"
              emptyDescription="Recorded weighings appear here with the exact gram value and both occurred and recorded times."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Prevent duplicate submissions</CardTitle>
          <CardDescription>
            Each submission carries an idempotency key; a retried request cannot create a second event for the same reading.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

