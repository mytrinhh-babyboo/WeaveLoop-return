/**
 * Formatting helpers.
 *
 * Weights are ALWAYS stored and transmitted in exact grams. Display converts
 * to kg or tonnes without altering the underlying value.
 */
export function formatGrams(grams: number, opts: { unit?: "auto" | "kg" | "t"; digits?: number } = {}): string {
  const { unit = "auto", digits } = opts;
  if (!Number.isFinite(grams)) return "—";
  if (unit === "t" || (unit === "auto" && Math.abs(grams) >= 1_000_000)) {
    const t = grams / 1_000_000;
    return `${t.toLocaleString("en-US", { maximumFractionDigits: digits ?? 2 })} t`;
  }
  const kg = grams / 1000;
  return `${kg.toLocaleString("en-US", { maximumFractionDigits: digits ?? (Math.abs(kg) < 100 ? 2 : 1) })} kg`;
}

/** Compact KPI form, e.g. 12.45 t or 840 kg. */
export function formatGramsCompact(grams: number): string {
  return formatGrams(grams, { digits: Math.abs(grams) >= 1_000_000 ? 2 : 1 });
}


/** Truncate long identifiers with an ellipsis in the middle. */
export function truncateId(id: string, head = 8, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Relative time for activity feeds. */
export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}
