import { useState, useRef, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PriceListHeaderPopover } from "@/components/pricing/PriceListDialog";
import type { PriceList, PriceListMatrixRow, ImpactPreview } from "@/types";

interface PriceListMatrixProps {
  priceLists: PriceList[];
  items: PriceListMatrixRow[];
  onCellSave: (
    priceListId: string | null,
    salesItemId: string,
    newPrice: string
  ) => Promise<void>;
  onFetchImpact: (
    priceListId: string,
    salesItemId: string,
    newPrice: string
  ) => Promise<ImpactPreview>;
  onHeaderClick?: (priceList: PriceList) => void;
  onRename?: (id: string, newName: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}

interface EditingCell {
  salesItemId: string;
  columnId: string; // "retail" or price list UUID
  value: string;
  original: string;
}

interface ImpactState {
  preview: ImpactPreview;
  salesItemId: string;
  priceListId: string;
  newPrice: string;
}

export function PriceListMatrix({
  priceLists,
  items,
  onCellSave,
  onFetchImpact,
  onHeaderClick,
  onRename,
  onArchive,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: PriceListMatrixProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editError, setEditError] = useState(false);
  const [impact, setImpact] = useState<ImpactState | null>(null);
  const [savedCell, setSavedCell] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }, []);

  const filteredItems = useMemo(() => {
    let result = items;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.sales_item_name.toLowerCase().includes(term) ||
          item.variety_name.toLowerCase().includes(term)
      );
    }
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        if (sortConfig.key === "sales_item_name") {
          aVal = a.sales_item_name;
          bVal = b.sales_item_name;
        } else if (sortConfig.key === "variety_name") {
          aVal = a.variety_name;
          bVal = b.variety_name;
        } else if (sortConfig.key === "stems_per_order") {
          aVal = a.stems_per_order;
          bVal = b.stems_per_order;
        } else if (sortConfig.key === "retail") {
          aVal = parseFloat(a.retail_price) || 0;
          bVal = parseFloat(b.retail_price) || 0;
        } else if (sortConfig.key === "spread") {
          const getSpreadSize = (item: PriceListMatrixRow): number => {
            const all = [parseFloat(item.retail_price), ...Object.values(item.prices).map(Number)].filter((p) => !isNaN(p));
            if (all.length < 2) return 0;
            return Math.max(...all) - Math.min(...all);
          };
          aVal = getSpreadSize(a);
          bVal = getSpreadSize(b);
        } else {
          // Price list column
          aVal = parseFloat(a.prices[sortConfig.key] ?? "0") || 0;
          bVal = parseFloat(b.prices[sortConfig.key] ?? "0") || 0;
        }
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        const numA = typeof aVal === "number" ? aVal : 0;
        const numB = typeof bVal === "number" ? bVal : 0;
        return sortConfig.direction === "asc" ? numA - numB : numB - numA;
      });
    }
    return result;
  }, [items, searchTerm, sortConfig]);

  const allSelected =
    filteredItems.length > 0 && selectedIds.size === filteredItems.length;

  const cellKey = (salesItemId: string, columnId: string) =>
    `${salesItemId}:${columnId}`;

  const getCellValue = (item: PriceListMatrixRow, columnId: string): string => {
    if (columnId === "retail") return item.retail_price;
    return item.prices[columnId] ?? "";
  };

  const handleCellClick = (
    item: PriceListMatrixRow,
    columnId: string
  ) => {
    const value = getCellValue(item, columnId);
    setEditing({
      salesItemId: item.sales_item_id,
      columnId,
      value,
      original: value,
    });
    setImpact(null);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleCancel = useCallback(() => {
    setEditing(null);
    setEditError(false);
    setImpact(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editing) return;
    if (editing.value === editing.original) {
      setEditing(null);
      setEditError(false);
      return;
    }

    const numVal = parseFloat(editing.value);
    if (isNaN(numVal) || numVal < 0) {
      setEditError(true);
      return;
    }

    // For price list cells, fetch impact preview first
    if (editing.columnId !== "retail" && !impact) {
      const preview = await onFetchImpact(
        editing.columnId,
        editing.salesItemId,
        editing.value
      );
      setImpact({
        preview,
        salesItemId: editing.salesItemId,
        priceListId: editing.columnId,
        newPrice: editing.value,
      });
      return;
    }

    const priceListId = editing.columnId === "retail" ? null : editing.columnId;
    await onCellSave(priceListId, editing.salesItemId, editing.value);

    const key = cellKey(editing.salesItemId, editing.columnId);
    setSavedCell(key);
    setTimeout(() => setSavedCell(null), 600);

    setEditing(null);
    setEditError(false);
    setImpact(null);
  }, [editing, impact, onCellSave, onFetchImpact]);

  const handleConfirmImpact = useCallback(async () => {
    if (!impact || !editing) return;
    const priceListId = editing.columnId === "retail" ? null : editing.columnId;
    await onCellSave(priceListId, editing.salesItemId, editing.value);

    const key = cellKey(editing.salesItemId, editing.columnId);
    setSavedCell(key);
    setTimeout(() => setSavedCell(null), 600);

    setEditing(null);
    setEditError(false);
    setImpact(null);
  }, [impact, editing, onCellSave]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleSave();
      // Move to next cell in row
      if (editing) {
        const allColumns = ["retail", ...priceLists.map((pl) => pl.id)];
        const currentIdx = allColumns.indexOf(editing.columnId);
        const nextIdx = currentIdx + 1;
        if (nextIdx < allColumns.length) {
          const item = items.find(
            (i) => i.sales_item_id === editing.salesItemId
          );
          if (item) {
            const nextCol = allColumns[nextIdx];
            const value = getCellValue(item, nextCol);
            setEditing({
              salesItemId: item.sales_item_id,
              columnId: nextCol,
              value,
              original: value,
            });
            setTimeout(() => inputRef.current?.select(), 0);
          }
        }
      }
    }
  };

  const getSpread = (item: PriceListMatrixRow): { text: string; hasSpread: boolean } => {
    const allPrices = [
      parseFloat(item.retail_price),
      ...Object.values(item.prices).map(Number),
    ].filter((p) => !isNaN(p));
    if (allPrices.length < 2) return { text: "No Spread", hasSpread: false };
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    if (max - min < 0.01) return { text: "No Spread", hasSpread: false };
    return { text: `$${min.toFixed(2)}\u2013$${max.toFixed(2)}`, hasSpread: true };
  };

  const renderCell = (item: PriceListMatrixRow, columnId: string) => {
    const key = cellKey(item.sales_item_id, columnId);
    const isEditing =
      editing?.salesItemId === item.sales_item_id &&
      editing?.columnId === columnId;
    const isSaved = savedCell === key;
    const value = getCellValue(item, columnId);

    if (isEditing) {
      return (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            className={cn(
              "w-full h-6 px-1 text-xs text-center border-2 rounded outline-none bg-white",
              editError ? "border-red-500" : "border-rose-action"
            )}
            value={editing.value}
            onChange={(e) => {
              setEditing({ ...editing, value: e.target.value });
              setEditError(false);
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {impact &&
            impact.salesItemId === item.sales_item_id &&
            impact.priceListId === columnId && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 z-20 mt-1 bg-white border border-border-warm rounded-lg shadow-lg p-3 w-56 text-xs">
                <div className="text-text-body space-y-1">
                  <div>{impact.preview.customers_on_list} customers on this list</div>
                  <div>
                    {impact.preview.customers_with_overrides} have overrides
                    (unaffected)
                  </div>
                  <div className="font-semibold">
                    {impact.preview.customers_affected} will see price change
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    className="flex-1 px-2 py-1 bg-rose-action text-white rounded text-xs hover:bg-rose-action/90"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleConfirmImpact();
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="flex-1 px-2 py-1 border border-border-warm rounded text-xs text-text-body hover:bg-cream"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCancel();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
        </div>
      );
    }

    // Check for anomaly: price list price >20% different from retail
    const retail = parseFloat(item.retail_price) || 0;
    const cellPrice = parseFloat(value) || 0;
    const isAnomaly = columnId !== "retail" && retail > 0 && cellPrice > 0 &&
      Math.abs(cellPrice - retail) / retail > 0.2;
    const anomalyPct = isAnomaly ? Math.round(((cellPrice - retail) / retail) * 100) : 0;

    return (
      <button
        className={cn(
          "w-full h-6 text-xs text-center cursor-pointer rounded hover:bg-box-pink-bg transition-colors",
          isSaved && "bg-box-green-bg animate-pulse"
        )}
        onClick={() => handleCellClick(item, columnId)}
      >
        {value ? `$${Number(value).toFixed(2)}` : "\u2014"}
        {isAnomaly && (
          <span
            className="ml-0.5 inline-flex items-center text-[7px] bg-white border border-rose-action text-rose-action px-0.5 rounded"
            title={`${anomalyPct > 0 ? "+" : ""}${anomalyPct}% from retail`}
          >
            ⚠ {anomalyPct > 0 ? "+" : ""}{anomalyPct}%
          </span>
        )}
      </button>
    );
  };

  return (
    <div>
      {/* Search */}
      <div className="mb-3 relative max-w-[320px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          placeholder="Search sales items..."
          className="pl-8 h-8 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid */}
      <div className="rounded-lg border border-border-warm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-border-warm bg-cream-warm">
                <th className="px-2 py-1.5 w-8">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onToggleSelectAll}
                  />
                </th>
                <th
                  className="px-2 py-1.5 text-left text-[10px] font-semibold text-slate-heading whitespace-nowrap cursor-pointer select-none"
                  onClick={() => handleSort("sales_item_name")}
                >
                  Sales Item {sortConfig?.key === "sales_item_name" && <span className="text-rose-action">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>}
                </th>
                <th
                  className="px-2 py-1.5 text-left text-[10px] font-semibold text-text-muted whitespace-nowrap cursor-pointer select-none"
                  onClick={() => handleSort("variety_name")}
                >
                  Variety {sortConfig?.key === "variety_name" && <span className="text-rose-action">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>}
                </th>
                <th
                  className="px-2 py-1.5 text-center text-[10px] font-semibold text-slate-heading whitespace-nowrap w-16 cursor-pointer select-none"
                  onClick={() => handleSort("stems_per_order")}
                >
                  Stems {sortConfig?.key === "stems_per_order" && <span className="text-rose-action">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>}
                </th>
                <th
                  className="px-2 py-1.5 text-center text-[10px] font-semibold text-slate-heading whitespace-nowrap w-20 bg-box-pink-bg cursor-pointer select-none"
                  onClick={() => handleSort("retail")}
                >
                  Retail {sortConfig?.key === "retail" && <span className="text-rose-action">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>}
                </th>
                {priceLists.map((pl) => (
                  <th
                    key={pl.id}
                    className="px-2 py-1.5 text-center text-[10px] font-semibold text-slate-heading whitespace-nowrap w-20 cursor-pointer select-none"
                    onClick={() => handleSort(pl.id)}
                  >
                    <div>
                      {onRename && onArchive ? (
                        <span onClick={(e) => e.stopPropagation()}>
                          <PriceListHeaderPopover
                            priceList={pl}
                            onRename={onRename}
                            onArchive={onArchive}
                          >
                            <button className="cursor-pointer hover:bg-cream rounded px-1 py-0.5">
                              {pl.name}
                            </button>
                          </PriceListHeaderPopover>
                        </span>
                      ) : (
                        <span>{pl.name}</span>
                      )}
                      {sortConfig?.key === pl.id && <span className="text-rose-action ml-0.5">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>}
                      <div className="text-text-muted font-normal">
                        {pl.customer_count} customers
                      </div>
                    </div>
                  </th>
                ))}
                <th
                  className="px-2 py-1.5 text-center text-[10px] font-semibold text-text-muted whitespace-nowrap w-24 cursor-pointer select-none"
                  onClick={() => handleSort("spread")}
                >
                  Spread {sortConfig?.key === "spread" && <span className="text-rose-action">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5 + priceLists.length + 1}
                    className="px-3 py-8 text-center text-text-muted"
                  >
                    No sales items found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isSelected = selectedIds.has(item.sales_item_id);
                  const spread = getSpread(item);
                  return (
                    <tr
                      key={item.sales_item_id}
                      className={cn(
                        "border-b border-border-warm transition-colors",
                        idx % 2 === 1 && "bg-cream-warm",
                        isSelected && "bg-box-pink-bg"
                      )}
                    >
                      <td className="px-2 py-1 w-8">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect(item.sales_item_id)}
                        />
                      </td>
                      <td className="px-2 py-1 text-text-body font-medium whitespace-nowrap">
                        {item.sales_item_name}
                      </td>
                      <td className="px-2 py-1 text-text-muted whitespace-nowrap">
                        {item.variety_name}
                      </td>
                      <td className="px-2 py-1 text-center text-text-body">
                        {item.stems_per_order}
                      </td>
                      <td className="px-1 py-1 bg-box-pink-bg/30">
                        {renderCell(item, "retail")}
                      </td>
                      {priceLists.map((pl) => (
                        <td key={pl.id} className="px-1 py-1">
                          {renderCell(item, pl.id)}
                        </td>
                      ))}
                      <td className="px-2 py-1 text-center text-[10px] text-text-muted">
                        <span className={spread.hasSpread ? "" : "text-text-muted italic"}>
                          {spread.text}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-text-muted bg-cream-warm border-t border-border-warm">
          {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""} ·{" "}
          {priceLists.length} price list{priceLists.length !== 1 ? "s" : ""}
          {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
        </div>
      </div>
    </div>
  );
}
