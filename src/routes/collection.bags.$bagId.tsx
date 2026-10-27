import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Scale, Truck } from "lucide-react";
import { PageHeader, ErrorState } from "@/components/shared/StateViews";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WeightDisplay, WeightExact } from "@/components/shared/WeightDisplay";
import { QRDisplay } from "@/components/shared/QRDisplay";
import { Timeline, type TimelineEntry } from "@/components/shared/Timeline";
import { IdChip } from "@/components/shared/IdChip";
import { PermissionGate } from "@/components/shared/PermissionGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { collection, custody, formatGrams } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/api/formatters";
import { useAppSession } from "@/lib/app-session";

export const Route = createFileRoute("/collection/bags/$bagId")({
  head: () => ({
    meta: [
      { title: "Bag Details — WeaveLoop" },
      { name: "description", content: "Bag identity, QR, weighing and custody timeline, and evidence references." },
      { property: "og:title", content: "Bag Details — WeaveLoop" },
      { property: "og:description", content: "Bag identity, QR, weighing and custody timeline, and evidence references." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BagDetailPage,
});

function BagDetailPage() {
  const { bagId } = Route.useParams();
  const { activeOrg } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const bag = useQuery({
    queryKey: ["bag", orgId, bagId],
    queryFn: () => collection.getBag(orgId, bagId),
    enabled: !!orgId,
    retry: false,
  });
  const weighings = useQuery({
    queryKey: ["weighings", orgId, { bagId }],
    queryFn: () => collection.listWeighings(orgId, { bagId, pageSize: 50 }),
    enabled: !!orgId,
  });
  const transfers = useQuery({
    queryKey: ["custody", orgId, { bagId }],
    queryFn: () => custody.listTransfers(orgId, { pageSize: 50 }),
    enabled: !!orgId,
  });

  const [transferOpen, setTransferOpen] = useState(false);
  const [toHolder, setToHolder] = useState("SGN Consolidation Warehouse");
  const [note, setNote] = useState("");
  const createTransfer = useMutation({
    mutationFn: () => custody.createTransfer(orgId, { bagId, toHolderName: toHolder, note: note || undefined }),
    onSuccess: (t) => {
      toast.success("Custody transfer initiated", { description: `Transfer for bag ${bag.data?.code} is pending acknowledgment by ${t.toHolderName}.` });
      setTransferOpen(false);
      qc.invalidateQueries({ queryKey: ["custody"] });
    },
    onError: (err) => toast.error("Could not initiate transfer", { description: err instanceof Error ? err.message : undefined }),
  });

  const totalGrams = (weighings.data?.data ?? []).reduce((s, w) => s + w.weightGrams, 0);
  const bagTransfers = (transfers.data?.data ?? []).filter((t) => t.bagId === bagId);

  const weighingTimeline: TimelineEntry[] = (weighings.data?.data ?? []).map((w) => ({
    title: `${formatGrams(w.weightGrams)} weighed`,
    actor: w.actorName,
    timestamp: w.occurredAt,
    detail: `Source: ${w.source.replaceAll("_", " ").toLowerCase()}${w.notes ? ` · ${w.notes}` : ""}`,
    tone: "info",
  }));
  const custodyTimeline: TimelineEntry[] = bagTransfers.map((t) => ({
    title: `Custody ${t.status.toLowerCase()} — to ${t.toHolderName}`,
    actor: t.acknowledgedByName ?? t.initiatedByName,
    timestamp: t.acknowledgedAt ?? t.initiatedAt,
    detail: t.note,
    tone: t.status === "ACCEPTED" ? "success" : t.status === "REJECTED" ? "danger" : "warning",
  }));

  if (bag.isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/collection/bags" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to bags
        </Button>
        <Card>
          <ErrorState error={bag.error} onRetry={() => bag.refetch()} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/collection/bags" })}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to bags
      </Button>

      {bag.isLoading || !bag.data ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            title={bag.data.code}
            description={`Issued ${formatDate(bag.data.issuedAt)} at ${bag.data.collectionPoint?.name ?? "—"}`}
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge status={bag.data.status} />
                <PermissionGate capability="write" fallback={<p className="text-xs text-muted-foreground">Read-only role</p>}>
                  <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><Truck className="mr-2 h-4 w-4" /> Initiate custody transfer</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Initiate custody transfer</DialogTitle>
                        <DialogDescription>
                          The receiving holder must acknowledge this transfer. Nothing is overwritten silently.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="ct-holder">Receiving holder</Label>
                          <Input id="ct-holder" value={toHolder} onChange={(e) => setToHolder(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="ct-note">Note (optional)</Label>
                          <Input id="ct-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Condition on handover…" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
                        <Button onClick={() => createTransfer.mutate()} disabled={!toHolder.trim() || createTransfer.isPending}>
                          {createTransfer.isPending ? "Initiating…" : "Initiate transfer"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </PermissionGate>
              </div>
            }
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Bag identity & QR</CardTitle>
                <CardDescription>Scanning performs a lookup only — never an action</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-center">
                  <QRDisplay value={bag.data.code} />
                </div>
                <dl className="space-y-1.5 text-sm">
                  <Row label="Bag ID"><IdChip id={bag.data.id} /></Row>
                  <Row label="Status"><StatusBadge status={bag.data.status} /></Row>
                  <Row label="Collection point">
                    {bag.data.collectionPoint ? (
                      <Link to="/collection/points" className="text-primary hover:underline">{bag.data.collectionPoint.code}</Link>
                    ) : "—"}
                  </Row>
                  <Row label="Issued">{formatDate(bag.data.issuedAt)}</Row>
                  <Row label="Activated">{bag.data.activatedAt ? formatDate(bag.data.activatedAt) : "—"}</Row>
                  <Row label="Closed">{bag.data.closedAt ? formatDate(bag.data.closedAt) : "—"}</Row>
                  <Row label="Total weighed">
                    <span className="flex flex-col items-end">
                      <WeightDisplay grams={totalGrams} />
                      <WeightExact grams={totalGrams} />
                    </span>
                  </Row>
                </dl>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Operational timeline</CardTitle>
                <CardDescription>Weighing and custody events, with responsible actors</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="weighings">
                  <TabsList>
                    <TabsTrigger value="weighings">Weighings ({weighingTimeline.length})</TabsTrigger>
                    <TabsTrigger value="custody">Custody ({custodyTimeline.length})</TabsTrigger>
                    <TabsTrigger value="evidence">Evidence</TabsTrigger>
                  </TabsList>
                  <TabsContent value="weighings" className="mt-4">
                    <Timeline entries={weighingTimeline} />
                  </TabsContent>
                  <TabsContent value="custody" className="mt-4">
                    <Timeline entries={custodyTimeline} />
                  </TabsContent>
                  <TabsContent value="evidence" className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      Evidence references become available once this bag's material reaches a recycler receipt
                      (see <Link to="/recycling/receipts" className="text-primary hover:underline">Recycler Receipts</Link>).
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}
