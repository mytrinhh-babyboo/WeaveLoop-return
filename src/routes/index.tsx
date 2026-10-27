import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  Package,
  Recycle,
  Scale,
  ScanSearch,
  Truck,
  Warehouse,
} from "lucide-react";
import { PageHeader, ErrorState, EmptyState } from "@/components/shared/StateViews";

import { StatCard, StatCardSkeleton } from "@/components/shared/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis, CartesianGrid } from "recharts";

import { dashboard, formatGramsCompact, formatGrams, isMockMode } from "@/lib/api";

import { useAppSession } from "@/lib/app-session";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@/lib/api/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard — WeaveLoop" },
      { name: "description", content: "Collection, custody, sorting and EPR-candidate KPIs for your organization, with an operational action center." },
      { property: "og:title", content: "Operations Dashboard — WeaveLoop" },
      { property: "og:description", content: "Collection, custody, sorting and EPR-candidate KPIs with an operational action center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const RANGES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
] as const;

function Dashboard() {
  const { activeOrg } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("30d");
  const range = useMemo(() => {
    const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 30;
    const to = new Date();
    const from = new Date(Date.now() - days * 24 * 3600 * 1000);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [rangeKey]);

  const kpis = useQuery({
    queryKey: ["dashboard", "kpis", orgId, range],
    queryFn: () => dashboard.getKpis(orgId, range),
    enabled: !!orgId,
  });
  const volume = useQuery({
    queryKey: ["dashboard", "volume", orgId, range],
    queryFn: () => dashboard.getCollectionVolume(orgId, range),
    enabled: !!orgId,
  });
  const actions = useQuery({
    queryKey: ["dashboard", "actions", orgId],
    queryFn: () => dashboard.getActions(orgId),
    enabled: !!orgId,
  });

  const k = kpis.data;
  const flow = k
    ? [
        { label: "Collected", grams: k.collectedGrams, color: "var(--chart-1)" },
        { label: "Warehouse received", grams: k.warehouseReceivedGrams, color: "var(--chart-2)" },
        { label: "Sorting accepted", grams: k.sortingAcceptedGrams, color: "var(--chart-3)" },
        { label: "Rejected", grams: k.sortingRejectedGrams, color: "var(--chart-4)" },
        { label: "Loss", grams: k.sortingLossGrams, color: "var(--chart-5)" },
        { label: "Recycler received", grams: k.recyclerReceivedGrams, color: "var(--chart-1)" },
        { label: "EPR candidate", grams: k.candidateEprEligibleGrams, color: "var(--chart-2)" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        description={`Material accounting for ${activeOrg?.organization.name ?? "your organization"} — each metric keeps its own stage in the chain; collected and verified-recycled weights are never merged.`}
        actions={
          <Tabs value={rangeKey} onValueChange={(v) => setRangeKey(v as typeof rangeKey)}>
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r.key} value={r.key}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      {kpis.isError ? (
        <Card>
          <ErrorState error={kpis.error} onRetry={() => kpis.refetch()} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.isLoading || !k ? (
            Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard label="Total collected weight" value={formatGramsCompact(k.collectedGrams)} icon={Scale} hint="Weighing events · exact grams" />
              <StatCard label="Warehouse received" value={formatGramsCompact(k.warehouseReceivedGrams)} icon={Warehouse} hint="Accepted custody receipts" />
              <StatCard label="Sorting accepted" value={formatGramsCompact(k.sortingAcceptedGrams)} icon={ScanSearch} hint="Quality-checked output" />
              <StatCard label="Rejected material" value={formatGramsCompact(k.sortingRejectedGrams)} icon={Package} tone="warning" hint="Not suitable for recycling" />
              <StatCard label="Recycler received" value={formatGramsCompact(k.recyclerReceivedGrams)} icon={Recycle} hint="Documented handovers" />
              <StatCard label="Candidate EPR-eligible" value={formatGramsCompact(k.candidateEprEligibleGrams)} icon={ClipboardList} tone="success" hint="Internal draft candidates — not verified claims" />
              <StatCard label="Active collection points" value={k.activeCollectionPoints} icon={Recycle} hint={`${k.activeBags} active bags in circulation`} />
              <StatCard label="Pending items" value={k.pendingCustodyTransfers + k.pendingEvidenceReviews} icon={Truck} tone={k.pendingCustodyTransfers > 0 ? "warning" : "default"} hint={`${k.pendingCustodyTransfers} custody transfers · ${k.pendingEvidenceReviews} evidence reviews`} />
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Collection volume over time</CardTitle>
            <CardDescription>
              Recorded weighing events, {range.from} → {range.to}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {volume.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (volume.data?.length ?? 0) === 0 ? (
              <EmptyState title="No weighings in this period" description="Recorded weights will chart here as operators record bag weighings." icon={Scale} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volume.data}>
                  <defs>
                    <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(g: number) => formatGramsCompact(g)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={56} />
                  <ChartTooltip
                    formatter={(value) => [formatGrams(Number(value)), "Collected"]}
                    labelStyle={{ color: "var(--foreground)" }}
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="grams" stroke="var(--chart-1)" strokeWidth={2} fill="url(#volFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Material flow</CardTitle>
            <CardDescription>Each stage is a separate metric — never combined into one number</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {kpis.isLoading || !k ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flow} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="label" type="category" width={124} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <ChartTooltip
                    formatter={(value) => [formatGrams(Number(value)), "Mass"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }}
                  />
                  <Bar dataKey="grams" radius={[0, 4, 4, 0]} barSize={14}>
                    {flow.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <ActionCenter actions={actions.data} isLoading={actions.isLoading} error={actions.error} onRetry={() => actions.refetch()} />

      <p className="text-xs text-muted-foreground">
        Source: {isMockMode() ? "in-browser demo dataset (clearly labeled demo data)" : "WeaveLoop API"} · range {range.from} → {range.to}
        {k ? ` · generated ${new Date(k.generatedAt).toLocaleTimeString("en-GB")}` : ""} · Definitions: collected = weighing events; received = accepted warehouse receipts; accepted/rejected = sorting records; recycler = receipts; candidate EPR = receipts with linkable evidence, draft status only.
      </p>
    </div>
  );
}

const CATEGORY_ICON: Record<ActionItem["category"], typeof Truck> = {
  custody_pending: Truck,
  bag_awaiting_receipt: Package,
  sorting_gap: ScanSearch,
  missing_evidence: ClipboardList,
  evidence_review: ClipboardList,
  document_rejected: ScanSearch,
  draft_needs_review: ClipboardList,
};

function ActionCenter({
  actions,
  isLoading,
  error,
  onRetry,
}: {
  actions: ActionItem[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Action center</CardTitle>
        <CardDescription>Operational items that need a person, ranked by severity</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (actions?.length ?? 0) === 0 ? (
          <EmptyState title="Nothing needs attention" description="Every recorded transfer, receipt and evidence item is acknowledged and reviewed." />
        ) : (
          <ul className="space-y-2">
            {actions?.map((item) => {
              const Icon = CATEGORY_ICON[item.category] ?? ClipboardList;
              return (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent",
                      item.severity === "danger" && "border-destructive/30 bg-destructive/5",
                      item.severity === "warning" && "border-warning/30 bg-warning-soft/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        item.severity === "danger" && "bg-destructive/10 text-destructive",
                        item.severity === "warning" && "bg-warning-soft text-warning",
                        item.severity === "info" && "bg-info-soft text-info",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
