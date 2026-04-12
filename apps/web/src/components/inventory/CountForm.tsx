import { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { api } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SanityWarning } from "./SanityWarning";
import { CountAuditLog } from "./CountAuditLog";
import { Loader2, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DailyCountResponse,
  DailyCountProductLine,
  DailyCountVariety,
  CountEntry,
  RecentCount,

} from "@/types/inventory";

export interface CountFormHandle {
  save: () => Promise<void>;
  /** Pre-fill count values from an external source. Marks all as dirty. */
  prefill: (values: Record<string, number | null>) => void;
  /** Whether any variety has unsaved changes */
  readonly hasDirty: boolean;
  /** Whether a save is currently in progress */
  readonly isSaving: boolean;
}

interface CountFormProps {
  productTypeId: string;
  countDate: string;
  onDoneCountChange: (done: number, total: number, grandTotal: number) => void;
  onDirtyChange?: (hasDirty: boolean) => void;
  searchTerm?: string;
  productLineFilter?: string | null;
  statusFilter?: "all" | "blank" | "filled";
  isComplete?: boolean;
}

type ExpandedRow = {
  varietyId: string;
  mode: "add" | "subtract";
};

// Local state per variety for editing
interface VarietyState {
  count_value: number | null;
  is_done: boolean;
  dirty: boolean;
}

export const CountForm = forwardRef<CountFormHandle, CountFormProps>(function CountForm({
  productTypeId,
  countDate,
  onDoneCountChange,
  onDirtyChange,
  searchTerm = "",
  productLineFilter = null,
  statusFilter = "all",
  isComplete = false,
}, ref) {
  const [productLines, setProductLines] = useState<DailyCountProductLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [varietyStates, setVarietyStates] = useState<Map<string, VarietyState>>(new Map());
  const [expandedRow, setExpandedRow] = useState<ExpandedRow | null>(null);
  const [expandedAmount, setExpandedAmount] = useState("");
  const [recentAvg, setRecentAvg] = useState<Map<string, number>>(new Map());
  const [recentCounts, setRecentCounts] = useState<Map<string, number>>(new Map()); // how many data points
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const expandedInputRef = useRef<HTMLInputElement>(null);
  const draftKey = `fullbloom-draft-counts-${productTypeId}-${countDate}`;

  // Fetch count data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<DailyCountResponse>(
        `/api/v1/counts?product_type_id=${productTypeId}&count_date=${countDate}`
      );
      setProductLines(data.product_lines);

      // Initialize local state
      const states = new Map<string, VarietyState>();
      const varietyIds: string[] = [];
      for (const pl of data.product_lines) {
        for (const v of pl.varieties) {
          states.set(v.variety_id, {
            count_value: v.count_value,
            is_done: v.is_done,
            dirty: false,
          });
          varietyIds.push(v.variety_id);
        }
      }
      // Check for localStorage draft and restore if present
      try {
        const draftRaw = localStorage.getItem(draftKey);
        if (draftRaw) {
          const draft: Record<string, { count_value: number | null; is_done: boolean }> = JSON.parse(draftRaw);
          let restored = false;
          for (const [vid, draftState] of Object.entries(draft)) {
            const serverState = states.get(vid);
            if (serverState) {
              const differs = serverState.count_value !== draftState.count_value || serverState.is_done !== draftState.is_done;
              if (differs) {
                states.set(vid, { ...draftState, dirty: true });
                restored = true;
              }
            }
          }
          if (restored) {
            setDraftRestored(true);
            setTimeout(() => setDraftRestored(false), 4000);
          }
        }
      } catch {
        // Ignore corrupt draft
      }

      setVarietyStates(states);

      // Compute done counts and grand total
      const doneCount = Array.from(states.values()).filter((s) => s.is_done).length;
      const grandTotal = Array.from(states.values()).reduce((sum, s) => sum + (s.count_value ?? 0), 0);
      onDoneCountChange(doneCount, states.size, grandTotal);

      // Fetch recent counts for sanity checks (batch all varieties)
      fetchRecentCounts(varietyIds);
    } catch (err) {
      console.error("Failed to fetch counts:", err);
    } finally {
      setLoading(false);
    }
  }, [productTypeId, countDate]);

  const fetchRecentCounts = async (_varietyIds: string[]) => {
    const avgMap = new Map<string, number>();
    const countMap = new Map<string, number>();

    try {
      const resp = await api.get<{ data: Record<string, RecentCount[]> }>(
        `/api/v1/counts/recent-batch?product_type_id=${productTypeId}`
      );

      for (const [id, counts] of Object.entries(resp.data)) {
        countMap.set(id, counts.length);
        if (counts.length >= 3) {
          const avg = counts.reduce((sum, c) => sum + (c.count_value ?? 0), 0) / counts.length;
          avgMap.set(id, avg);
        }
      }
    } catch (err) {
      console.error("Failed to fetch recent counts batch:", err);
    }

    setRecentAvg(avgMap);
    setRecentCounts(countMap);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update parent whenever done count changes
  useEffect(() => {
    const doneCount = Array.from(varietyStates.values()).filter((s) => s.is_done).length;
    const grandTotal = Array.from(varietyStates.values()).reduce((sum, s) => sum + (s.count_value ?? 0), 0);
    onDoneCountChange(doneCount, varietyStates.size, grandTotal);
  }, [varietyStates, onDoneCountChange]);

  // Auto-save draft to localStorage on state changes
  useEffect(() => {
    if (varietyStates.size === 0) return;
    if (isComplete) return;
    const hasDirty = Array.from(varietyStates.values()).some((s) => s.dirty);
    if (!hasDirty) return;
    try {
      const draft: Record<string, { count_value: number | null; is_done: boolean }> = {};
      for (const [vid, state] of varietyStates) {
        draft[vid] = { count_value: state.count_value, is_done: state.is_done };
      }
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // localStorage full or unavailable
    }
  }, [varietyStates, draftKey]);

  // Focus expanded input
  useEffect(() => {
    if (expandedRow && expandedInputRef.current) {
      expandedInputRef.current.focus();
    }
  }, [expandedRow]);

  const updateVariety = (varietyId: string, updates: Partial<VarietyState>) => {
    setVarietyStates((prev) => {
      const next = new Map(prev);
      const current = next.get(varietyId);
      if (current) {
        next.set(varietyId, { ...current, ...updates, dirty: true });
      }
      return next;
    });
  };

  const handleDirectSet = (varietyId: string, value: string) => {
    const num = value === "" ? null : parseInt(value, 10);
    if (value !== "" && isNaN(num as number)) return;
    updateVariety(varietyId, { count_value: num });
  };

  const handleDoneToggle = (varietyId: string) => {
    if (isComplete) return;
    const current = varietyStates.get(varietyId);
    if (current) {
      updateVariety(varietyId, { is_done: !current.is_done });
    }
  };

  const handleExpandedSave = (varietyId: string) => {
    const amount = parseInt(expandedAmount, 10);
    if (isNaN(amount) || amount <= 0) return;

    const current = varietyStates.get(varietyId);
    if (!current) return;

    const currentVal = current.count_value ?? 0;
    const newVal =
      expandedRow?.mode === "add" ? currentVal + amount : Math.max(0, currentVal - amount);

    updateVariety(varietyId, { count_value: newVal });
    setExpandedRow(null);
    setExpandedAmount("");
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

  // Save all dirty entries
  const handleSave = useCallback(async () => {
    const counts: CountEntry[] = [];
    for (const [varietyId, state] of varietyStates) {
      if (state.dirty) {
        counts.push({
          variety_id: varietyId,
          count_value: state.count_value,
          is_done: state.is_done,
        });
      }
    }

    if (counts.length === 0) return;

    setSaving(true);
    try {
      await api.put("/api/v1/counts", {
        product_type_id: productTypeId,
        count_date: countDate,
        entered_by: "anonymous",
        counts,
      });

      // Mark all as not dirty, clear draft, record save time
      setLastSavedAt(new Date());
      setVarietyStates((prev) => {
        const next = new Map(prev);
        for (const [id, state] of next) {
          if (state.dirty) {
            next.set(id, { ...state, dirty: false });
          }
        }
        return next;
      });
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    } catch (err) {
      console.error("Failed to save counts:", err);
    } finally {
      setSaving(false);
    }
  }, [varietyStates, productTypeId, countDate, draftKey]);

  // Notify parent when dirty state changes
  const hasDirtyValues = useMemo(
    () => Array.from(varietyStates.values()).some((s) => s.dirty),
    [varietyStates]
  );

  useEffect(() => {
    onDirtyChange?.(hasDirtyValues);
  }, [hasDirtyValues, onDirtyChange]);

  // Auto-save every 30 seconds if there are dirty values
  useEffect(() => {
    if (!hasDirtyValues || saving) return;
    const timer = setInterval(() => {
      handleSave();
    }, 10000);
    return () => clearInterval(timer);
  }, [hasDirtyValues, saving, handleSave]);

  // Warn on navigation/close with unsaved changes
  useEffect(() => {
    if (!hasDirtyValues) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasDirtyValues]);

  // Expose save + prefill + state via ref for parent components
  useImperativeHandle(ref, () => ({
    save: handleSave,
    get hasDirty() {
      return hasDirtyValues;
    },
    get isSaving() {
      return saving;
    },
    prefill: (values: Record<string, number | null>) => {
      setVarietyStates((prev) => {
        const next = new Map(prev);
        for (const [varietyId, count_value] of Object.entries(values)) {
          const current = next.get(varietyId);
          if (current) {
            next.set(varietyId, { ...current, count_value, dirty: true });
          }
        }
        return next;
      });
    },
  }));

  // Filtering logic
  const filterVariety = (v: DailyCountVariety): boolean => {
    const state = varietyStates.get(v.variety_id);

    // Search filter
    if (searchTerm && !v.variety_name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    if (statusFilter === "blank" && state?.count_value !== null) return false;
    if (statusFilter === "filled" && (state?.count_value === null || state?.count_value === undefined))
      return false;

    return true;
  };

  const filterProductLine = (pl: DailyCountProductLine): boolean => {
    if (productLineFilter && pl.product_line_id !== productLineFilter) return false;
    return true;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#94a3b8]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading count sheet...
      </div>
    );
  }

  if (productLines.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        No varieties found for this product type and date.
      </div>
    );
  }

  const filteredLines = productLines.filter(filterProductLine);

  return (
    <div className="space-y-6 pb-24">
      {draftRestored && (
        <div className="rounded-lg border border-[#fef3c7] bg-[#fef3c7]/30 px-4 py-2 text-xs text-[#92400e]">
          Draft restored from previous session
        </div>
      )}
      {lastSavedAt && !hasDirtyValues && (
        <div className="text-xs text-[#94a3b8] text-right">
          Saved {lastSavedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </div>
      )}
      {hasDirtyValues && !saving && (
        <div className="text-xs text-[#94a3b8] text-right">
          Unsaved changes — auto-saves in 10s
        </div>
      )}
      {saving && (
        <div className="text-xs text-[#94a3b8] text-right flex items-center justify-end gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving...
        </div>
      )}
      {filteredLines.map((pl) => {
        const filteredVarieties = pl.varieties.filter(filterVariety);
        if (filteredVarieties.length === 0) return null;

        // Section subtotal
        const subtotal = filteredVarieties.reduce((sum, v) => {
          const state = varietyStates.get(v.variety_id);
          return sum + (state?.count_value ?? 0);
        }, 0);

        return (
          <div key={pl.product_line_id}>
            {/* Section header */}
            <div className="flex items-center justify-between border-b border-[#e0ddd8] pb-2 mb-2">
              <h3 className="text-sm font-semibold text-[#1e3a5f]">
                {pl.product_line_name}
              </h3>
              <span className="text-xs font-medium text-[#94a3b8]">
                Subtotal: {subtotal}
              </span>
            </div>

            {/* Variety rows */}
            <div className="space-y-0.5">
              {filteredVarieties.map((variety) => {
                const state = varietyStates.get(variety.variety_id);
                if (!state) return null;
                const hasValue = state.count_value !== null;
                const isExpanded =
                  expandedRow?.varietyId === variety.variety_id;
                const warning = getSanityWarning(
                  variety.variety_id,
                  state.count_value
                );

                return (
                  <div key={variety.variety_id}>
                    {/* Main row */}
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1 min-h-[36px] transition-colors",
                        state.dirty ? "bg-[#fef3c7]/30" : "hover:bg-[#f4f1ec]"
                      )}
                    >
                      {/* Done checkbox */}
                      <div className="min-w-[36px] min-h-[36px] flex items-center justify-center">
                        <Checkbox
                          checked={isComplete || state.is_done}
                          onCheckedChange={() => handleDoneToggle(variety.variety_id)}
                          disabled={isComplete}
                          className="h-5 w-5"
                        />
                      </div>

                      {/* Variety name + audit icon */}
                      <div className="flex-1 min-w-0 flex items-center gap-1 relative">
                        <span
                          className={cn(
                            "text-sm truncate",
                            state.is_done
                              ? "text-[#94a3b8] line-through"
                              : "text-[#334155]"
                          )}
                        >
                          {variety.variety_name}
                        </span>
                        {warning && (
                          <SanityWarning
                            message={warning}
                            onDismiss={() =>
                              setDismissedWarnings((prev) =>
                                new Set([...prev, variety.variety_id])
                              )
                            }
                          />
                        )}
                        <CountAuditLog varietyId={variety.variety_id} countDate={countDate} />
                      </div>

                      {/* Count input area */}
                      <div className="flex items-center gap-1 shrink-0">
                        {hasValue && (
                          <Button
                            variant="outline"
                            size="icon-sm"
                            disabled={isComplete}
                            onClick={() => {
                              if (
                                isExpanded &&
                                expandedRow?.mode === "subtract"
                              ) {
                                setExpandedRow(null);
                                setExpandedAmount("");
                              } else {
                                setExpandedRow({
                                  varietyId: variety.variety_id,
                                  mode: "subtract",
                                });
                                setExpandedAmount("");
                              }
                            }}
                            className="text-[#c27890] border-[#c27890]/30 hover:bg-[#c27890]/10 min-w-[44px] min-h-[44px]"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        )}

                        <Input
                          type="number"
                          inputMode="numeric"
                          disabled={isComplete}
                          value={state.count_value ?? ""}
                          onChange={(e) =>
                            handleDirectSet(variety.variety_id, e.target.value)
                          }
                          placeholder="--"
                          className="w-20 text-center bg-white border-[#e0ddd8] text-[#334155] focus-visible:ring-[#c27890] min-h-[44px] text-base"
                        />

                        {hasValue && (
                          <Button
                            variant="outline"
                            size="icon-sm"
                            disabled={isComplete}
                            onClick={() => {
                              if (
                                isExpanded &&
                                expandedRow?.mode === "add"
                              ) {
                                setExpandedRow(null);
                                setExpandedAmount("");
                              } else {
                                setExpandedRow({
                                  varietyId: variety.variety_id,
                                  mode: "add",
                                });
                                setExpandedAmount("");
                              }
                            }}
                            className="text-[#2d4a2d] border-[#2d4a2d]/30 hover:bg-[#2d4a2d]/10 min-w-[44px] min-h-[44px]"
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
                            ? "border-[#2d4a2d]/30 bg-[#2d4a2d]/5"
                            : "border-[#c27890]/30 bg-[#c27890]/5"
                        )}
                      >
                        <span
                          className={cn(
                            "text-sm font-medium shrink-0",
                            expandedRow.mode === "add"
                              ? "text-[#2d4a2d]"
                              : "text-[#c27890]"
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
                            const v = e.target.value;
                            if (v === "" || parseInt(v, 10) >= 0) setExpandedAmount(v);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleExpandedSave(variety.variety_id);
                            } else if (e.key === "Escape") {
                              setExpandedRow(null);
                              setExpandedAmount("");
                            }
                          }}
                          placeholder="0"
                          className="w-20 text-center bg-white border-[#e0ddd8] min-h-[44px] text-base"
                        />

                        <span className="text-sm text-[#334155]">
                          &rarr; new total:{" "}
                          <span className="font-semibold">
                            {(() => {
                              const amt = parseInt(expandedAmount, 10);
                              const cur = state.count_value ?? 0;
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
                            className="min-h-[44px] border-[#e0ddd8] text-[#94a3b8]"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleExpandedSave(variety.variety_id)}
                            disabled={(() => {
                              const amt = parseInt(expandedAmount, 10);
                              if (!expandedAmount || isNaN(amt) || amt <= 0) return true;
                              if (expandedRow.mode === "remove" && amt > (state.count_value ?? 0)) return true;
                              return false;
                            })()}
                            className={cn(
                              "min-h-[44px]",
                              expandedRow.mode === "add"
                                ? "bg-[#2d4a2d] hover:bg-[#2d4a2d]/90 text-white"
                                : "bg-[#c27890] hover:bg-[#c27890]/90 text-white"
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
    </div>
  );
});
