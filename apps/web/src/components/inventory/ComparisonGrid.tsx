import { cn } from "@/lib/utils";
import type { ComparisonResponse } from "@/types/inventory";

interface ComparisonGridProps {
  data: ComparisonResponse;
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function varianceBg(variance: number | null): string {
  if (variance === null) return "";
  if (variance > 0) return "bg-[#2d4a2d]/8"; // green tint — produced more
  if (variance < 0) return "bg-[#c27890]/10"; // rose tint — produced less
  return "";
}

export function ComparisonGrid({ data }: ComparisonGridProps) {
  const { pull_days, product_lines, summary } = data;

  return (
    <div className="overflow-x-auto rounded-lg border border-[#e0ddd8] bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e0ddd8] bg-[#f4f1ec]/60">
            <th className="px-4 py-3 text-left font-semibold text-[#1e3a5f] min-w-[180px]">
              Variety
            </th>
            {pull_days.map((day) => (
              <th
                key={day}
                colSpan={2}
                className="px-2 py-3 text-center font-semibold text-[#1e3a5f] border-l border-[#e0ddd8]"
              >
                {formatDay(day)}
              </th>
            ))}
          </tr>
          <tr className="border-b border-[#e0ddd8] bg-[#f4f1ec]/30">
            <th className="px-4 py-1.5" />
            {pull_days.map((day) => (
              <th key={day} className="border-l border-[#e0ddd8]">
                <div className="flex">
                  <span className="flex-1 px-2 py-1.5 text-center text-xs font-medium text-[#94a3b8]">
                    Est
                  </span>
                  <span className="flex-1 px-2 py-1.5 text-center text-xs font-medium text-[#94a3b8] border-l border-[#e0ddd8]/50">
                    Act
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {product_lines.map((pl) => (
            <ProductLineSection key={pl.product_line_name} productLine={pl} pullDays={pull_days} />
          ))}
        </tbody>
        {/* Summary row */}
        <tfoot>
          <tr className="border-t-2 border-[#e0ddd8] bg-[#f4f1ec]/40">
            <td className="px-4 py-3 font-semibold text-[#1e3a5f]">
              Totals
            </td>
            <td
              colSpan={pull_days.length * 2}
              className="px-4 py-3 border-l border-[#e0ddd8]"
            >
              <div className="flex items-center gap-6 text-sm">
                <span className="text-[#334155]">
                  Estimated: <strong className="tabular-nums">{summary.total_estimated}</strong>
                </span>
                <span className="text-[#334155]">
                  Actual: <strong className="tabular-nums">{summary.total_actual}</strong>
                </span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    summary.variance_pct != null && summary.variance_pct > 0
                      ? "text-[#2d4a2d]"
                      : summary.variance_pct != null && summary.variance_pct < 0
                      ? "text-[#c27890]"
                      : "text-[#334155]"
                  )}
                >
                  {summary.variance_pct != null
                    ? `${summary.variance_pct > 0 ? "+" : ""}${summary.variance_pct.toFixed(1)}% variance`
                    : "N/A"}
                </span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ProductLineSection({
  productLine,
  pullDays,
}: {
  productLine: ComparisonResponse["product_lines"][number];
  pullDays: string[];
}) {
  return (
    <>
      {/* Section header */}
      <tr className="border-t border-[#e0ddd8]">
        <td
          colSpan={1 + pullDays.length * 2}
          className="px-4 py-2 bg-[#f4f1ec]/50"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
            {productLine.product_line_name}
          </span>
        </td>
      </tr>
      {/* Variety rows */}
      {productLine.varieties.map((v) => (
        <tr key={v.variety_name} className="border-t border-[#e0ddd8]/60 hover:bg-[#f4f1ec]/20">
          <td className="px-4 py-2.5 text-[#334155]">{v.variety_name}</td>
          {pullDays.map((day) => {
            const cell = v.days[day];
            const estimate = cell?.estimate;
            const actual = cell?.actual;
            const variance = cell?.variance;

            return (
              <td
                key={day}
                className={cn(
                  "border-l border-[#e0ddd8]",
                  varianceBg(variance)
                )}
              >
                <div className="flex">
                  <span className="flex-1 px-2 py-2.5 text-center tabular-nums text-[#334155]">
                    {estimate ?? "—"}
                  </span>
                  <span className="flex-1 px-2 py-2.5 text-center tabular-nums text-[#334155] border-l border-[#e0ddd8]/50">
                    {actual ?? "—"}
                  </span>
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
