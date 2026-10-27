import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { PageHeader, ErrorState } from "@/components/shared/StateViews";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { IdChip } from "@/components/shared/IdChip";
import { Timeline, type TimelineEntry } from "@/components/shared/Timeline";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { custody } from "@/lib/api";
import { formatDateTime } from "@/lib/api/formatters";
import type { CustodyStatus, CustodyTransfer } from "@/lib/api/types";
import { useAppSession } from "@/lib/app-session";

export const Route = createFileRoute("/custody")({
  head: () => ({
    meta: [
      { title: "Custody Transfers — WeaveLoop" },
      { name: "description", content: "Initiate and acknowledge custody transfers between holders. PENDING, ACCEPTED, REJECTED." },
      { property: "og:title", content: "Custody Transfers — WeaveLoop" },
      { property: "og:description", content: "Track bag custody between holders with full acknowledgment timelines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { status?: string; q?: string } => ({
    status: typeof search["status"] === "string" ? search["status"] : undefined,
    q: typeof search["q"] === "string" ? search["q"] : undefined,
  }),

  component: CustodyPage,
});

function CustodyPage() {
  const { activeOrg, role } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();

  const transfers = useQuery({
    queryKey: ["custody", orgId, search],
    queryFn: () =>
      custody.listTransfers(orgId, {
        status: (search.status as CustodyStatus | undefined) ?? undefined,
        search: search.q,
        page: 1,
        pageSize: 50,
      }),
    enabled: !!orgId,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const ack = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "ACCEPTED" | "REJECTED" }) =>
      custody.acknowledge(orgId, id, decision, decision === "REJECTED" ? rejectNote || undefined : undefined),
    onSuccess: (t) => {
      toast.success(`Transfer ${t.status.toLowerCase()}`, {
        description: t.status === "ACCEPTED" ? "Custody moved to the receiving holder." : "Returned to the originating holder with a note.",
      });
      setRejectNote("");
      qc.invalidateQueries({ queryKey: ["custody"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error("Could not acknowledge transfer", { description: err instanceof Error ? err.message : undefined }),
  });

  const columns: Column<CustodyTransfer>[] = [
    { key: "id", header: "Transfer ID", render: (r) => <IdChip id={r.id} /> },
    { key: "bag", header: "Bag", sortValue: (r) => r.bag?.code ?? "", render: (r) => <span className="id-mono font-medium">{r.bag?.code ?? r.bagId}</span> },
    { key: "from", header: "From holder", render: (r) => r.fromHolderName },
    { key: "to", header: "To holder", render: (r) => r.toHolderName },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "initiator", header: "Initiated by", render: (r) => <span className="text-muted-foreground">{r.initiatedByName ?? "—"}</span> },
    { key: "initiatedAt", header: "Initiated", sortValue: (r) => r.initiatedAt, render: (r) => <span className="text-muted-foreground">{formatDateTime(r.initiatedAt)}</span> },
    { key: "acknowledgedAt", header: "Acknowledged", render: (r) => <span className="text-muted-foreground">{r.acknowledgedAt ? formatDateTime(r.acknowledgedAt) : "—"}</span> },
  ];

  const selected = (transfers.data?.data ?? []).find((t) => t.id === selectedId) ?? null;
  const timeline: TimelineEntry[] = selected
    ? [
        {
          title: `Transfer initiated — ${selected.fromHolderName} → ${selected.toHolderName}`,
          actor: selected.initiatedByName,
          timestamp: selected.initiatedAt,
          detail: selected.note,
          tone: "info",
        },
        ...(selected.acknowledgedAt
          ? [
              {
                title: `Acknowledged as ${selected.status.toLowerCase()}`,
                actor: selected.acknowledgedByName ?? undefined,
                timestamp: selected.acknowledgedAt,
                detail: selected.status === "REJECTED" ? selected.note : undefined,
                tone: (selected.status === "ACCEPTED" ? "success" : "danger") as TimelineEntry["tone"],
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Custody & Transfers"
        description="Bags move between holders through acknowledged transfers. A transfer never silently overwrites earlier custody records."
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Input
            placeholder="Search bag or holder…"
            className="max-w-xs"
            value={search.q ?? ""}
            onChange={(e) => navigate({ search: { ...search, q: e.target.value || undefined } })}
          />
          <Select value={search.status ?? "ALL"} onValueChange={(v) => navigate({ search: { ...search, status: v === "ALL" ? undefined : v } })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="ACCEPTED">Accepted</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {transfers.isError ? (
            <ErrorState error={transfers.error} onRetry={() => transfers.refetch()} />
          ) : (
            <DataTable
              columns={columns}
              rows={transfers.data?.data}
              isLoading={transfers.isLoading}
              error={transfers.error}
              onRetry={() => transfers.refetch()}
              rowKey={(r) => r.id}
              onRowClick={(r) => setSelectedId(r.id)}
              emptyTitle="No custody transfers"
              emptyDescription="Transfers appear here once initiated from a bag detail page."
            />
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Transfer <IdChip id={selected?.id ?? ""} />
              {selected ? <StatusBadge status={selected.status} /> : null}
            </SheetTitle>
            <SheetDescription>
              Bag {selected?.bag?.code} · {selected?.fromHolderName} → {selected?.toHolderName}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            <Timeline entries={timeline} />

            {selected?.status === "PENDING" ? (
              <PermissionGate capability="write" fallback={<p className="text-xs text-muted-foreground">Your role ({role}) cannot acknowledge transfers.</p>}>
                <div className="space-y-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">Acknowledge this transfer</p>
                  <div className="space-y-1">
                    <Label htmlFor="rej-note">Rejection note (required only when rejecting)</Label>
                    <Textarea id="rej-note" rows={2} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Reason: damaged seal, wrong contents…" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => ack.mutate({ id: selected.id, decision: "ACCEPTED" })}
                      disabled={ack.isPending}
                    >
                      <Check className="mr-2 h-4 w-4" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => ack.mutate({ id: selected.id, decision: "REJECTED" })}
                      disabled={ack.isPending || !rejectNote.trim()}
                    >
                      <X className="mr-2 h-4 w-4" /> Reject
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Accepting moves custody to {selected.toHolderName}. Rejection returns the bag to {selected.fromHolderName}.</p>
                </div>
              </PermissionGate>
            ) : null}

            {selected?.status !== "PENDING" ? (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                This transfer is {selected?.status.toLowerCase()} and can no longer be re-acknowledged.
              </p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
