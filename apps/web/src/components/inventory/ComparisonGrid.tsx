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
  if (variance > 0) return "bg-sidebar-hover/8"; // green tint — produced more
  if (variance < 0) return "bg-rose-action/10"; // rose tint — produced less
  return "";
}

export function ComparisonGrid({ data }: ComparisonGridProps) {
  const { pull_days, product_lines, summary } = data;

  return (
    <div className="overflow-x-auto rounded-lg border border-border-warm bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-warm bg-cream/60">
            <th className="px-4 py-3 text-left font-semibold text-slate-heading min-w-[180px]">
              Variety
            </th>
            {pull_days.map((day) => (
              <th
                key={day}
                colSpan={2}
                className="px-2 py-3 text-center font-semibold text-slate-heading border-l border-border-warm"
              >
                {formatDay(day)}
              </th>
            ))}
          </tr>
          <tr className="border-b border-border-warm bg-cream/30">
            <th className="px-4 py-1.5" />
            {pull_days.map((day) => (
              <th key={day} className="border-l border-border-warm">
                <div className="flex">
                  <span className="flex-1 px-2 py-1.5 text-center text-xs font-medium text-text-muted">
                    Est
                  </span>
                  <span className="flex-1 px-2 py-1.5 text-center text-xs font-medium text-text-muted border-l border-border-warm/50">
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
          <tr className="border-t-2 border-border-warm bg-cream/40">
            <td className="px-4 py-3 font-semibold text-slate-heading">
              Totals
            </td>
            <td
              colSpan={pull_days.length * 2}
              className="px-4 py-3 border-l border-border-warm"
            >
              <div className="flex items-center gap-6 text-sm">
                <span className="text-text-body">
                  Estimated: <strong className="tabular-nums">{summary.total_estimated}</strong>
                </span>
                <span className="text-text-body">
                  Actual: <strong className="tabular-nums">{summary.total_actual}</strong>
                </span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    summary.variance_pct != null && summary.variance_pct > 0
                      ? "text-sidebar-hover"
                      : summary.variance_pct != null && summary.variance_pct < 0
                      ? "text-rose-action"
                      : "text-text-body"
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
      <tr className="border-t border-border-warm">
        <td
          colSpan={1 + pullDays.length * 2}
          className="px-4 py-2 bg-cream/50"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {productLine.product_line_name}
          </span>
        </td>
      </tr>
      {/* Variety rows */}
      {productLine.varieties.map((v) => (
        <tr key={v.variety_name} className="border-t border-border-warm/60 hover:bg-cream/20">
          <td className="px-4 py-2.5 text-text-body">{v.variety_name}</td>
          {pullDays.map((day) => {
            const cell = v.days[day];
            const estimate = cell?.estimate;
            const actual = cell?.actual;
            const variance = cell?.variance;

            return (
              <td
                key={day}
                className={cn(
                  "border-l border-border-warm",
                  varianceBg(variance)
                )}
              >
                <div className="flex">
                  <span className="flex-1 px-2 py-2.5 text-center tabular-nums text-text-body">
                    {estimate ?? "—"}
                  </span>
                  <span className="flex-1 px-2 py-2.5 text-center tabular-nums text-text-body border-l border-border-warm/50">
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
