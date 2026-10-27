import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ErrorState } from "@/components/shared/StateViews";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { collection } from "@/lib/api";
import { formatDate } from "@/lib/api/formatters";
import type { BagStatus, CollectionBag, CollectionPoint } from "@/lib/api/types";
import { useAppSession } from "@/lib/app-session";
import { PermissionGate } from "@/components/shared/PermissionGate";

export const Route = createFileRoute("/collection/bags/")({
  head: () => ({
    meta: [
      { title: "Collection Bags — WeaveLoop" },
      { name: "description", content: "Track WeaveLoop collection bags from issue through activation to closure." },
      { property: "og:title", content: "Collection Bags — WeaveLoop" },
      { property: "og:description", content: "Track collection bags from issue to closure." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { q?: string; status?: string; cp?: string } => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    status: typeof search["status"] === "string" ? search["status"] : undefined,
    cp: typeof search["cp"] === "string" ? search["cp"] : undefined,
  }),

  component: BagsPage,
});

function BagsPage() {
  const { activeOrg } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const bags = useQuery({
    queryKey: ["bags", orgId, search],
    queryFn: () =>
      collection.listBags(orgId, {
        search: search.q,
        status: search.status as BagStatus | undefined,
        collectionPointId: search.cp,
        page: 1,
        pageSize: 50,
      }),
    enabled: !!orgId,
  });
  const points = useQuery({
    queryKey: ["collection-points", orgId, "all"],
    queryFn: () => collection.listPoints(orgId, { pageSize: 100 }),
    enabled: !!orgId,
  });

  const [open, setOpen] = useState(false);
  const [pointId, setPointId] = useState("");
  const issue = useIssueBagMutation(orgId, pointId, () => setOpen(false));

  const columns: Column<CollectionBag>[] = [
    { key: "code", header: "Bag code", sortValue: (r) => r.code, render: (r) => <span className="id-mono font-medium">{r.code}</span> },
    { key: "cp", header: "Collection point", sortValue: (r) => r.collectionPoint?.name ?? "", render: (r) => r.collectionPoint?.name ?? <span className="text-muted-foreground">—</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "issued", header: "Issued", sortValue: (r) => r.issuedAt, render: (r) => <span className="text-muted-foreground">{formatDate(r.issuedAt)}</span> },
    { key: "activated", header: "Activated", sortValue: (r) => r.activatedAt ?? "", render: (r) => <span className="text-muted-foreground">{r.activatedAt ? formatDate(r.activatedAt) : "—"}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Collection Bags"
        description="Each bag is issued to a collection point and travels through weighing and custody until closed."
        actions={
          <PermissionGate capability="write">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Issue bag</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Issue a collection bag</DialogTitle>
                  <DialogDescription>The bag starts in ISSUED state and is activated on first handling at the point.</DialogDescription>
                </DialogHeader>
                <div className="space-y-1">
                  <Label>Collection point</Label>
                  <Select value={pointId} onValueChange={setPointId}>
                    <SelectTrigger><SelectValue placeholder="Choose a collection point" /></SelectTrigger>
                    <SelectContent>
                      {(points.data?.data ?? []).map((cp: CollectionPoint) => (
                        <SelectItem key={cp.id} value={cp.id}>{cp.code} — {cp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => issue.mutate()} disabled={!pointId || issue.isPending}>
                    {issue.isPending ? "Issuing…" : "Issue bag"}
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
            placeholder="Search bag code or point…"
            className="max-w-xs"
            value={search.q ?? ""}
            onChange={(e) => navigate({ search: { ...search, q: e.target.value || undefined } })}
          />
          <Select value={search.status ?? "ALL"} onValueChange={(v) => navigate({ search: { ...search, status: v === "ALL" ? undefined : v } })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ISSUED">Issued</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={search.cp ?? "ALL"} onValueChange={(v) => navigate({ search: { ...search, cp: v === "ALL" ? undefined : v } })}>
            <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All collection points</SelectItem>
              {(points.data?.data ?? []).map((cp: CollectionPoint) => (
                <SelectItem key={cp.id} value={cp.id}>{cp.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {bags.isError ? (
            <ErrorState error={bags.error} onRetry={() => bags.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              rows={bags.data?.data}
              isLoading={bags.isLoading}
              error={bags.error}
              onRetry={() => bags.refetch()}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate({ to: "/collection/bags/$bagId", params: { bagId: r.id } })}

              emptyTitle="No bags found"
              emptyDescription="Adjust the filters or issue a new bag to a collection point."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function useIssueBagMutation(orgId: string, pointId: string, close: () => void) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => collection.issueBag(orgId, { collectionPointId: pointId }),
    onSuccess: (bag) => {
      toast.success("Bag issued", { description: `${bag.code} issued at ${bag.collectionPoint?.name}.` });
      close();
      qc.invalidateQueries({ queryKey: ["bags"] });
      qc.invalidateQueries({ queryKey: ["collection-points"] });
    },
    onError: (err) => toast.error("Could not issue bag", { description: err instanceof Error ? err.message : undefined }),
  });
}
