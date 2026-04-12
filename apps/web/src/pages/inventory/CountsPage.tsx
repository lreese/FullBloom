import { useState, useEffect, useCallback, useRef } from "react";
import { Save, Loader2, Printer, Settings } from "lucide-react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SearchFilterBar } from "@/components/inventory/SearchFilterBar";
import { SheetCompletionBar } from "@/components/inventory/SheetCompletionBar";
import { CountForm, type CountFormHandle } from "@/components/inventory/CountForm";
import { CustomerCountSelector, type CustomerCountSelectorHandle } from "@/components/inventory/CustomerCountSelector";
import { TemplateConfigDrawer } from "@/components/inventory/TemplateConfigDrawer";
import { openPrintSheet } from "@/components/inventory/PrintSheet";
import type { ProductType } from "@/types";
import type { CustomerCountResponse } from "@/types/inventory";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type ActiveTab = "standard" | "specials";

export function CountsPage() {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [selectedPtId, setSelectedPtId] = useState<string>("");
  const [countDate, setCountDate] = useState(todayISO());
  const [activeTab, setActiveTab] = useState<ActiveTab>("standard");

  // Filter state shared by both tabs
  const [searchTerm, setSearchTerm] = useState("");
  const [productLineFilter, setProductLineFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "blank" | "filled">("all");

  // Standard tab completion tracking
  const [standardDone, setStandardDone] = useState(0);
  const [standardTotal, setStandardTotal] = useState(0);
  const [standardGrandTotal, setStandardGrandTotal] = useState<number | undefined>(undefined);
  const [standardComplete, setStandardComplete] = useState(false);
  const [standardCompletedBy, setStandardCompletedBy] = useState<string | undefined>();
  const [standardCompletedAt, setStandardCompletedAt] = useState<string | undefined>();

  // Specials tab completion tracking
  const [specialsDone, setSpecialsDone] = useState(0);
  const [specialsTotal, setSpecialsTotal] = useState(0);
  const [specialsGrandTotal, setSpecialsGrandTotal] = useState<number | undefined>(undefined);
  const [specialsComplete, setSpecialsComplete] = useState(false);
  const [specialsCompletedBy, setSpecialsCompletedBy] = useState<string | undefined>();
  const [specialsCompletedAt, setSpecialsCompletedAt] = useState<string | undefined>();

  // Save state
  const [saving, setSaving] = useState(false);
  const [hasDirty, setHasDirty] = useState(false);

  // Template config drawer
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
  const [standardRefreshKey, setStandardRefreshKey] = useState(0);
  const [specialsRefreshKey, setSpecialsRefreshKey] = useState(0);

  const countFormRef = useRef<CountFormHandle>(null);
  const specialsRef = useRef<CustomerCountSelectorHandle>(null);

  // Track dirty state from active form via callback
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setHasDirty(dirty);
  }, []);

  // Fetch product types
  useEffect(() => {
    api.get<ProductType[]>("/api/v1/product-types?active=true").then((pts) => {
      setProductTypes(pts);
      if (pts.length > 0 && !selectedPtId) {
        setSelectedPtId(pts[0].id);
      }
    });
  }, []);

  // Fetch specials completion data
  const fetchSpecialsCompletion = useCallback(async () => {
    if (!selectedPtId || !countDate || activeTab !== "specials") return;
    try {
      const resp = await api.get<CustomerCountResponse>(
        `/api/v1/customer-counts?product_type_id=${selectedPtId}&count_date=${countDate}`
      );
      let done = 0;
      let total = 0;
      for (const pl of resp.product_lines) {
        for (const v of pl.varieties) {
          total++;
          if (v.is_done) done++;
        }
      }
      setSpecialsDone(done);
      setSpecialsTotal(total);
      setSpecialsComplete(resp.sheet_complete);
    } catch {
      // Silently handle -- data might not exist yet
    }
  }, [selectedPtId, countDate, activeTab]);

  useEffect(() => {
    fetchSpecialsCompletion();
  }, [fetchSpecialsCompletion]);

  // Product lines for filter bar
  const [productLines, setProductLines] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!selectedPtId) return;
    api
      .get<{ id: string; name: string }[]>(
        `/api/v1/product-lines?product_type_id=${selectedPtId}&active=true`
      )
      .then(setProductLines)
      .catch(() => setProductLines([]));
  }, [selectedPtId]);

  const handleStandardDoneChange = useCallback((done: number, total: number, grandTotal: number) => {
    setStandardDone(done);
    setStandardTotal(total);
    setStandardGrandTotal(grandTotal);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === "standard") {
        await countFormRef.current?.save();
      } else {
        await specialsRef.current?.save();
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  // Print
  const handlePrint = async () => {
    const sheetType = activeTab === "standard" ? "daily_count" : "customer_count";
    try {
      await openPrintSheet({
        productTypeId: selectedPtId,
        sheetType,
        date: countDate,
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
          <h1 className="text-xl font-bold text-[#1e3a5f]">Counts</h1>
          <div className="flex items-center gap-2 ml-auto">
            <Input
              type="date"
              value={countDate}
              onChange={(e) => setCountDate(e.target.value)}
              className="w-40 bg-white border-[#e0ddd8] text-[#334155] focus-visible:ring-[#c27890] min-h-[44px]"
            />
            <select
              value={selectedPtId}
              onChange={(e) => {
                setSelectedPtId(e.target.value);
                setProductLineFilter(null);
              }}
              className="h-10 min-h-[44px] rounded-lg border border-[#e0ddd8] bg-white px-3 text-sm text-[#334155] focus:ring-2 focus:ring-[#c27890] focus:outline-none"
            >
              {productTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="icon"
              className="text-[#94a3b8] border-[#e0ddd8] min-w-[44px] min-h-[44px] hover:text-[#334155]"
              title="Print sheet"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mt-3 border-b border-[#e0ddd8]">
          <button
            onClick={() => {
              if (activeTab === "standard") return;
              if (hasDirty && !window.confirm("You have unsaved changes. Switch tabs anyway?")) return;
              setActiveTab("standard");
            }}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors min-h-[44px]",
              activeTab === "standard"
                ? "border-[#c27890] text-[#c27890]"
                : "border-transparent text-[#94a3b8] hover:text-[#334155]"
            )}
          >
            Standard
          </button>
          <button
            onClick={() => {
              if (activeTab === "specials") return;
              if (hasDirty && !window.confirm("You have unsaved changes. Switch tabs anyway?")) return;
              setActiveTab("specials");
            }}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors min-h-[44px]",
              activeTab === "specials"
                ? "border-[#c27890] text-[#c27890]"
                : "border-transparent text-[#94a3b8] hover:text-[#334155]"
            )}
          >
            Specials
          </button>
          {activeTab === "specials" && (
            <button
              onClick={() => setTemplateDrawerOpen(true)}
              className="ml-auto p-2 rounded-md text-[#94a3b8] hover:text-[#c27890] hover:bg-[#f4f1ec] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Configure specials columns"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto bg-[#f4f1ec] p-4 pb-24">
        {/* Toolbar */}
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
          </div>
        </div>

        {/* Sheet completion bar */}
        {activeTab === "standard" && selectedPtId && (
          <div className="mb-4">
            <SheetCompletionBar
              doneCount={standardDone}
              totalCount={standardTotal}
              grandTotal={standardGrandTotal}
              grandTotalLabel="standard"
              combinedTotal={standardGrandTotal !== undefined && specialsGrandTotal !== undefined ? standardGrandTotal + specialsGrandTotal : undefined}
              isComplete={standardComplete}
              completedBy={standardCompletedBy}
              completedAt={standardCompletedAt}
              productTypeId={selectedPtId}
              sheetType="daily_count"
              sheetDate={countDate}
              onCompleteChange={(complete, by, at) => {
                setStandardComplete(complete);
                setStandardCompletedBy(by);
                setStandardCompletedAt(at);
                setStandardRefreshKey((k) => k + 1);
              }}
            />
          </div>
        )}
        {activeTab === "specials" && selectedPtId && (
          <div className="mb-4">
            <SheetCompletionBar
              doneCount={specialsDone}
              totalCount={specialsTotal}
              grandTotal={specialsGrandTotal}
              grandTotalLabel="specials"
              combinedTotal={standardGrandTotal !== undefined && specialsGrandTotal !== undefined ? standardGrandTotal + specialsGrandTotal : undefined}
              isComplete={specialsComplete}
              completedBy={specialsCompletedBy}
              completedAt={specialsCompletedAt}
              productTypeId={selectedPtId}
              sheetType="customer_count"
              sheetDate={countDate}
              onCompleteChange={(complete, by, at) => {
                setSpecialsComplete(complete);
                setSpecialsCompletedBy(by);
                setSpecialsCompletedAt(at);
                setSpecialsRefreshKey((k) => k + 1);
              }}
            />
          </div>
        )}

        {/* Tab content */}
        {activeTab === "standard" && selectedPtId && (
          <CountForm
            key={standardRefreshKey}
            ref={countFormRef}
            productTypeId={selectedPtId}
            countDate={countDate}
            onDoneCountChange={handleStandardDoneChange}
            onDirtyChange={handleDirtyChange}
            searchTerm={searchTerm}
            productLineFilter={productLineFilter}
            statusFilter={statusFilter}
            isComplete={standardComplete}
          />
        )}

        {activeTab === "specials" && selectedPtId && (
          <CustomerCountSelector
            key={specialsRefreshKey}
            ref={specialsRef}
            productTypeId={selectedPtId}
            countDate={countDate}
            searchTerm={searchTerm}
            productLineFilter={productLineFilter}
            statusFilter={statusFilter}
            isComplete={specialsComplete}
            onDoneCountChange={(done, total, grandTotal) => {
              setSpecialsDone(done);
              setSpecialsTotal(total);
              setSpecialsGrandTotal(grandTotal);
            }}
            onDirtyChange={handleDirtyChange}
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
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </Button>
      </div>

      {/* Template config drawer for Specials tab */}
      <TemplateConfigDrawer
        productTypeId={selectedPtId}
        isOpen={templateDrawerOpen}
        onClose={() => setTemplateDrawerOpen(false)}
        onSave={() => {
          fetchSpecialsCompletion();
          setSpecialsRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
