import type { PricingSummary } from "@/types";

interface PricingSummaryBarProps {
  summary: PricingSummary;
}

export function PricingSummaryBar({ summary }: PricingSummaryBarProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#94a3b8] py-2">
      <span className="text-[#334155] font-medium">
        {summary.total_items} item{summary.total_items !== 1 ? "s" : ""}
      </span>
      <span>&middot;</span>
      <span className="text-[#334155] font-medium">
        {summary.override_count} custom price
        {summary.override_count !== 1 ? "s" : ""}
      </span>
      <span>&middot;</span>
      <span className="text-[#334155] font-medium">
        {summary.override_percentage.toFixed(1)}% customized
      </span>
    </div>
  );
}
