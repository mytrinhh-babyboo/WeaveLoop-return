import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { truncateId } from "@/lib/api/formatters";
import { cn } from "@/lib/utils";

/** Truncated identifier with copy-to-clipboard. */
export function IdChip({ id, className, mono = true }: { id: string; className?: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — still show the id */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy: ${id}`}
      className={cn(
        "inline-flex max-w-[220px] items-center gap-1.5 rounded border border-transparent px-1 py-0.5 text-left hover:border-border hover:bg-muted/60",
        mono && "id-mono",
        className,
      )}
    >
      <span className="truncate">{truncateId(id)}</span>
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}
