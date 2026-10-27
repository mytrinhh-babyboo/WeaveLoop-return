import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { GitMerge, GitBranch, PackageSearch } from "lucide-react";
import { PageHeader, ErrorState } from "@/components/shared/StateViews";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WeightDisplay } from "@/components/shared/WeightDisplay";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { materials } from "@/lib/api";
import { formatDate, formatGrams } from "@/lib/api/formatters";
import type { MaterialLot } from "@/lib/api/types";
import { useAppSession } from "@/lib/app-session";

export const Route = createFileRoute("/materials/lots/")({
  head: () => ({
    meta: [
      { title: "Material Lots — WeaveLoop" },
      { name: "description", content: "Explore material lots, their mass and consumption status, and perform authorized split or merge operations." },
      { property: "og:title", content: "Material Lots — WeaveLoop" },
      { property: "og:description", content: "Material lot explorer with split and merge operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LotsPage,
});

function LotsPage() {
  const { activeOrg } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const lots = useQuery({
    queryKey: ["material-lots", orgId],
    queryFn: () => materials.listLots(orgId),
    enabled: !!orgId,
  });

  const available = (lots.data ?? []).filter((l) => l.consumptionStatus !== "CONSUMED");

  // Split state
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitLotId, setSplitLotId] = useState("");
  const [partA, setPartA] = useState("");
  const [partB, setPartB] = useState("");
  const splitSource = (lots.data ?? []).find((l) => l.id === splitLotId);
  const split = useMutation({
    mutationFn: () =>
      materials.split(orgId, splitLotId, [
        { massGrams: Math.round(parseFloat(partA.replace(",", ".")) * 1000) },
        { massGrams: Math.round(parseFloat(partB.replace(",", ".")) * 1000) },
      ]),
    onSuccess: () => {
      toast.success("Lot split", { description: "Two child lots were created; mass was conserved exactly." });
      setSplitOpen(false);
      setSplitLotId("");
      setPartA("");
      setPartB("");
      qc.invalidateQueries({ queryKey: ["material-lots"] });
    },
    onError: (err) => toast.error("Could not split lot", { description: err instanceof Error ? err.message : undefined }),
  });

  // Merge state
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const merge = useMutation({
    mutationFn: () => materials.merge(orgId, mergeIds),
    onSuccess: (op) => {
      toast.success("Lots merged", { description: `A merged lot was created from ${op.inputs.length} inputs; inputs are now consumed.` });
      setMergeOpen(false);
      setMergeIds([]);
      qc.invalidateQueries({ queryKey: ["material-lots"] });
    },
    onError: (err) => toast.error("Could not merge lots", { description: err instanceof Error ? err.message : undefined }),
  });

  const columns: Column<MaterialLot>[] = [
    { key: "code", header: "Lot ID", sortValue: (r) => r.code, render: (r) => <span className="id-mono font-medium">{r.code}</span> },
    { key: "mass", header: "Mass", align: "right", sortValue: (r) => r.massGrams, render: (r) => <WeightDisplay grams={r.massGrams} /> },
    { key: "source", header: "Source type", render: (r) => <span className="text-xs text-muted-foreground">{r.sourceType}</span> },
    { key: "status", header: "Consumption", render: (r) => <StatusBadge status={r.consumptionStatus} /> },
    { key: "receipt", header: "Recycler receipt", render: (r) => (r.recyclerReceiptId ? <span className="id-mono text-xs">{r.recyclerReceiptId}</span> : <span className="text-muted-foreground text-xs">—</span>) },
    { key: "created", header: "Created", sortValue: (r) => r.createdAt, render: (r) => <span className="text-muted-foreground">{formatDate(r.createdAt)}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Material Lots"
        description="Traceable units of sorted material. Splits and merges conserve mass exactly and record the responsible actor."
        actions={
          <PermissionGate capability="write">
            <>
              <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={available.length === 0}><GitBranch className="mr-2 h-4 w-4" /> Split lot</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Split a material lot</DialogTitle>
                    <DialogDescription>Part A + part B must equal the source lot mass exactly.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Source lot</Label>
                      <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={splitLotId} onChange={(e) => setSplitLotId(e.target.value)} aria-label="Source lot">
                        <option value="">Choose an available lot…</option>
                        {available.map((l) => <option key={l.id} value={l.id}>{l.code} · {(l.massGrams / 1000).toFixed(2)} kg</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="sp-a">Part A (kg)</Label>
                        <Input id="sp-a" inputMode="decimal" value={partA} onChange={(e) => setPartA(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="sp-b">Part B (kg)</Label>
                        <Input id="sp-b" inputMode="decimal" value={partB} onChange={(e) => setPartB(e.target.value)} />
                      </div>
                    </div>
                    {splitSource ? (
                      <p className="text-xs tabular-nums text-muted-foreground">
                        Source holds {(splitSource.massGrams / 1000).toFixed(3)} kg · parts total{" "}
                        {(((parseFloat(partA.replace(",", ".")) || 0) + (parseFloat(partB.replace(",", ".")) || 0))).toFixed(3)} kg
                      </p>
                    ) : null}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSplitOpen(false)}>Cancel</Button>
                    <Button onClick={() => split.mutate()} disabled={!splitLotId || !partA || !partB || split.isPending}>
                      {split.isPending ? "Splitting…" : "Split lot"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={available.length < 2}><GitMerge className="mr-2 h-4 w-4" /> Merge lots</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Merge material lots</DialogTitle>
                    <DialogDescription>Select at least two available lots. Input lots become CONSUMED; the output holds their combined mass.</DialogDescription>
                  </DialogHeader>
                  <div className="max-h-60 space-y-2 overflow-y-auto">
                    {available.map((l) => (
                      <label key={l.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                        <Checkbox
                          checked={mergeIds.includes(l.id)}
                          onCheckedChange={(checked) => setMergeIds((prev) => (checked ? [...prev, l.id] : prev.filter((id) => id !== l.id)))}
                        />
                        <span className="id-mono">{l.code}</span>
                        <span className="ml-auto tabular-nums text-muted-foreground">{formatGrams(l.massGrams)}</span>
                      </label>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancel</Button>
                    <Button onClick={() => merge.mutate()} disabled={mergeIds.length < 2 || merge.isPending}>
                      {merge.isPending ? "Merging…" : `Merge ${mergeIds.length} lots`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          </PermissionGate>
        }
      />

      <Card>
        <CardContent className="p-0">
          {lots.isError ? (
            <ErrorState error={lots.error} onRetry={() => lots.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              rows={lots.data}
              isLoading={lots.isLoading}
              error={lots.error}
              onRetry={() => lots.refetch()}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate({ to: "/materials/lots/$lotId", params: { lotId: r.id } })}
              emptyTitle="No material lots"
              emptyDescription="Lots are created from accepted sorting mass."
            />
          )}
        </CardContent>
      </Card>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <PackageSearch className="h-3.5 w-3.5" /> Click a lot to open its lineage graph and mass conservation checks.
      </p>
    </div>
  );
}
