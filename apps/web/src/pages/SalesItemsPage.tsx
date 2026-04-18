import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { api } from "@/services/api";
import { SalesItemDrawer } from "@/components/pricing/SalesItemDrawer";
import { ProductArchiveDialog } from "@/components/product/ProductArchiveDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnFilter } from "@/components/common/ColumnFilter";
import { TableToolbar } from "@/components/common/TableToolbar";
import { CheckCircle2, Settings2 } from "lucide-react";
import { useTableState } from "@/hooks/useTableState";
import type { ColumnDef } from "@/hooks/useTableState";
import { cn } from "@/lib/utils";
import type { SalesItem, PriceList, Variety } from "@/types";

type FlatSalesItem = SalesItem & {
  variety_name?: string;
  variety_id?: string;
  price_list_prices?: Record<string, string>;
} & Record<string, unknown>;

const STATIC_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", filterable: true, sortable: true, defaultVisible: true },
  { key: "variety_name", label: "Variety", filterable: true, sortable: true, defaultVisible: true },
  { key: "stems_per_order", label: "Stems", filterable: false, sortable: true, defaultVisible: true },
  { key: "retail_price", label: "Retail Price", filterable: false, sortable: true, defaultVisible: true },
];

const SEARCHABLE_FIELDS = ["name", "variety_name"];

const BULK_FIELDS = [
  { key: "retail_price", label: "Retail Price" },
  { key: "variety_id", label: "Variety" },
] as const;

export function SalesItemsPage() {
  const [salesItems, setSalesItems] = useState<FlatSalesItem[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [activeView, setActiveView] = useState<"active" | "archived">("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk update state
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "add">("edit");
  const [selectedItem, setSelectedItem] = useState<FlatSalesItem | null>(null);
  const [priceListPrices, setPriceListPrices] = useState<Record<string, string>>({});
  const [customerPricesCount, setCustomerPricesCount] = useState(0);

  // Archive dialog state
  const [archiveTarget, setArchiveTarget] = useState<FlatSalesItem | null>(null);

  // Import
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.postFile("/api/v1/import/pricing", file);
      await fetchSalesItems();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Import failed");
    }
    e.target.value = "";
  };

  const fetchSalesItems = useCallback(async () => {
    const data = await api.get<FlatSalesItem[]>(
      `/api/v1/sales-items?active=${activeView === "active"}`
    );
    setSalesItems(data);
  }, [activeView]);

  const fetchPriceLists = useCallback(async () => {
    const data = await api.get<PriceList[]>("/api/v1/price-lists?active=true");
    setPriceLists(data);
  }, []);

  const fetchVarieties = useCallback(async () => {
    const data = await api.get<Variety[]>("/api/v1/varieties?active=true");
    setVarieties(data);
  }, []);

  useEffect(() => {
    fetchSalesItems();
  }, [fetchSalesItems]);

  useEffect(() => {
    fetchPriceLists();
    fetchVarieties();
  }, [fetchPriceLists, fetchVarieties]);

  // Build dynamic columns from price lists
  const allColumns = useMemo<ColumnDef[]>(() => {
    const dynamicCols: ColumnDef[] = priceLists.map((pl) => ({
      key: `pl_${pl.id}`,
      label: pl.name,
      filterable: false,
      sortable: true,
      defaultVisible: true,
    }));
    return [...STATIC_COLUMNS, ...dynamicCols];
  }, [priceLists]);

  // Flatten price list prices into top-level keys
  const flatItems = useMemo<FlatSalesItem[]>(() => {
    return salesItems.map((item) => {
      const flat: Record<string, unknown> = { ...item };
      if (item.price_list_prices) {
        for (const pl of priceLists) {
          flat[`pl_${pl.id}`] = item.price_list_prices[pl.id] ?? null;
        }
      }
      return flat as FlatSalesItem;
    });
  }, [salesItems, priceLists]);

  // ── Table state (sorting, filtering, column prefs) ────────
  const tableState = useTableState<FlatSalesItem>({
    data: flatItems,
    columns: allColumns,
    searchableFields: SEARCHABLE_FIELDS,
    storageKey: "fullbloom-sales-items-columns",
    defaultSort: { key: "name", direction: "asc" },
  });

  const {
    activeColumns,
    filteredData,
    sortConfig,
    handleSort,
    columnFilters,
    setColumnFilter,
    distinctValues,
    hasActiveFilters,
    clearAllFilters,
    columnPrefs,
    searchTerm,
    setSearchTerm,
  } = tableState;

  // ── Selection helpers ─────────────────────────────────────
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map((i) => i.id)));
    }
  };

  const someSelected = selectedIds.size > 0;
  const allSelected = filteredData.length > 0 && selectedIds.size === filteredData.length;

  // ── Header drag-to-reorder state ──────────────────────────
  const [headerDragIdx, setHeaderDragIdx] = useState<number | null>(null);
  const [headerDropIdx, setHeaderDropIdx] = useState<number | null>(null);

  const handleHeaderDragStart = useCallback(
    (e: React.DragEvent, idx: number) => {
      setHeaderDragIdx(idx);
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleHeaderDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const insertIdx = e.clientX < midX ? idx : idx + 1;
      setHeaderDropIdx(insertIdx);
    },
    []
  );

  const handleHeaderDrop = useCallback(() => {
    if (headerDragIdx === null || headerDropIdx === null) return;
    if (headerDragIdx !== headerDropIdx) {
      tableState.reorderColumns(headerDragIdx, headerDropIdx);
    }
    setHeaderDragIdx(null);
    setHeaderDropIdx(null);
  }, [headerDragIdx, headerDropIdx, tableState]);

  const handleHeaderDragEnd = useCallback(() => {
    setHeaderDragIdx(null);
    setHeaderDropIdx(null);
  }, []);

  // ── Row click / drawer handlers ───────────────────────────
  const handleRowClick = async (item: FlatSalesItem) => {
    setSelectedItem(item);
    setPriceListPrices(item.price_list_prices ?? {});
    setCustomerPricesCount(item.customer_prices_count ?? 0);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const handleAddClick = () => {
    setSelectedItem(null);
    setPriceListPrices({});
    setCustomerPricesCount(0);
    setDrawerMode("add");
    setDrawerOpen(true);
  };

  const handleSave = async (data: {
    name: string;
    variety_id?: string;
    stems_per_order: number;
    retail_price: string;
    price_list_prices?: Record<string, string>;
    selected_price_lists?: string[];
  }) => {
    if (drawerMode === "add") {
      const varietyId = data.variety_id;
      if (!varietyId) throw new Error("Variety is required to create a sales item");
      const { variety_id: _, ...body } = data;
      await api.post(`/api/v1/varieties/${varietyId}/sales-items`, body);
    } else if (selectedItem) {
      await api.patch(`/api/v1/sales-items/${selectedItem.id}`, data);
      if (data.price_list_prices) {
        for (const [plId, price] of Object.entries(data.price_list_prices)) {
          await api.patch(
            `/api/v1/price-list-items/${plId}/${selectedItem.id}`,
            { price }
          );
        }
      }
    }
    await fetchSalesItems();
  };

  const handleArchiveRequest = (id: string) => {
    const item = salesItems.find((i) => i.id === id);
    if (item) setArchiveTarget(item);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    await api.post(`/api/v1/sales-items/${archiveTarget.id}/archive`, {});
    setArchiveTarget(null);
    setDrawerOpen(false);
    await fetchSalesItems();
  };

  const handleRestore = async (id: string) => {
    await api.post(`/api/v1/sales-items/${id}/restore`, {});
    setDrawerOpen(false);
    await fetchSalesItems();
  };

  const handleBulkUpdate = async (ids: string[], field: string, value: string) => {
    const updateData = field === "retail_price"
      ? { retail_price: value }
      : { [field]: value };
    await Promise.all(
      ids.map((id) => api.patch(`/api/v1/sales-items/${id}`, updateData))
    );
    await fetchSalesItems();
  };

  const handleBulkApply = async () => {
    if (!bulkField || !bulkValue || selectedIds.size === 0) return;
    await handleBulkUpdate(Array.from(selectedIds), bulkField, bulkValue);
    setBulkField("");
    setBulkValue("");
    setSelectedIds(new Set());
  };

  const handleViewChange = (view: "active" | "archived") => {
    clearAllFilters();
    setActiveView(view);
  };

  // ── Render cell content ───────────────────────────────────
  const renderCell = (col: ColumnDef, item: FlatSalesItem) => {
    switch (col.key) {
      case "name":
        return (
          <span className="font-medium" style={{ color: "var(--color-text-body)" }}>
            {item.name}
          </span>
        );
      case "variety_name":
        return (
          <span style={{ color: "var(--color-slate-500)" }}>
            {item.variety_name ?? "\u2014"}
          </span>
        );
      case "stems_per_order":
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "var(--color-box-green-bg)", color: "var(--color-sidebar-hover)" }}
          >
            {item.stems_per_order}
          </span>
        );
      case "retail_price":
        return (
          <span style={{ color: "var(--color-text-body)" }}>
            ${Number(item.retail_price).toFixed(2)}
          </span>
        );
      default: {
        // Dynamic price list columns
        if (col.key.startsWith("pl_")) {
          const val = item[col.key];
          if (val == null) return "\u2014";
          return (
            <span style={{ color: "var(--color-text-body)" }}>
              ${Number(val).toFixed(2)}
            </span>
          );
        }
        const val = item[col.key];
        if (val == null) return "\u2014";
        return String(val);
      }
    }
  };

  const colSpan = activeColumns.length + 1; // +1 for checkbox column

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-cream)" }}>
      <div className="max-w-[1400px] mx-auto px-4 py-6 sm:px-6">
        {/* ── Bulk selection bar OR Header ───────────────── */}
        {someSelected ? (
          <div className="flex flex-wrap items-center gap-2.5 mb-3 px-3 py-2 bg-box-pink-bg rounded-lg border border-pink-300">
            <span className="flex items-center gap-1.5 text-sm font-medium text-box-pink-text">
              <CheckCircle2 className="h-4 w-4" />
              {selectedIds.size} selected
            </span>

            <div className="h-5 w-px bg-pink-300" />

            <span className="text-xs text-box-pink-text">Set</span>
            <Select value={bulkField} onValueChange={(v) => { setBulkField(v); setBulkValue(""); }}>
              <SelectTrigger className="h-7 w-[140px] text-xs bg-white">
                <SelectValue placeholder="Field..." />
              </SelectTrigger>
              <SelectContent>
                {BULK_FIELDS.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-xs text-box-pink-text">to</span>

            {bulkField === "variety_id" ? (
              <Select value={bulkValue} onValueChange={setBulkValue}>
                <SelectTrigger className="h-7 w-[180px] text-xs bg-white">
                  <SelectValue placeholder="Variety..." />
                </SelectTrigger>
                <SelectContent>
                  {varieties.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type="text"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder="$0.00"
                className="h-7 w-24 text-xs"
                disabled={!bulkField}
              />
            )}

            <Button
              size="sm"
              className="bg-rose-action hover:bg-rose-action/90 text-white text-xs h-7"
              disabled={!bulkField || !bulkValue}
              onClick={handleBulkApply}
            >
              Apply
            </Button>

            <button
              className="ml-auto text-xs text-text-muted hover:text-text-body"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear Selection
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <TableToolbar
              title="Sales Items"
              tableState={tableState}
              activeView={activeView}
              onViewChange={handleViewChange}
              columns={allColumns}
              searchPlaceholder="Search sales items..."
            />
            <div className="ml-auto flex items-center gap-2">
              <button
                className="text-xs text-text-body border border-border-warm rounded px-2 py-1 hover:bg-cream"
                onClick={() => importFileRef.current?.click()}
              >
                Import CSV
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button
                size="sm"
                className="bg-rose-action hover:bg-rose-action/90 text-white text-xs"
                onClick={handleAddClick}
              >
                + Add Sales Item
              </Button>
            </div>
          </div>
        )}

        {/* ── Table ──────────────────────────────────────── */}
        <div className="rounded-lg border border-border-warm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border-warm bg-cream-warm">
                  {/* Checkbox column */}
                  <th className="px-2 py-2.5 w-8">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleToggleSelectAll}
                    />
                  </th>
                  {/* Data columns */}
                  {activeColumns.map((col, idx) => {
                    const isSortable = col.sortable !== false;
                    const isSorted = sortConfig?.key === col.key;
                    return (
                      <th
                        key={col.key}
                        draggable
                        onDragStart={(e) => handleHeaderDragStart(e, idx)}
                        onDragOver={(e) => handleHeaderDragOver(e, idx)}
                        onDrop={handleHeaderDrop}
                        onDragEnd={handleHeaderDragEnd}
                        className={cn(
                          "px-3 py-2.5 text-left text-[10px] font-semibold text-slate-heading whitespace-nowrap relative select-none",
                          isSortable && "cursor-pointer",
                          headerDragIdx === idx && "opacity-50"
                        )}
                        onClick={() => isSortable && handleSort(col.key)}
                      >
                        {/* Left drop indicator */}
                        {headerDropIdx === idx &&
                          headerDragIdx !== idx &&
                          headerDragIdx !== idx - 1 && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-rose-action z-10" />
                          )}

                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {isSorted && (
                            <span className="text-rose-action">
                              {sortConfig.direction === "asc" ? "\u25B2" : "\u25BC"}
                            </span>
                          )}
                          {col.filterable && distinctValues[col.key] && (
                            <span onClick={(e) => e.stopPropagation()}>
                              <ColumnFilter
                                values={distinctValues[col.key]}
                                selected={columnFilters[col.key] ?? []}
                                onChange={(selected) =>
                                  setColumnFilter(col.key, selected)
                                }
                              />
                            </span>
                          )}
                        </span>

                        {/* Right drop indicator (last column) */}
                        {headerDropIdx === activeColumns.length &&
                          idx === activeColumns.length - 1 &&
                          headerDragIdx !== idx && (
                            <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-rose-action z-10" />
                          )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={colSpan}
                      className="text-center py-12"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      No sales items found.
                      {hasActiveFilters && (
                        <button
                          className="ml-2 text-rose-action hover:underline"
                          onClick={clearAllFilters}
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "border-b border-border-warm hover:bg-cream-warm cursor-pointer transition-colors",
                          isSelected && "bg-box-pink-bg hover:bg-box-pink-bg"
                        )}
                        onClick={() => handleRowClick(item)}
                      >
                        <td
                          className="px-2 py-2.5 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelect(item.id)}
                          />
                        </td>
                        {activeColumns.map((col) => (
                          <td key={col.key} className="px-3 py-2.5 text-text-body">
                            {renderCell(col, item)}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="px-3 py-2 text-xs text-text-muted bg-cream-warm border-t border-border-warm">
            {filteredData.length} sales item{filteredData.length !== 1 ? "s" : ""}
            {hasActiveFilters ? " (filtered)" : ""}
          </div>
        </div>
      </div>

      <SalesItemDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        salesItem={selectedItem}
        varieties={varieties}
        priceLists={priceLists}
        priceListPrices={priceListPrices}
        customerPricesCount={customerPricesCount}
        onSave={handleSave}
        onArchive={handleArchiveRequest}
        onRestore={handleRestore}
      />

      <ProductArchiveDialog
        open={archiveTarget !== null}
        entityName={archiveTarget?.name ?? ""}
        entityType="sales item"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}
