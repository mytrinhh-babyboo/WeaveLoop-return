import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader, ErrorState } from "@/components/shared/StateViews";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WeightDisplay } from "@/components/shared/WeightDisplay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";
import { materials, formatGrams } from "@/lib/api";
import { formatDate } from "@/lib/api/formatters";
import type { LotOperation, MaterialLot } from "@/lib/api/types";
import { useAppSession } from "@/lib/app-session";

export const Route = createFileRoute("/materials/lots/$lotId")({
  head: () => ({
    meta: [
      { title: "Lot Lineage — WeaveLoop" },
      { name: "description", content: "Material lot ancestry and transformations with mass conservation checks." },
      { property: "og:title", content: "Lot Lineage — WeaveLoop" },
      { property: "og:description", content: "Material lot ancestry and transformations with mass conservation checks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LotDetailPage,
});

interface Graph {
  nodes: GraphNode[];
  edges: Array<{ from: string; to: string }>;
  lot: MaterialLot;
  operations: LotOperation[];
  lotById: Map<string, MaterialLot>;
}

interface GraphNode {
  id: string;
  kind: "lot" | "op";
  label: string;
  sub: string;
  level: number;
  order: number;
  lot?: MaterialLot;
  op?: LotOperation;
}


function LotDetailPage() {
  const { lotId } = Route.useParams();
  const { activeOrg } = useAppSession();
  const orgId = activeOrg?.organizationId ?? "";
  const navigate = useNavigate();

  const lineage = useQuery({
    queryKey: ["lineage", orgId, lotId],
    queryFn: () => materials.getLineage(orgId, lotId),
    enabled: !!orgId,
    retry: false,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  const graph = useMemo<Graph | null>(() => {
    if (!lineage.data) return null;
    const { lot, operations } = lineage.data;
    const nodes: GraphNode[] = [];
    const edges: Array<{ from: string; to: string }> = [];
    const levels = new Map<string, number>();
    levels.set(lot.id, 0);
    const lotById = new Map<string, MaterialLot>();
    lotById.set(lot.id, lot);

    const opNodes: GraphNode[] = [];
    let frontier: string[] = [lot.id];
    let guard = 0;
    const processed = new Set<string>();
    while (frontier.length && guard++ < 50) {
      const next: string[] = [];
      for (const op of operations) {
        if (processed.has(op.id)) continue;
        if (!op.inputs.some((i) => frontier.includes(i.lotId))) continue;
        processed.add(op.id);
        const opLevel = Math.min(...op.inputs.map((i) => levels.get(i.lotId) ?? 0)) - 1;
        opNodes.push({ id: op.id, kind: "op", label: op.type, sub: op.performedByName ?? "—", level: opLevel, order: opNodes.length, op });
        for (const input of op.inputs) {
          edges.push({ from: input.lotId, to: op.id });
          if (!levels.has(input.lotId)) levels.set(input.lotId, opLevel - 1);
          if (!lotById.has(input.lotId)) {
            lotById.set(input.lotId, {
              id: input.lotId,
              code: input.lotCode ?? input.lotId,
              massGrams: input.massGrams,
              consumptionStatus: "CONSUMED",
              createdAt: op.performedAt,
              sourceType: op.type === "MERGE" ? "MERGE" : "SPLIT",
            } as MaterialLot);
          }
          if (!next.includes(input.lotId)) next.push(input.lotId);
        }
      }
      frontier = next;
    }
    // Op → its recorded output lot, when that lot participates in this lineage
    for (const op of operations) {
      if (op.outputLotId === lot.id || lotById.has(op.outputLotId)) {
        edges.push({ from: op.id, to: op.outputLotId });
      }
    }
    nodes.push(...opNodes);
    nodes.push({ id: lot.id, kind: "lot", label: lot.code, sub: formatGrams(lot.massGrams), level: 0, order: 0, lot });
    for (const [id, l] of lotById) {
      if (id === lot.id) continue;
      nodes.push({ id, kind: "lot", label: l.code, sub: formatGrams(l.massGrams), level: levels.get(id) ?? -1, order: nodes.length, lot: l });
    }
    return { nodes, edges, lot, operations, lotById };
  }, [lineage.data]);


  if (lineage.isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/materials/lots" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to lots
        </Button>
        <Card><ErrorState error={lineage.error} onRetry={() => lineage.refetch()} /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/materials/lots" })}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to lots
      </Button>

      {lineage.isLoading || !lineage.data || !graph ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : (
        <>
          <PageHeader
            title={lineage.data.lot.code}
            description={`${lineage.data.lot.sourceType} source · created ${formatDate(lineage.data.lot.createdAt)}`}
            actions={<StatusBadge status={lineage.data.lot.consumptionStatus} />}
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Lineage graph</CardTitle>
                <CardDescription>
                  Only recorded operations are shown. Scroll to zoom, drag to pan, click a node for details. Connections without source records are never inferred.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LineageSvg graph={graph} zoom={zoom} setZoom={setZoom} svgRef={svgRef} onSelect={setSelected} selectedId={selected} />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Mass conservation</CardTitle>
                  <CardDescription>Input mass must equal output mass across every recorded operation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {graph.operations.length === 0 ? (
                    <p className="text-muted-foreground">No split or merge operations involve this lot yet.</p>
                  ) : (
                    graph.operations.map((op) => {
                      const inputSum = op.inputs.reduce((s, i) => s + i.massGrams, 0);
                      const outputMass = graph.lotById.get(op.outputLotId)?.massGrams;
                      // Conservation is only asserted when both sides are fully
                      // visible in recorded records; splits with sibling outputs
                      // outside this lineage are never forced to "balance".
                      const status =
                        op.type === "MERGE" && outputMass !== undefined
                          ? Math.abs(inputSum - outputMass) <= 1
                            ? "CONSISTENT"
                            : "DISCREPANCY"
                          : null;
                      return (
                        <div key={op.id} className="rounded-md border p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">{op.type}</p>
                            {status ? <StatusBadge status={status} /> : <span className="text-xs text-muted-foreground">recorded</span>}
                          </div>
                          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                            Inputs {formatGrams(inputSum)}
                            {outputMass !== undefined && op.type === "MERGE" ? ` → output ${formatGrams(outputMass)}` : ""}
                          </p>
                        </div>
                      );
                    })
                  )}
                </CardContent>

              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Selection</CardTitle>
                </CardHeader>
                <CardContent>
                  {selected ? (
                    <NodeDetails nodeId={selected} graph={graph} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Click a node in the graph to inspect the lot or operation.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LineageSvg({
  graph,
  zoom,
  setZoom,
  svgRef,
  onSelect,
  selectedId,
}: {
  graph: Graph;
  zoom: number;
  setZoom: (z: number) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {

  const W = 900;
  const H = 520;
  const COL_W = 230;
  const NODE_W = 190;
  const NODE_H = 46;
  const GAP_Y = 84;

  const levels = [...new Set(graph.nodes.map((n) => n.level))].sort((a, b) => b - a); // top = oldest (most negative)
  const levelIndex = new Map(levels.map((l, i) => [l, i]));
  const byLevel = new Map<number, GraphNode[]>();
  for (const n of graph.nodes) {
    const arr = byLevel.get(n.level) ?? [];
    arr.push(n);
    byLevel.set(n.level, arr);
  }
  const pos = new Map<string, { x: number; y: number }>();
  for (const [level, arr] of byLevel) {
    const li = levelIndex.get(level) ?? 0;
    arr.forEach((n, i) => {
      pos.set(n.id, { x: 60 + li * COL_W, y: 50 + i * GAP_Y });
    });
  }

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className="overflow-hidden rounded-lg border bg-muted/20"
      onWheel={(e) => {
        e.preventDefault();
        setZoom(Math.min(2, Math.max(0.4, zoom - e.deltaY * 0.001)));
      }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Material lineage graph"
        onMouseDown={(e) => (drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y })}
        onMouseMove={(e) => {
          if (drag.current) setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
        }}
        onMouseUp={() => (drag.current = null)}
        onMouseLeave={() => (drag.current = null)}
        style={{ cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {graph.edges.map((edge, i) => {
            const from = pos.get(edge.from);
            const to = pos.get(edge.to);
            if (!from || !to) return null;
            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="var(--border)"
                strokeWidth={2}
                markerEnd="url(#arrow)"
              />
            );
          })}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border)" />
            </marker>
          </defs>
          {graph.nodes.map((n) => {
            const p = pos.get(n.id)!;
            const isOp = n.kind === "op";
            const isSelected = selectedId === n.id;
            return (
              <g key={n.id} transform={`translate(${p.x} ${p.y})`} onClick={() => onSelect(n.id)} style={{ cursor: "pointer" }}>
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={isOp ? 8 : 10}
                  fill={isOp ? "var(--primary-soft)" : isSelected ? "var(--primary)" : "var(--card)"}
                  stroke={isSelected ? "var(--primary)" : isOp ? "var(--primary)" : "var(--border)"}
                  strokeWidth={isSelected ? 2 : 1}
                />
                <text x={NODE_W / 2} y={20} textAnchor="middle" fontSize={12} fontWeight={600} fill={isSelected ? "var(--primary-foreground)" : isOp ? "var(--primary-dark)" : "var(--foreground)"}>
                  {n.label.length > 22 ? `${n.label.slice(0, 20)}…` : n.label}
                </text>
                <text x={NODE_W / 2} y={36} textAnchor="middle" fontSize={10} fill={isSelected ? "var(--primary-foreground)" : "var(--muted-foreground)"}>
                  {isOp ? n.sub : `${n.sub} · ${n.lot?.consumptionStatus?.toLowerCase() ?? ""}`}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <span>Zoom {(zoom * 100).toFixed(0)}%</span>
        <div className="flex gap-2">
          <button type="button" className="rounded border px-2 py-0.5 hover:bg-accent" onClick={() => setZoom(Math.min(2, zoom + 0.2))}>+</button>
          <button type="button" className="rounded border px-2 py-0.5 hover:bg-accent" onClick={() => setZoom(Math.max(0.4, zoom - 0.2))}>−</button>
          <button type="button" className="rounded border px-2 py-0.5 hover:bg-accent" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</button>
        </div>
      </div>
    </div>
  );
}

function NodeDetails({ nodeId, graph }: { nodeId: string; graph: { nodes: GraphNode[]; lotById: Map<string, MaterialLot>; operations: LotOperation[] } }) {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  if (node.kind === "lot") {
    const lot = graph.lotById.get(nodeId);
    return (
      <div className="space-y-2 text-sm">
        <p className="id-mono font-semibold">{lot?.code ?? nodeId}</p>
        <p>Mass: {lot ? formatGrams(lot.massGrams) : "—"}</p>
        <p>Consumption: {lot?.consumptionStatus?.toLowerCase() ?? "—"}</p>
        {lot?.recyclerReceiptId ? (
          <p>
            Recycler receipt:{" "}
            <Link to="/recycling/receipts" className="text-primary hover:underline">view receipts</Link>
          </p>
        ) : null}
      </div>
    );
  }
  const op = graph.operations.find((o) => o.id === nodeId);
  if (!op) return null;
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold">{op.type} operation</p>
      {op.inputs.map((i) => (
        <p key={i.lotId} className="tabular-nums text-muted-foreground">
          ← {i.lotCode ?? i.lotId}: {formatGrams(i.massGrams)}
        </p>
      ))}
      <p className="text-xs text-muted-foreground">Performed {formatDate(op.performedAt)} by {op.performedByName ?? "—"}</p>
    </div>
  );
}
