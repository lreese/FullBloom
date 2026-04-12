import { useState, useEffect, useCallback, useRef } from "react";
import { Save, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SearchFilterBar } from "@/components/inventory/SearchFilterBar";
import { SheetCompletionBar } from "@/components/inventory/SheetCompletionBar";
import { EstimateForm, type EstimateFormHandle } from "@/components/inventory/EstimateForm";
import { CopyButtons } from "@/components/inventory/CopyButtons";
import { PullDayConfigPopover } from "@/components/inventory/PullDayConfigPopover";
import { openPrintSheet } from "@/components/inventory/PrintSheet";
import type { ProductType } from "@/types";
import type { EstimateResponse } from "@/types/inventory";

/** Get Monday of the week containing a given date */
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  date.setDate(date.getDate() + diff);
  return date;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(monday: string): string {
  const d = new Date(monday + "T00:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Week of ${fmt(d)} - ${fmt(end)}`;
}

function shiftWeek(monday: string, delta: number): string {
  const d = new Date(monday + "T00:00:00");
  d.setDate(d.getDate() + 7 * delta);
  return toISO(d);
}

export function EstimatesPage() {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [selectedPtId, setSelectedPtId] = useState<string>("");
  const [weekStart, setWeekStart] = useState(() => toISO(getMonday(new Date())));

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [productLineFilter, setProductLineFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "blank" | "filled">("all");

  // Completion tracking
  const [doneCount, setDoneCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [sheetComplete, setSheetComplete] = useState(false);
  const [completedBy, setCompletedBy] = useState<string | undefined>();
  const [completedAt, setCompletedAt] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [hasDirty, setHasDirty] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Copy availability
  const [hasLastEstimate, setHasLastEstimate] = useState(false);

  // Product lines for filter bar
  const [productLines, setProductLines] = useState<{ id: string; name: string }[]>([]);

  const estimateFormRef = useRef<EstimateFormHandle>(null);

  // Fetch product types
  useEffect(() => {
    api.get<ProductType[]>("/api/v1/product-types?active=true").then((pts) => {
      setProductTypes(pts);
      if (pts.length > 0 && !selectedPtId) {
        setSelectedPtId(pts[0].id);
      }
    });
  }, []);

  // Fetch product lines for the selected product type
  useEffect(() => {
    if (!selectedPtId) return;
    api
      .get<{ id: string; name: string }[]>(
        `/api/v1/product-lines?product_type_id=${selectedPtId}&active=true`
      )
      .then(setProductLines)
      .catch(() => setProductLines([]));
  }, [selectedPtId]);

  // Check if last week's estimates exist
  useEffect(() => {
    if (!selectedPtId || !weekStart) return;
    const lastWeekStart = shiftWeek(weekStart, -1);
    api
      .get<EstimateResponse>(
        `/api/v1/estimates?product_type_id=${selectedPtId}&week_start=${lastWeekStart}`
      )
      .then((resp) => {
        const hasData = resp.product_lines.some((pl) =>
          pl.varieties.some((v) =>
            Object.values(v.estimates).some((e) => e !== null)
          )
        );
        setHasLastEstimate(hasData);
      })
      .catch(() => setHasLastEstimate(false));
  }, [selectedPtId, weekStart]);

  const handleDoneCountChange = useCallback((done: number, total: number) => {
    setDoneCount(done);
    setTotalCount(total);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await estimateFormRef.current?.save();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  // Copy last week's estimates and pre-fill
  const handleCopyLastEstimate = async () => {
    const lastWeekStart = shiftWeek(weekStart, -1);
    const resp = await api.get<EstimateResponse>(
      `/api/v1/estimates?product_type_id=${selectedPtId}&week_start=${lastWeekStart}`
    );

    // Map last week's pull day values to this week's pull days by weekday position
    const lastPullDays = resp.pull_days;
    // We need to know this week's pull days — fetch current data to get them
    const currentResp = await api.get<EstimateResponse>(
      `/api/v1/estimates?product_type_id=${selectedPtId}&week_start=${weekStart}`
    );
    const currentPullDays = currentResp.pull_days;

    const values: Record<string, Record<string, number | null>> = {};
    for (const pl of resp.product_lines) {
      for (const v of pl.varieties) {
        const varietyValues: Record<string, number | null> = {};
        // Map by index: first pull day to first pull day, etc.
        for (let i = 0; i < Math.min(lastPullDays.length, currentPullDays.length); i++) {
          const lastDayValue = v.estimates[lastPullDays[i]];
          if (lastDayValue !== null && lastDayValue !== undefined) {
            varietyValues[currentPullDays[i]] = lastDayValue;
          }
        }
        if (Object.keys(varietyValues).length > 0) {
          values[v.variety_id] = varietyValues;
        }
      }
    }
    estimateFormRef.current?.prefill(values);
  };

  // Print
  const handlePrint = async () => {
    try {
      await openPrintSheet({
        productTypeId: selectedPtId,
        sheetType: "estimate",
        date: weekStart,
      });
    } catch (err) {
      console.error("Print failed:", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="shrink-0 border-b border-[#e0ddd8] bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-[#1e3a5f]">Estimates</h1>
          <div className="flex items-center gap-2 ml-auto">
            {/* Week picker */}
            <div className="flex items-center gap-1 rounded-lg border border-[#e0ddd8] bg-white">
              <button
                onClick={() => setWeekStart(shiftWeek(weekStart, -1))}
                className="p-2 text-[#334155] hover:bg-[#f4f1ec] rounded-l-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-sm font-medium text-[#334155] whitespace-nowrap">
                {formatWeekLabel(weekStart)}
              </span>
              <button
                onClick={() => setWeekStart(shiftWeek(weekStart, 1))}
                className="p-2 text-[#334155] hover:bg-[#f4f1ec] rounded-r-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Product type selector */}
            <select
              value={selectedPtId}
              onChange={(e) => setSelectedPtId(e.target.value)}
              className="h-8 rounded-lg border border-[#e0ddd8] bg-white px-3 text-sm text-[#334155] focus:ring-2 focus:ring-[#c27890] focus:outline-none"
            >
              {productTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto bg-[#f4f1ec] p-4 pb-24">
        {/* Toolbar row */}
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SearchFilterBar
                onSearchChange={setSearchTerm}
                onProductLineFilter={setProductLineFilter}
                onStatusFilter={setStatusFilter}
                productLines={productLines}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CopyButtons
                buttons={[
                  {
                    label: "Copy last week",
                    enabled: hasLastEstimate,
                    disabledReason: "No estimate data for last week",
                    onCopy: handleCopyLastEstimate,
                  },
                ]}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="border-[#e0ddd8] text-[#94a3b8] hover:text-[#334155] min-h-[44px] min-w-[44px]"
                title="Print estimate sheet"
              >
                <Printer className="h-4 w-4" />
              </Button>
              {/* Pull day config */}
              <PullDayConfigPopover
                weekStart={weekStart}
                onSave={() => {
                  const ws = weekStart;
                  setWeekStart("");
                  setTimeout(() => setWeekStart(ws), 0);
                }}
              />
            </div>
          </div>
        </div>

        {/* Sheet completion bar */}
        {selectedPtId && (
          <div className="mb-4">
            <SheetCompletionBar
              doneCount={doneCount}
              totalCount={totalCount}
              isComplete={sheetComplete}
              completedBy={completedBy}
              completedAt={completedAt}
              productTypeId={selectedPtId}
              sheetType="estimate"
              sheetDate={weekStart}
              onCompleteChange={(complete, by, at) => {
                setSheetComplete(complete);
                setCompletedBy(by);
                setCompletedAt(at);
                setRefreshKey((k) => k + 1);
              }}
            />
          </div>
        )}

        {/* Estimate form */}
        {selectedPtId && (
          <EstimateForm
            key={refreshKey}
            ref={estimateFormRef}
            productTypeId={selectedPtId}
            weekStart={weekStart}
            onDoneCountChange={handleDoneCountChange}
            onDirtyChange={setHasDirty}
            searchTerm={searchTerm}
            productLineFilter={productLineFilter}
            statusFilter={statusFilter}
            isComplete={sheetComplete}
          />
        )}
      </div>

      {/* Floating save button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
        <Button
          onClick={handleSave}
          disabled={!hasDirty || saving}
          className={cn(
            "shadow-lg px-8 rounded-full text-base font-medium min-h-[48px] min-w-[120px] transition-all",
            hasDirty && !saving
              ? "bg-[#c27890] hover:bg-[#b0687e] text-white"
              : "bg-[#e0ddd8] text-[#94a3b8] cursor-not-allowed"
          )}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
