import { useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { api } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CountAuditLog } from "./CountAuditLog";
import type {
  EstimateResponse,
  EstimateSaveRequest,
  EstimateEntry,
  EstimateProductLine,
} from "@/types/inventory";

export interface EstimateFormHandle {
  save: () => Promise<void>;
  /** Pre-fill estimate values from an external source. Keys are variety_id, inner keys are pull_day dates. */
  prefill: (values: Record<string, Record<string, number | null>>) => void;
  readonly hasDirty: boolean;
  readonly isSaving: boolean;
}

interface EstimateFormProps {
  productTypeId: string;
  weekStart: string;
  onDoneCountChange?: (done: number, total: number) => void;
  onDirtyChange?: (hasDirty: boolean) => void;
  searchTerm?: string;
  productLineFilter?: string | null;
  statusFilter?: "all" | "blank" | "filled";
  isComplete?: boolean;
}

function formatPullDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export const EstimateForm = forwardRef<EstimateFormHandle, EstimateFormProps>(function EstimateForm({
  productTypeId,
  weekStart,
  onDoneCountChange,
  onDirtyChange,
  searchTerm = "",
  productLineFilter = null,
  statusFilter = "all",
  isComplete = false,
}, ref) {
  const [data, setData] = useState<EstimateResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"this_week" | "last_week">("this_week");
  const [localEstimates, setLocalEstimates] = useState<Record<string, Record<string, number | null>>>({});
  const [localDone, setLocalDone] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const draftKey = `fullbloom-draft-estimates-${productTypeId}-${weekStart}`;

  const fetchData = useCallback(async () => {
    if (!productTypeId || !weekStart) return;
    setLoading(true);
    try {
      const resp = await api.get<EstimateResponse>(
        `/api/v1/estimates?product_type_id=${productTypeId}&week_start=${weekStart}`
      );
      setData(resp);

      // Hydrate local state
      const estMap: Record<string, Record<string, number | null>> = {};
      const doneMap: Record<string, boolean> = {};
      for (const pl of resp.product_lines) {
        for (const v of pl.varieties) {
          estMap[v.variety_id] = { ...v.estimates };
          doneMap[v.variety_id] = v.is_done;
        }
      }
      // Check for localStorage draft and restore if present
      try {
        const draftRaw = localStorage.getItem(draftKey);
        if (draftRaw) {
          const draft = JSON.parse(draftRaw) as { estimates: typeof estMap; done: typeof doneMap };
          let restored = false;
          if (draft.estimates) {
            for (const [vid, dayValues] of Object.entries(draft.estimates)) {
              if (estMap[vid]) {
                const serverVals = estMap[vid];
                for (const [day, val] of Object.entries(dayValues)) {
                  if (serverVals[day] !== val) {
                    estMap[vid][day] = val;
                    restored = true;
                  }
                }
              }
            }
          }
          if (draft.done) {
            for (const [vid, done] of Object.entries(draft.done)) {
              if (doneMap[vid] !== done) {
                doneMap[vid] = done;
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

      setLocalEstimates(estMap);
      setLocalDone(doneMap);
    } catch (err) {
      console.error("Failed to fetch estimates:", err);
    } finally {
      setLoading(false);
    }
  }, [productTypeId, weekStart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Track done counts
  useEffect(() => {
    if (!data || !onDoneCountChange) return;
    let done = 0;
    let total = 0;
    for (const pl of data.product_lines) {
      for (const v of pl.varieties) {
        total++;
        if (localDone[v.variety_id]) done++;
      }
    }
    onDoneCountChange(done, total);
  }, [data, localDone, onDoneCountChange]);

  // Report dirty state to parent
  const hasDirty = dirtyKeys.size > 0;
  useEffect(() => {
    onDirtyChange?.(hasDirty);
  }, [hasDirty, onDirtyChange]);

  // Auto-save draft to localStorage on state changes
  useEffect(() => {
    if (!data) return;
    if (isComplete) return;
    try {
      const draft = { estimates: localEstimates, done: localDone };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // localStorage full or unavailable
    }
  }, [localEstimates, localDone, draftKey, data]);

  const pullDays = data?.pull_days ?? [];
  const lastWeekActuals = data?.last_week_actuals ?? {};

  // Map current-week pull days to last-week dates (7 days earlier) for lookup
  const lastWeekDates = useMemo(() => {
    return pullDays.map((day) => {
      const d = new Date(day + "T00:00:00");
      d.setDate(d.getDate() - 7);
      return d.toISOString().slice(0, 10);
    });
  }, [pullDays]);

  // Filter
  const filteredLines = useMemo<EstimateProductLine[]>(() => {
    if (!data) return [];
    const term = searchTerm.toLowerCase();
    return data.product_lines
      .filter((pl) => !productLineFilter || pl.product_line_id === productLineFilter)
      .map((pl) => ({
        ...pl,
        varieties: pl.varieties.filter((v) => {
          if (term && !v.variety_name.toLowerCase().includes(term)) return false;
          if (statusFilter === "blank") {
            return pullDays.every(
              (d) => localEstimates[v.variety_id]?.[d] === null || localEstimates[v.variety_id]?.[d] === undefined
            );
          }
          if (statusFilter === "filled") {
            return pullDays.some(
              (d) => localEstimates[v.variety_id]?.[d] !== null && localEstimates[v.variety_id]?.[d] !== undefined
            );
          }
          return true;
        }),
      }))
      .filter((pl) => pl.varieties.length > 0);
  }, [data, searchTerm, productLineFilter, statusFilter, localEstimates, pullDays]);

  const handleEstimateChange = (varietyId: string, pullDay: string, value: string) => {
    const num = value === "" ? null : parseInt(value, 10);
    if (value !== "" && isNaN(num as number)) return;
    setLocalEstimates((prev) => ({
      ...prev,
      [varietyId]: {
        ...prev[varietyId],
        [pullDay]: num,
      },
    }));
    setDirtyKeys((prev) => new Set(prev).add(`${varietyId}|${pullDay}`));
  };

  const handleDoneToggle = (varietyId: string) => {
    if (isComplete) return;
    setLocalDone((prev) => ({
      ...prev,
      [varietyId]: !prev[varietyId],
    }));
    setDirtyKeys((prev) => new Set(prev).add(`${varietyId}|done`));
  };

  // Build save payload
  const buildSavePayload = (): EstimateSaveRequest => {
    const entries: EstimateEntry[] = [];
    for (const [varietyId, estimates] of Object.entries(localEstimates)) {
      for (const day of pullDays) {
        entries.push({
          variety_id: varietyId,
          pull_day: day,
          estimate_value: estimates[day] ?? null,
          is_done: localDone[varietyId] ?? false,
        });
      }
    }
    return {
      product_type_id: productTypeId,
      week_start: weekStart,
      entered_by: "anonymous",
      estimates: entries,
    };
  };

  // Expose save + prefill for parent via ref
  useImperativeHandle(ref, () => ({
    save: async () => {
      setSaving(true);
      try {
        await api.put("/api/v1/estimates", buildSavePayload());
        setDirtyKeys(new Set());
        try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      } finally {
        setSaving(false);
      }
    },
    prefill: (values: Record<string, Record<string, number | null>>) => {
      setLocalEstimates((prev) => {
        const next = { ...prev };
        for (const [varietyId, dayValues] of Object.entries(values)) {
          next[varietyId] = { ...(next[varietyId] ?? {}), ...dayValues };
        }
        return next;
      });
      // Mark all prefilled entries as dirty
      const keys = new Set(dirtyKeys);
      for (const [varietyId, dayValues] of Object.entries(values)) {
        for (const day of Object.keys(dayValues)) {
          keys.add(`${varietyId}|${day}`);
        }
      }
      setDirtyKeys(keys);
    },
    get hasDirty() { return dirtyKeys.size > 0; },
    get isSaving() { return saving; },
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#94a3b8]">
        Loading estimates...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-8 text-center text-[#94a3b8]">
        No estimate data available. Select a product type to begin.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {draftRestored && (
        <div className="rounded-lg border border-[#fef3c7] bg-[#fef3c7]/30 px-4 py-2 text-xs text-[#92400e]">
          Draft restored from previous session
        </div>
      )}
      {/* Week toggle tabs */}
      <div className="flex rounded-lg border border-[#e0ddd8] bg-white p-1">
        <button
          onClick={() => setActiveTab("this_week")}
          className={cn(
            "flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
            activeTab === "this_week"
              ? "bg-[#c27890] text-white"
              : "text-[#334155] hover:bg-[#f4f1ec]"
          )}
        >
          This Week's Estimate
        </button>
        <button
          onClick={() => setActiveTab("last_week")}
          className={cn(
            "flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
            activeTab === "last_week"
              ? "bg-[#1e3a5f] text-white"
              : "text-[#334155] hover:bg-[#f4f1ec]"
          )}
        >
          Last Week's Actual
        </button>
      </div>

      {/* Pull-day column headers */}
      <div className="sticky top-0 z-[5] flex items-center gap-2 bg-[#f4f1ec] py-2 px-2">
        <div className="flex-1" /> {/* Spacer for checkbox + name */}
        {pullDays.map((day) => (
          <div
            key={day}
            className="w-20 shrink-0 text-center text-xs font-semibold uppercase tracking-wider text-[#1e3a5f]"
          >
            {shortDay(day)}
            <div className="text-[10px] font-normal text-[#94a3b8]">
              {formatPullDay(day).split(",")[0]?.trim()}
            </div>
          </div>
        ))}
      </div>

      {/* Variety rows grouped by product line */}
      {filteredLines.map((pl) => (
        <div key={pl.product_line_id}>
          <div className="sticky top-10 z-[4] flex items-center bg-[#f4f1ec] px-2 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1e3a5f]">
              {pl.product_line_name}
            </h3>
          </div>

          <div className="space-y-1">
            {pl.varieties.map((v) => {
              const isDone = isComplete || (localDone[v.variety_id] ?? false);
              return (
                <div
                  key={v.variety_id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border bg-white px-3 py-2",
                    isDone ? "border-[#8fbc8f]/40 bg-[#2d4a2d]/5" : "border-[#e0ddd8]"
                  )}
                >
                  <div className="min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0">
                    <Checkbox
                      checked={isDone}
                      onCheckedChange={() => handleDoneToggle(v.variety_id)}
                      disabled={isComplete}
                      className="h-5 w-5 data-checked:bg-[#2d4a2d] data-checked:border-[#2d4a2d]"
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-1 min-w-0">
                    <span className="text-sm text-[#334155] truncate">
                      {v.variety_name}
                    </span>
                    <CountAuditLog
                      varietyId={v.variety_id}
                      countDate={weekStart}
                      fetchUrl={`/api/v1/estimates/${v.variety_id}/audit-log?week_start=${weekStart}`}
                    />
                  </div>

                  {pullDays.map((day, dayIdx) => {
                    if (activeTab === "last_week") {
                      const lastWeekDay = lastWeekDates[dayIdx];
                      const actual = lastWeekActuals[v.variety_id]?.[lastWeekDay];
                      return (
                        <div
                          key={day}
                          className="w-20 shrink-0 h-11 flex items-center justify-center rounded-md bg-[#f4f1ec] text-sm text-[#94a3b8]"
                        >
                          {actual ?? "—"}
                        </div>
                      );
                    }

                    const val = localEstimates[v.variety_id]?.[day];
                    return (
                      <Input
                        key={day}
                        type="number"
                        inputMode="numeric"
                        value={val ?? ""}
                        onChange={(e) => handleEstimateChange(v.variety_id, day, e.target.value)}
                        disabled={isComplete}
                        placeholder="—"
                        className="w-20 shrink-0 h-11 text-center text-base bg-white border-[#e0ddd8] text-[#334155] placeholder:text-[#94a3b8] focus-visible:ring-[#c27890]"
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});
