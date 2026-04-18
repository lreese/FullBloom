import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { ChevronDown, ChevronUp, Plus, Minus, Loader2 } from "lucide-react";
import { api } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SanityWarning } from "./SanityWarning";
import { CountAuditLog } from "./CountAuditLog";
import { cn } from "@/lib/utils";
import type {
  CountSheetTemplateResponse,
  CustomerCountResponse,
  CustomerCountSaveRequest,
  CustomerCountEntry,
  TemplateColumn,
  CustomerCountProductLine,
} from "@/types/inventory";

export interface CustomerCountSelectorHandle {
  save: () => Promise<void>;
  readonly hasDirty: boolean;
  readonly isSaving: boolean;
}

interface CustomerCountSelectorProps {
  productTypeId: string;
  countDate: string;
  searchTerm?: string;
  productLineFilter?: string | null;
  statusFilter?: "all" | "blank" | "filled";
  isComplete?: boolean;
  onDoneCountChange?: (done: number, total: number, grandTotal: number) => void;
  onDirtyChange?: (hasDirty: boolean) => void;
}

type ExpandedRow = {
  varietyId: string;
  mode: "add" | "subtract";
};

/** Dirty tracking key: varietyId|colKey */
type DirtySet = Set<string>;

/** Abbreviate customer name: "Happy Flower Market" → "HFM" */
function abbreviate(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Format a chip label: "HFM 5s" */
function chipLabel(col: TemplateColumn): string {
  return `${abbreviate(col.customer_name)} ${col.bunch_size}s`;
}

type ChipStatus = "empty" | "active" | "done";

export const CustomerCountSelector = forwardRef<CustomerCountSelectorHandle, CustomerCountSelectorProps>(function CustomerCountSelector({
  productTypeId,
  countDate,
  searchTerm = "",
  productLineFilter = null,
  statusFilter = "all",
  isComplete = false,
  onDoneCountChange,
  onDirtyChange,
}, ref) {
  const [template, setTemplate] = useState<CountSheetTemplateResponse | null>(null);
  const [data, setData] = useState<CustomerCountResponse | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [showAllChips, setShowAllChips] = useState(false);
  const [localCounts, setLocalCounts] = useState<Record<string, Record<string, number | null>>>({});
  const [localDone, setLocalDone] = useState<Record<string, boolean>>({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<ExpandedRow | null>(null);
  const [expandedAmount, setExpandedAmount] = useState("");
  const [dirtyKeys, setDirtyKeys] = useState<DirtySet>(new Set());
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [recentAvg, setRecentAvg] = useState<Map<string, number>>(new Map());
  const [recentCounts, setRecentCounts] = useState<Map<string, number>>(new Map());

  const expandedInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    if (!productTypeId || !countDate) return;
    setLoading(true);
    try {
      const [tmpl, counts] = await Promise.all([
        api.get<CountSheetTemplateResponse>(
          `/api/v1/count-sheet-templates/${productTypeId}`
        ),
        api.get<CustomerCountResponse>(
          `/api/v1/customer-counts?product_type_id=${productTypeId}&count_date=${countDate}`
        ),
      ]);
      setTemplate(tmpl);
      setData(counts);

      // Hydrate local state from response
      const countMap: Record<string, Record<string, number | null>> = {};
      const doneMap: Record<string, boolean> = {};
      for (const pl of counts.product_lines) {
        for (const v of pl.varieties) {
          countMap[v.variety_id] = { ...v.counts };
          doneMap[v.variety_id] = v.is_done;
        }
      }
      setLocalCounts(countMap);
      setLocalDone(doneMap);
    } catch (err) {
      console.error("Failed to fetch customer counts:", err);
    } finally {
      setLoading(false);
    }
  }, [productTypeId, countDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch recent counts for sanity warnings
  useEffect(() => {
    if (!productTypeId) return;
    const fetchRecent = async () => {
      try {
        const resp = await api.get<{ data: Record<string, { count_value: number }[]> }>(
          `/api/v1/counts/recent-batch?product_type_id=${productTypeId}`
        );
        const avgMap = new Map<string, number>();
        const countMap = new Map<string, number>();
        for (const [id, counts] of Object.entries(resp.data)) {
          countMap.set(id, counts.length);
          if (counts.length >= 3) {
            const avg = counts.reduce((sum, c) => sum + (c.count_value ?? 0), 0) / counts.length;
            avgMap.set(id, avg);
          }
        }
        setRecentAvg(avgMap);
        setRecentCounts(countMap);
      } catch {
        // ignore
      }
    };
    fetchRecent();
  }, [productTypeId]);

  // Focus expanded input
  useEffect(() => {
    if (expandedRow && expandedInputRef.current) {
      expandedInputRef.current.focus();
    }
  }, [expandedRow]);

  const columns = template?.columns ?? data?.template_columns ?? [];
  const selectedCol = columns[selectedIdx] ?? null;

  // Build a composite key for each column
  const colKey = (col: TemplateColumn) =>
    `${col.customer_id}|${col.bunch_size}|${col.sleeve_type}`;

  // Determine chip status per column
  const chipStatuses = useMemo<ChipStatus[]>(() => {
    if (!data) return columns.map(() => "empty" as ChipStatus);
    return columns.map((col) => {
      const key = colKey(col);
      let hasAnyValue = false;
      let allDone = true;
      for (const pl of data.product_lines) {
        for (const v of pl.varieties) {
          const val = localCounts[v.variety_id]?.[key];
          if (val !== null && val !== undefined) hasAnyValue = true;
          if (!localDone[v.variety_id]) allDone = false;
        }
      }
      if (hasAnyValue && allDone) return "done";
      if (hasAnyValue) return "active";
      return "empty";
    });
  }, [columns, data, localCounts, localDone]);

  // Filter product lines and varieties
  const filteredLines = useMemo<CustomerCountProductLine[]>(() => {
    if (!data) return [];
    const term = searchTerm.toLowerCase();
    return data.product_lines
      .filter((pl) => !productLineFilter || pl.product_line_id === productLineFilter)
      .map((pl) => ({
        ...pl,
        varieties: pl.varieties.filter((v) => {
          if (term && !v.variety_name.toLowerCase().includes(term)) return false;
          if (statusFilter === "blank") {
            const key = selectedCol ? colKey(selectedCol) : "";
            const val = localCounts[v.variety_id]?.[key];
            return val === null || val === undefined;
          }
          if (statusFilter === "filled") {
            const key = selectedCol ? colKey(selectedCol) : "";
            const val = localCounts[v.variety_id]?.[key];
            return val !== null && val !== undefined;
          }
          return true;
        }),
      }))
      .filter((pl) => pl.varieties.length > 0);
  }, [data, searchTerm, productLineFilter, statusFilter, localCounts, selectedCol]);

  // Running total for selected column
  const runningTotal = useMemo(() => {
    if (!selectedCol) return 0;
    const key = colKey(selectedCol);
    let total = 0;
    for (const counts of Object.values(localCounts)) {
      const v = counts[key];
      if (v !== null && v !== undefined) total += v;
    }
    return total;
  }, [selectedCol, localCounts]);

  // Summary: 10-stem equivalents grouped by bunch_size
  const summaryTotals = useMemo(() => {
    const byStem: Record<number, number> = {};
    for (const col of columns) {
      const key = colKey(col);
      let bunches = 0;
      for (const counts of Object.values(localCounts)) {
        const v = counts[key];
        if (v !== null && v !== undefined) bunches += v;
      }
      const equiv = Math.round((bunches * col.bunch_size) / 10);
      byStem[col.bunch_size] = (byStem[col.bunch_size] ?? 0) + equiv;
    }
    return Object.entries(byStem)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([size, total]) => ({ size: Number(size), total }));
  }, [columns, localCounts]);

  const markDirty = (varietyId: string, ck: string) => {
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      next.add(`${varietyId}|${ck}`);
      return next;
    });
  };

  const handleCountChange = (varietyId: string, value: string) => {
    if (!selectedCol) return;
    const key = colKey(selectedCol);
    const num = value === "" ? null : parseInt(value, 10);
    if (value !== "" && isNaN(num as number)) return;
    setLocalCounts((prev) => ({
      ...prev,
      [varietyId]: {
        ...prev[varietyId],
        [key]: num,
      },
    }));
    markDirty(varietyId, key);
  };

  const handleExpandedSave = (varietyId: string) => {
    if (!selectedCol) return;
    const amount = parseInt(expandedAmount, 10);
    if (isNaN(amount) || amount <= 0) return;

    const key = colKey(selectedCol);
    const currentVal = localCounts[varietyId]?.[key] ?? 0;
    const newVal =
      expandedRow?.mode === "add" ? currentVal + amount : Math.max(0, currentVal - amount);

    setLocalCounts((prev) => ({
      ...prev,
      [varietyId]: {
        ...prev[varietyId],
        [key]: newVal,
      },
    }));
    markDirty(varietyId, key);
    setExpandedRow(null);
    setExpandedAmount("");
  };

  const handleDoneToggle = (varietyId: string) => {
    if (isComplete) return;
    setLocalDone((prev) => ({
      ...prev,
      [varietyId]: !prev[varietyId],
    }));
    // Mark all column keys dirty for this variety so it gets saved
    for (const col of columns) {
      markDirty(varietyId, colKey(col));
    }
  };

  const getSanityWarning = (varietyId: string, value: number | null): string | null => {
    if (value === null || value === 0) return null;
    if (dismissedWarnings.has(varietyId)) return null;
    const avg = recentAvg.get(varietyId);
    const count = recentCounts.get(varietyId) ?? 0;
    if (!avg || count < 3 || avg === 0) return null;
    const ratio = value / avg;
    if (ratio > 5) return `~${Math.round(ratio)}x avg`;
    if (ratio < 0.2) return `~${ratio.toFixed(1)}x avg`;
    return null;
  };

  // Build save payload
  const buildSavePayload = (): CustomerCountSaveRequest => {
    const entries: CustomerCountEntry[] = [];
    for (const col of columns) {
      const key = colKey(col);
      for (const [varietyId, counts] of Object.entries(localCounts)) {
        entries.push({
          variety_id: varietyId,
          customer_id: col.customer_id,
          bunch_size: col.bunch_size,
          sleeve_type: col.sleeve_type,
          bunch_count: counts[key] ?? null,
          is_done: localDone[varietyId] ?? false,
        });
      }
    }
    return {
      product_type_id: productTypeId,
      count_date: countDate,
      entered_by: "anonymous",
      counts: entries,
    };
  };

  // Save
  const handleSave = useCallback(async () => {
    if (dirtyKeys.size === 0) return;
    setSaving(true);
    try {
      await api.put("/api/v1/customer-counts", buildSavePayload());
      setLastSavedAt(new Date());
      setDirtyKeys(new Set());
    } catch (err) {
      console.error("Failed to save customer counts:", err);
    } finally {
      setSaving(false);
    }
  }, [dirtyKeys, localCounts, localDone, columns, productTypeId, countDate]);

  const hasDirtyValues = dirtyKeys.size > 0;

  // Notify parent of dirty state
  useEffect(() => {
    onDirtyChange?.(hasDirtyValues);
  }, [hasDirtyValues, onDirtyChange]);

  // Auto-save every 10 seconds when dirty
  useEffect(() => {
    if (!hasDirtyValues || saving) return;
    const timer = setInterval(() => {
      handleSave();
    }, 10000);
    return () => clearInterval(timer);
  }, [hasDirtyValues, saving, handleSave]);

  // Warn on navigation with unsaved changes
  useEffect(() => {
    if (!hasDirtyValues) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasDirtyValues]);

  // Expose save for parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
    get hasDirty() {
      return hasDirtyValues;
    },
    get isSaving() {
      return saving;
    },
  }));

  // Track done counts and grand total for parent
  useEffect(() => {
    if (!data || !onDoneCountChange) return;
    let done = 0;
    let total = 0;
    let grandTotal = 0;
    for (const pl of data.product_lines) {
      for (const v of pl.varieties) {
        total++;
        if (localDone[v.variety_id]) done++;
      }
    }
    // Sum all bunch counts as 10-stem equivalents
    for (const col of columns) {
      const key = colKey(col);
      for (const counts of Object.values(localCounts)) {
        const val = counts[key];
        if (val !== null && val !== undefined) {
          grandTotal += Math.round((val * col.bunch_size) / 10);
        }
      }
    }
    onDoneCountChange(done, total, grandTotal);
  }, [data, localDone, localCounts, onDoneCountChange]);

  // Chips display
  const MAX_VISIBLE_CHIPS = 8;
  const visibleChips = showAllChips ? columns : columns.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenCount = columns.length - MAX_VISIBLE_CHIPS;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted">
        Loading specials...
      </div>
    );
  }

  if (!data || columns.length === 0) {
    return (
      <div className="py-8 text-center text-text-muted">
        No specials columns configured for this product type. Use the gear icon to set up customer-bunch columns.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chip bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {visibleChips.map((col, idx) => {
          const realIdx = showAllChips ? idx : idx;
          const status = chipStatuses[realIdx];
          return (
            <button
              key={colKey(col)}
              onClick={() => setSelectedIdx(realIdx)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors min-h-[36px]",
                selectedIdx === realIdx && status === "done" && "bg-sidebar-hover text-white",
                selectedIdx === realIdx && status === "active" && "bg-rose-action text-white",
                selectedIdx === realIdx && status === "empty" && "bg-rose-action text-white",
                selectedIdx !== realIdx && status === "done" && "bg-sidebar-hover text-white",
                selectedIdx !== realIdx && status === "active" && "bg-rose-action/10 text-rose-action border border-rose-action/30",
                selectedIdx !== realIdx && status === "empty" && "bg-white text-text-body border border-border-warm"
              )}
            >
              {chipLabel(col)}
            </button>
          );
        })}
        {!showAllChips && hiddenCount > 0 && (
          <button
            onClick={() => setShowAllChips(true)}
            className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-text-muted border border-border-warm hover:bg-cream transition-colors min-h-[36px]"
          >
            +{hiddenCount} more
          </button>
        )}
        {showAllChips && columns.length > MAX_VISIBLE_CHIPS && (
          <button
            onClick={() => setShowAllChips(false)}
            className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-text-muted border border-border-warm hover:bg-cream transition-colors min-h-[36px]"
          >
            Show less
          </button>
        )}
      </div>

      {/* Selected customer header bar */}
      {selectedCol && (
        <div className="flex items-center justify-between rounded-lg border border-border-warm bg-white px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-heading">
              {selectedCol.customer_name}
            </div>
            <div className="flex gap-3 text-xs text-text-muted">
              <span>{selectedCol.bunch_size}-stem</span>
              <span>{selectedCol.sleeve_type}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-heading">{runningTotal}</div>
            <div className="text-xs text-text-muted">bunches</div>
          </div>
        </div>
      )}

      {/* Save status indicator */}
      {lastSavedAt && !hasDirtyValues && (
        <div className="text-xs text-text-muted text-right">
          Saved {lastSavedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </div>
      )}
      {hasDirtyValues && !saving && (
        <div className="text-xs text-text-muted text-right">
          Unsaved changes — auto-saves in 10s
        </div>
      )}
      {saving && (
        <div className="text-xs text-text-muted text-right flex items-center justify-end gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving...
        </div>
      )}

      {/* Variety list grouped by product line */}
      {selectedCol && filteredLines.map((pl) => {
        const key = colKey(selectedCol);
        const subtotal = pl.varieties.reduce((sum, v) => {
          return sum + (localCounts[v.variety_id]?.[key] ?? 0);
        }, 0);

        return (
          <div key={pl.product_line_id}>
            {/* Section header */}
            <div className="flex items-center justify-between border-b border-border-warm pb-2 mb-2">
              <h3 className="text-sm font-semibold text-slate-heading">
                {pl.product_line_name}
              </h3>
              <span className="text-xs font-medium text-text-muted">
                Subtotal: {subtotal}
              </span>
            </div>

            {/* Variety rows */}
            <div className="space-y-0.5">
              {pl.varieties.map((v) => {
                const val = localCounts[v.variety_id]?.[key];
                const isDone = isComplete || (localDone[v.variety_id] ?? false);
                const hasValue = val !== null && val !== undefined;
                const isExpanded = expandedRow?.varietyId === v.variety_id;
                const isDirtyRow = dirtyKeys.has(`${v.variety_id}|${key}`);
                const warning = getSanityWarning(v.variety_id, val ?? null);

                return (
                  <div key={v.variety_id}>
                    {/* Main row */}
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1 min-h-[36px] transition-colors",
                        isDirtyRow ? "bg-box-amber-bg/30" : "hover:bg-cream"
                      )}
                    >
                      {/* Done checkbox */}
                      <div className="min-w-[36px] min-h-[36px] flex items-center justify-center">
                        <Checkbox
                          checked={isDone}
                          onCheckedChange={() => handleDoneToggle(v.variety_id)}
                          disabled={isComplete}
                          className="h-5 w-5"
                        />
                      </div>

                      {/* Variety name + warning + audit icon */}
                      <div className="flex-1 min-w-0 flex items-center gap-1 relative">
                        <span
                          className={cn(
                            "text-sm truncate",
                            isDone
                              ? "text-text-muted line-through"
                              : "text-text-body"
                          )}
                        >
                          {v.variety_name}
                        </span>
                        {warning && (
                          <SanityWarning
                            message={warning}
                            onDismiss={() =>
                              setDismissedWarnings((prev) =>
                                new Set([...prev, v.variety_id])
                              )
                            }
                          />
                        )}
                        {/* Audit log for customer counts */}
                        {selectedCol && (
                          <CountAuditLog
                            varietyId={v.variety_id}
                            countDate={countDate}
                            fetchUrl={`/api/v1/customer-counts/${v.variety_id}/audit-log?customer_id=${selectedCol.customer_id}&bunch_size=${selectedCol.bunch_size}&sleeve_type=${encodeURIComponent(selectedCol.sleeve_type)}&count_date=${countDate}`}
                          />
                        )}
                      </div>

                      {/* Count input area */}
                      <div className="flex items-center gap-1 shrink-0">
                        {hasValue && (
                          <Button
                            variant="outline"
                            size="icon-sm"
                            disabled={isComplete}
                            onClick={() => {
                              if (isExpanded && expandedRow?.mode === "subtract") {
                                setExpandedRow(null);
                                setExpandedAmount("");
                              } else {
                                setExpandedRow({ varietyId: v.variety_id, mode: "subtract" });
                                setExpandedAmount("");
                              }
                            }}
                            className="text-rose-action border-rose-action/30 hover:bg-rose-action/10 min-w-[44px] min-h-[44px]"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        )}

                        <Input
                          type="number"
                          inputMode="numeric"
                          value={val ?? ""}
                          onChange={(e) => handleCountChange(v.variety_id, e.target.value)}
                          disabled={isComplete}
                          placeholder="--"
                          className="w-20 text-center bg-white border-border-warm text-text-body focus-visible:ring-rose-action min-h-[44px] text-base"
                        />

                        {hasValue && (
                          <Button
                            variant="outline"
                            size="icon-sm"
                            disabled={isComplete}
                            onClick={() => {
                              if (isExpanded && expandedRow?.mode === "add") {
                                setExpandedRow(null);
                                setExpandedAmount("");
                              } else {
                                setExpandedRow({ varietyId: v.variety_id, mode: "add" });
                                setExpandedAmount("");
                              }
                            }}
                            className="text-sidebar-hover border-sidebar-hover/30 hover:bg-sidebar-hover/10 min-w-[44px] min-h-[44px]"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded add/subtract row */}
                    {isExpanded && (
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-lg mx-3 px-3 py-2 mt-1 border",
                          expandedRow.mode === "add"
                            ? "border-sidebar-hover/30 bg-sidebar-hover/5"
                            : "border-rose-action/30 bg-rose-action/5"
                        )}
                      >
                        <span
                          className={cn(
                            "text-sm font-medium shrink-0",
                            expandedRow.mode === "add"
                              ? "text-sidebar-hover"
                              : "text-rose-action"
                          )}
                        >
                          {expandedRow.mode === "add" ? "Add:" : "Remove:"}
                        </span>

                        <Input
                          ref={expandedInputRef}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={expandedAmount}
                          onChange={(e) => {
                            const v2 = e.target.value;
                            if (v2 === "" || parseInt(v2, 10) >= 0) setExpandedAmount(v2);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleExpandedSave(v.variety_id);
                            } else if (e.key === "Escape") {
                              setExpandedRow(null);
                              setExpandedAmount("");
                            }
                          }}
                          placeholder="0"
                          className="w-20 text-center bg-white border-border-warm min-h-[44px] text-base"
                        />

                        <span className="text-sm text-text-body">
                          &rarr; new total:{" "}
                          <span className="font-semibold">
                            {(() => {
                              const amt = parseInt(expandedAmount, 10);
                              const cur = val ?? 0;
                              if (isNaN(amt) || amt <= 0) return cur;
                              return expandedRow.mode === "add"
                                ? cur + amt
                                : Math.max(0, cur - amt);
                            })()}
                          </span>
                        </span>

                        <div className="flex gap-2 shrink-0 ml-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setExpandedRow(null);
                              setExpandedAmount("");
                            }}
                            className="min-h-[44px] border-border-warm text-text-muted"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleExpandedSave(v.variety_id)}
                            disabled={(() => {
                              const amt = parseInt(expandedAmount, 10);
                              if (!expandedAmount || isNaN(amt) || amt <= 0) return true;
                              if (expandedRow.mode === "remove" && amt > (val ?? 0)) return true;
                              return false;
                            })()}
                            className={cn(
                              "min-h-[44px]",
                              expandedRow.mode === "add"
                                ? "bg-sidebar-hover hover:bg-sidebar-hover/90 text-white"
                                : "bg-rose-action hover:bg-rose-action/90 text-white"
                            )}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Summary totals — collapsible */}
      {summaryTotals.length > 0 && (
        <div className="rounded-lg border border-border-warm bg-white">
          <button
            onClick={() => setSummaryOpen(!summaryOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-heading min-h-[44px]"
          >
            <span>10-Stem Equivalents Summary</span>
            {summaryOpen ? (
              <ChevronUp className="h-4 w-4 text-text-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-text-muted" />
            )}
          </button>
          {summaryOpen && (
            <div className="border-t border-border-warm px-4 py-3 space-y-2">
              {summaryTotals.map(({ size, total }) => (
                <div key={size} className="flex items-center justify-between text-sm">
                  <span className="text-text-body">Total {size}-stem</span>
                  <span className="font-semibold text-slate-heading">
                    {total} <span className="font-normal text-text-muted">× 10-stem</span>
                  </span>
                </div>
              ))}
              {data?.grand_totals && (
                <>
                  <div className="border-t border-border-warm pt-2 mt-2 flex items-center justify-between text-sm">
                    <span className="text-text-body">Specials Bunched</span>
                    <span className="font-semibold text-slate-heading">
                      {data.grand_totals.total_customer_bunched}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-body">Standard</span>
                    <span className="font-semibold text-slate-heading">
                      {data.grand_totals.total_remaining}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span className="text-slate-heading">Grand Total (incl. standard)</span>
                    <span className="text-slate-heading">
                      {data.grand_totals.total_all_bunched}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
