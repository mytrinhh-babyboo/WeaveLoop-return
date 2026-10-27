import { cn } from "@/lib/utils";

/**
 * MassBalance visualizes warehouse received mass against sorting outcomes.
 * It renders only the recorded inputs — it never fabricates mass to force
 * records to balance.
 */
export function MassBalance({
  receivedGrams,
  acceptedGrams,
  rejectedGrams,
  lossGrams,
  className,
}: {
  receivedGrams: number;
  acceptedGrams: number;
  rejectedGrams: number;
  lossGrams: number;
  className?: string;
}) {
  const total = Math.max(receivedGrams, 1);
  const pct = (g: number) => Math.max(0, (g / total) * 100);
  const allocated = acceptedGrams + rejectedGrams + lossGrams;
  const discrepancy = receivedGrams - allocated;

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Warehouse received</p>
        <div className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`Received ${receivedGrams} grams: accepted, rejected, loss breakdown`}>
          <div className="bg-chart-3" style={{ width: `${pct(acceptedGrams)}%` }} />
          <div className="bg-chart-4" style={{ width: `${pct(rejectedGrams)}%` }} />
          <div className="bg-chart-5" style={{ width: `${pct(lossGrams)}%` }} />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BalanceItem label="Accepted" grams={acceptedGrams} dot="bg-chart-3" />
        <BalanceItem label="Rejected" grams={rejectedGrams} dot="bg-chart-4" />
        <BalanceItem label="Loss" grams={lossGrams} dot="bg-chart-5" />
        <BalanceItem label="Received" grams={receivedGrams} dot="bg-border" />
      </dl>
      {discrepancy !== 0 ? (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
          Unallocated difference: {(discrepancy / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} kg between received mass and sorting outcome. Investigate before treating this record as balanced.
        </p>
      ) : null}
    </div>
  );
}

function BalanceItem({ label, grams, dot }: { label: string; grams: number; dot: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />
        <dt className="text-xs text-muted-foreground">{label}</dt>
      </div>
      <dd className="mt-1 text-sm font-semibold tabular-nums">{(grams / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} kg</dd>
    </div>
  );
}
