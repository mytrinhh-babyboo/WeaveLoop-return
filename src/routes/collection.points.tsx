import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Factory, Plus } from "lucide-react";
import { PageHeader, ErrorState } from "@/components/shared/StateViews";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { collection, organizations } from "@/lib/api";
import type { CollectionPoint, Partner } from "@/lib/api/types";
import { useAppSession } from "@/lib/app-session";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { formatDate } from "@/lib/api/formatters";

export const Route = createFileRoute("/collection/points")({
  head: () => ({
    meta: [
      { title: "Collection Points — WeaveLoop" },
      { name: "description", content: "Manage the collection points that issue WeaveLoop bags, with partner and status filters." },
      { property: "og:title", content: "Collection Points — WeaveLoop" },
      { property: "og:description", content: "Manage collection points and their issued bags." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { q?: string; status?: string; partner?: string } => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    status: typeof search["status"] === "string" ? search["status"] : undefined,
    partner: typeof search["partner"] === "string" ? search["partner"] : undefined,
  }),

  component: CollectionPointsPage,
});

function CollectionPointsPage() {
  const { activeOrg } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();

  const points = useQuery({
    queryKey: ["collection-points", orgId, search],
    queryFn: () =>
      collection.listPoints(orgId, {
        search: search.q,
        status: search.status,
        partnerId: search.partner,
        page: 1,
        pageSize: 50,
      }),
    enabled: !!orgId,
  });
  const partners = useQuery({
    queryKey: ["partners", orgId],
    queryFn: () => organizations.listPartners(orgId),
    enabled: !!orgId,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", partnerId: "", address: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () =>
      collection.createPoint(orgId, {
        code: form.code,
        name: form.name,
        partnerId: form.partnerId || undefined,
        address: form.address || undefined,
      }),
    onSuccess: (cp) => {
      toast.success("Collection point created", { description: `${cp.code} — ${cp.name} is active and ready to issue bags.` });
      setOpen(false);
      setForm({ code: "", name: "", partnerId: "", address: "" });
      qc.invalidateQueries({ queryKey: ["collection-points"] });
    },
    onError: (err) => {
      const fe = (err as { fieldErrors?: Record<string, string> }).fieldErrors;
      setFieldErrors(Object.fromEntries(Object.entries(fe ?? {}).filter(([, v]) => v)));
      toast.error("Could not create collection point", { description: err instanceof Error ? err.message : undefined });
    },
  });

  const columns: Column<CollectionPoint>[] = [
    {
      key: "code",
      header: "Code",
      sortValue: (r) => r.code,
      render: (r) => <span className="id-mono font-medium text-foreground">{r.code}</span>,
    },
    { key: "name", header: "Name", sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "partner", header: "Partner", render: (r) => r.partner?.name ?? <span className="text-muted-foreground">—</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "bags", header: "Bags", align: "right", render: (r) => <span className="tabular-nums">{r.bagCount ?? 0}</span> },
    { key: "created", header: "Created", align: "right", render: (r) => <span className="text-muted-foreground">{formatDate(r.createdAt)}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Collection Points"
        description="Physical locations where WeaveLoop bags are issued and filled."
        actions={
          <PermissionGate capability="write">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> New collection point
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New collection point</DialogTitle>
                  <DialogDescription>The code must be unique within this organization.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="cp-code">Code</Label>
                    <Input id="cp-code" placeholder="CP-SGN-007" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="id-mono" />
                    {fieldErrors["code"] ? <p className="text-xs text-destructive">{fieldErrors["code"]}</p> : null}

                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cp-name">Name</Label>
                    <Input id="cp-name" placeholder="Co.op X-Time Hai Bà Trưng" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    {fieldErrors["name"] ? <p className="text-xs text-destructive">{fieldErrors["name"]}</p> : null}

                  </div>
                  <div className="space-y-1">
                    <Label>Partner</Label>
                    <Select value={form.partnerId} onValueChange={(v) => setForm({ ...form, partnerId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional partner" />
                      </SelectTrigger>
                      <SelectContent>
                        {(partners.data ?? []).map((p: Partner) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.type.toLowerCase()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cp-address">Address</Label>
                    <Input id="cp-address" placeholder="Street, district, city" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => create.mutate()} disabled={create.isPending}>
                    {create.isPending ? "Creating…" : "Create collection point"}
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
            placeholder="Search by code or name…"
            className="max-w-xs"
            value={search.q ?? ""}
            onChange={(e) => navigate({ search: { ...search, q: e.target.value || undefined } })}
          />
          <Select
            value={search.status ?? "ALL"}
            onValueChange={(v) => navigate({ search: { ...search, status: v === "ALL" ? undefined : v } })}
          >
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={search.partner ?? "ALL"}
            onValueChange={(v) => navigate({ search: { ...search, partner: v === "ALL" ? undefined : v } })}
          >
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All partners</SelectItem>
              {(partners.data ?? []).map((p: Partner) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {points.isError ? (
            <ErrorState error={points.error} onRetry={() => points.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              rows={points.data?.data}
              isLoading={points.isLoading}
              error={points.error}
              onRetry={() => points.refetch()}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate({ to: "/collection/bags", search: { q: undefined, status: undefined, cp: r.id } })}

              emptyTitle="No collection points found"
              emptyDescription="Adjust the filters or create the first collection point for this organization."
            />
          )}
        </CardContent>
      </Card>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Factory className="h-3.5 w-3.5" /> Click a row to see its issued bags.
      </p>
    </div>
  );
}
