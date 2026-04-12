import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvailabilityProductType } from "@/types/inventory";

interface AvailabilityCardProps {
  productType: AvailabilityProductType;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AvailabilityCard({ productType }: AvailabilityCardProps) {
  const [expanded, setExpanded] = useState(true);

  const isActual = productType.data_source === "actual_counts";

  return (
    <div className="rounded-lg border border-[#e0ddd8] bg-white overflow-hidden">
      {/* Header — clickable to collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#f4f1ec]/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-[#94a3b8] shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#94a3b8] shrink-0" />
        )}
        <span className="text-lg font-semibold text-[#1e3a5f]">
          {productType.product_type_name}
        </span>
      </button>

      {/* Status banner */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-sm",
          isActual
            ? "bg-[#2d4a2d]/10 text-[#2d4a2d] border-t border-[#8fbc8f]/30"
            : "bg-[#fef3c7] text-[#92400e] border-t border-[#f59e0b]/30"
        )}
      >
        {isActual ? (
          <>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Actual counts — updated{" "}
              {productType.counts_completed_at
                ? formatTime(productType.counts_completed_at)
                : ""}
              {productType.counts_completed_by
                ? ` by ${productType.counts_completed_by}`
                : ""}
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Estimates only — counts not yet submitted</span>
          </>
        )}
      </div>

      {/* Variety list */}
      {expanded && (
        <div className="divide-y divide-[#e0ddd8]/60">
          {productType.product_lines.map((pl) => (
            <div key={pl.product_line_name}>
              {/* Product line header */}
              <div className="px-4 py-2 bg-[#f4f1ec]/50">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  {pl.product_line_name}
                </span>
              </div>
              {/* Varieties */}
              {pl.varieties.map((v) => {
                const displayValue = v.remaining_count ?? v.estimate;
                const isEstimate = v.remaining_count === null || v.remaining_count === undefined;

                return (
                  <div
                    key={v.variety_name}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-[#f4f1ec]/30"
                  >
                    <span className="text-sm text-[#334155]">{v.variety_name}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          displayValue === null || displayValue === undefined
                            ? "text-[#94a3b8]"
                            : "text-[#334155]"
                        )}
                      >
                        {displayValue ?? "—"}
                      </span>
                      {isEstimate && displayValue !== null && displayValue !== undefined && (
                        <span className="text-xs text-[#f59e0b]">(est)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {productType.product_lines.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[#94a3b8]">
              No varieties available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
