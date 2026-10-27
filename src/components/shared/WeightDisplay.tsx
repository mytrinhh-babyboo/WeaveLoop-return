import { formatGrams } from "@/lib/api/formatters";
import { cn } from "@/lib/utils";

/**
 * WeightDisplay shows exact-gram values in human units. The underlying value
 * is never rounded before it is sent to the API.
 */
export function WeightDisplay({
  grams,
  className,
  unit = "auto",
  size = "md",
}: {
  grams: number;
  className?: string;
  unit?: "auto" | "kg" | "t";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={cn("tabular-nums font-medium", size === "sm" && "text-xs", size === "md" && "text-sm", size === "lg" && "text-xl font-semibold", className)}>
      {formatGrams(grams, { unit })}
    </span>
  );
}

/** Secondary line showing the precise gram value. */
export function WeightExact({ grams, className }: { grams: number; className?: string }) {
  return (
    <span className={cn("text-xs text-muted-foreground tabular-nums", className)}>
      {grams.toLocaleString("en-US")} g
    </span>
  );
}
