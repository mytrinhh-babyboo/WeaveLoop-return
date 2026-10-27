import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { QrCode, ScanLine } from "lucide-react";
import { PageHeader, ErrorState } from "@/components/shared/StateViews";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { QRDisplay } from "@/components/shared/QRDisplay";
import { WeightDisplay } from "@/components/shared/WeightDisplay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { collection } from "@/lib/api";
import { formatDate } from "@/lib/api/formatters";
import { useAppSession } from "@/lib/app-session";

export const Route = createFileRoute("/collection/qr")({
  head: () => ({
    meta: [
      { title: "QR Bag Lookup — WeaveLoop" },
      { name: "description", content: "Look up a collection bag by QR code. Scanning identifies records; it never performs custody or weighing actions." },
      { property: "og:title", content: "QR Bag Lookup — WeaveLoop" },
      { property: "og:description", content: "Scan or type a bag code to see its current state." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QrLookupPage,
});

function QrLookupPage() {
  const { activeOrg } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const [code, setCode] = useState("");

  const lookup = useQuery({
    queryKey: ["qr-lookup", orgId, code],
    queryFn: () => collection.lookupBagByCode(orgId, code),
    enabled: code.trim().length >= 4 && !!orgId,
    retry: false,
  });

  const bag = lookup.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="QR Bag Lookup"
        description="Scanning identifies a record. It can never trigger a custody transition or a weighing on its own."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Scan or enter bag code</CardTitle>
            <CardDescription>On camera-equipped devices this field pairs with the device scanner; enter the code manually on desktop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                placeholder="BAG-SGN-001-012"
                className="id-mono max-w-sm"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-label="Bag code"
              />
            </div>
            {code.trim().length >= 4 ? (
              lookup.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : lookup.isError ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  No bag found for “{code}” in {activeOrg?.organization.name}. Check the code or switch organization.
                </p>
              ) : bag ? (
                <div className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="id-mono text-sm font-semibold">{bag.code}</p>
                      <p className="text-xs text-muted-foreground">{bag.collectionPoint?.name}</p>
                    </div>
                    <StatusBadge status={bag.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div><dt className="text-muted-foreground">Issued</dt><dd>{formatDate(bag.issuedAt)}</dd></div>
                    <div><dt className="text-muted-foreground">Activated</dt><dd>{bag.activatedAt ? formatDate(bag.activatedAt) : "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Closed</dt><dd>{bag.closedAt ? formatDate(bag.closedAt) : "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Bag ID</dt><dd className="id-mono truncate">{bag.id}</dd></div>
                  </dl>
                  <div className="mt-3 flex gap-2">

                    <Button asChild size="sm">
                      <Link to="/collection/bags/$bagId" params={{ bagId: bag.id }}>Open bag details</Link>
                    </Button>
                  </div>
                </div>
              ) : null
            ) : (
              <p className="text-sm text-muted-foreground">Type at least 4 characters of the bag code to look it up.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">What scanning does</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="flex gap-2"><QrCode className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> A QR resolves to exactly one bag record and its current state.</p>
            <p>Weighing and custody changes always require an authorized operator to confirm them explicitly — a scan alone can never move custody or add weight.</p>
            <p>Try a demo code such as <span className="id-mono text-foreground">BAG-SGN-001-001</span>.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
