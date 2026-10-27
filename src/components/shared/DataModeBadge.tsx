import { Database, RadioTower } from "lucide-react";
import { isMockMode } from "@/lib/api";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * DataModeBadge tells the user exactly where the numbers on screen come from:
 * the connected NestJS API or the clearly-labeled demo dataset.
 */
export function DataModeBadge() {
  const mock = isMockMode();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              mock ? "border-warning/30 bg-warning-soft text-warning" : "border-success/30 bg-success-soft text-success"
            }`}
          >
            {mock ? <Database className="h-3 w-3" aria-hidden /> : <RadioTower className="h-3 w-3" aria-hidden />}
            {mock ? "Demo data" : "Live API"}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {mock
            ? "Serving the in-browser demo dataset (VITE_USE_MOCK_API=true). Records are labeled demo data; mutations apply to the demo store only."
            : "Connected to the WeaveLoop API. Metrics derive from organization records."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
