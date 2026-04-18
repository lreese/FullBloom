import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvailabilityProductType, AvailabilityVariety } from "@/types/inventory";

export type ViewMode = "counts" | "estimates";

interface AvailabilityCardProps {
  productType: AvailabilityProductType;
  defaultViewMode?: ViewMode;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

function getDisplayValue(v: AvailabilityVariety, mode: ViewMode) {
  return mode === "counts"
    ? (v.remaining_count ?? v.estimate)
    : (v.estimate ?? v.remaining_count);
}

function isEstimateValue(v: AvailabilityVariety, mode: ViewMode) {
  return mode === "estimates"
    || (mode === "counts" && (v.remaining_count === null || v.remaining_count === undefined));
}

function sumVarieties(varieties: AvailabilityVariety[], mode: ViewMode) {
  return varieties.reduce((s, v) => s + (getDisplayValue(v, mode) ?? 0), 0);
}

function ViewModeToggle({ value, onChange, size = "sm", disabled = false }: { value: ViewMode; onChange: (m: ViewMode) => void; size?: "sm" | "xs"; disabled?: boolean }) {
  const px = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  return (
    <div className={cn("flex rounded-md border border-border-warm overflow-hidden", disabled && "opacity-50")}>
      <button
        type="button"
        onClick={() => onChange("counts")}
        disabled={disabled}
        className={`${px} font-medium transition-colors ${
          value === "counts" ? "bg-slate-heading text-white" : "bg-white text-text-muted hover:bg-cream"
        }`}
      >
        Counts
      </button>
      <button
        type="button"
        onClick={() => onChange("estimates")}
        disabled={disabled}
        className={`${px} font-medium transition-colors border-l border-border-warm ${
          value === "estimates" ? "bg-slate-heading text-white" : "bg-white text-text-muted hover:bg-cream"
        }`}
      >
        Estimates
      </button>
    </div>
  );
}

export function AvailabilityCard({ productType, defaultViewMode = "counts" }: AvailabilityCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [collapsedLines, setCollapsedLines] = useState<Set<string>>(
    () => new Set(productType.product_lines.map((pl) => pl.product_line_name))
  );
  const [cardViewMode, setCardViewMode] = useState<ViewMode>(defaultViewMode);
  const [lineViewModes, setLineViewModes] = useState<Record<string, ViewMode>>({});

  // Sync with page-level toggle
  useEffect(() => {
    setCardViewMode(defaultViewMode);
    setLineViewModes({});
  }, [defaultViewMode]);

  // When card toggle changes, reset all line overrides
  const handleCardViewChange = (mode: ViewMode) => {
    setCardViewMode(mode);
    setLineViewModes({});
  };

  const setLineViewMode = (plName: string, mode: ViewMode) => {
    setLineViewModes((prev) => ({ ...prev, [plName]: mode }));
  };

  const isActual = productType.data_source === "actual_counts";
  const hasCounts = isActual;

  // Force estimates mode when no counts exist
  const effectiveCardMode = hasCounts ? cardViewMode : "estimates";
  const getLineViewMode = (plName: string) => hasCounts ? (lineViewModes[plName] ?? cardViewMode) : "estimates";

  // Product type total uses card-level mode
  const productTypeTotal = productType.product_lines.reduce(
    (sum, pl) => sum + sumVarieties(pl.varieties, getLineViewMode(pl.product_line_name)),
    0
  );

  const toggleLine = (name: string) => {
    setCollapsedLines((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-border-warm bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
          )}
          <span className="text-lg font-semibold text-slate-heading">
            {productType.product_type_name}
          </span>
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-box-green-bg text-sidebar-hover">
            {productTypeTotal} total
          </span>
        </button>

        <ViewModeToggle value={effectiveCardMode} onChange={handleCardViewChange} size="sm" disabled={!hasCounts} />
      </div>

      {/* Status banner */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-sm",
          isActual
            ? "bg-sidebar-hover/10 text-sidebar-hover border-t border-emerald-400/30"
            : "bg-box-amber-bg text-box-amber-text border-t border-amber-500/30"
        )}
      >
        {isActual ? (
          <>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Actual counts — updated{" "}
              {productType.counts_completed_at ? formatTime(productType.counts_completed_at) : ""}
              {productType.counts_completed_by ? ` by ${productType.counts_completed_by}` : ""}
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
        <div className="divide-y divide-border-warm/60">
          {productType.product_lines.map((pl) => {
            const isLineCollapsed = collapsedLines.has(pl.product_line_name);
            const lineMode = getLineViewMode(pl.product_line_name);
            const lineTotal = sumVarieties(pl.varieties, lineMode);

            return (
              <div key={pl.product_line_name}>
                {/* Product line header */}
                <div className="flex items-center justify-between px-4 py-2 bg-cream/50 hover:bg-cream transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleLine(pl.product_line_name)}
                    className="flex items-center gap-2 text-left"
                  >
                    {isLineCollapsed ? (
                      <ChevronRight className="h-3 w-3 text-text-muted" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-text-muted" />
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {pl.product_line_name}
                    </span>
                    <span className="text-xs text-text-muted">
                      ({pl.varieties.length})
                    </span>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-box-green-bg text-sidebar-hover">
                      {lineTotal}
                    </span>
                  </button>
                  <ViewModeToggle
                    value={lineMode}
                    onChange={(m) => setLineViewMode(pl.product_line_name, m)}
                    size="xs"
                    disabled={!hasCounts}
                  />
                </div>

                {/* Varieties */}
                {!isLineCollapsed &&
                  pl.varieties.map((v) => {
                    const displayValue = getDisplayValue(v, lineMode);
                    const isEst = isEstimateValue(v, lineMode);

                    return (
                      <div
                        key={v.variety_name}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-cream/30"
                      >
                        <div className="flex items-center gap-2">
                          {v.color_hex && (
                            <span
                              className="inline-block h-3 w-3 rounded-full border border-border-warm shrink-0"
                              style={{ backgroundColor: v.color_hex }}
                            />
                          )}
                          <span className="text-sm text-text-body">{v.variety_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-medium tabular-nums",
                              displayValue === null || displayValue === undefined
                                ? "text-text-muted"
                                : "text-text-body"
                            )}
                          >
                            {displayValue ?? "—"}
                          </span>
                          {isEst && displayValue !== null && displayValue !== undefined && (
                            <span className="text-xs text-amber-500">(est)</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}
          {productType.product_lines.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              No varieties available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
