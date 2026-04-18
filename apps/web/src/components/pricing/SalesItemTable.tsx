import { useMemo, useState } from "react";
import { useTableState } from "@/hooks/useTableState";
import type { ColumnDef } from "@/hooks/useTableState";
import { DataTable } from "@/components/common/DataTable";
import { TableToolbar } from "@/components/common/TableToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";
import type { SalesItem, PriceList, Variety } from "@/types";

type FlatSalesItem = SalesItem & {
  price_list_prices?: Record<string, string>;
} & Record<string, unknown>;

const BULK_FIELDS = [
  { key: "retail_price", label: "Retail Price" },
  { key: "variety_id", label: "Variety" },
] as const;

interface SalesItemTableProps {
  salesItems: FlatSalesItem[];
  priceLists: PriceList[];
  varieties: Variety[];
  activeView: "active" | "archived";
  onViewChange: (view: "active" | "archived") => void;
  onRowClick: (item: FlatSalesItem) => void;
  onAddClick: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onBulkUpdate: (ids: string[], field: string, value: string) => Promise<void>;
}

const STATIC_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", filterable: true },
  { key: "variety_name", label: "Variety", filterable: true },
  { key: "stems_per_order", label: "Stems", filterable: false },
  { key: "retail_price", label: "Retail Price", filterable: false },
];

const SEARCHABLE_FIELDS = ["name", "variety_name"];

export function SalesItemTable({
  salesItems,
  priceLists,
  varieties,
  activeView,
  onViewChange,
  onRowClick,
  onAddClick,
  selectedIds,
  onSelectionChange,
  onBulkUpdate,
}: SalesItemTableProps) {
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  // Build dynamic columns from price lists
  const allColumns = useMemo<ColumnDef[]>(() => {
    const dynamicCols: ColumnDef[] = priceLists.map((pl) => ({
      key: `pl_${pl.id}`,
      label: pl.name,
      filterable: false,
    }));
    return [...STATIC_COLUMNS, ...dynamicCols];
  }, [priceLists]);

  // Flatten price list prices into top-level keys for DataTable
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

  const tableState = useTableState<FlatSalesItem>({
    data: flatItems,
    columns: allColumns,
    searchableFields: SEARCHABLE_FIELDS,
    storageKey: "fullbloom:sales-item-columns",
  });

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === tableState.filteredData.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(
        new Set(tableState.filteredData.map((i) => i.id))
      );
    }
  };

  const someSelected = selectedIds.size > 0;

  const handleBulkApply = async () => {
    if (!bulkField || !bulkValue || selectedIds.size === 0) return;
    await onBulkUpdate(Array.from(selectedIds), bulkField, bulkValue);
    setBulkField("");
    setBulkValue("");
    onSelectionChange(new Set());
  };

  const renderCell = (col: ColumnDef, item: FlatSalesItem) => {
    if (col.key === "retail_price") {
      return `$${Number(item.retail_price).toFixed(2)}`;
    }
    if (col.key.startsWith("pl_")) {
      const val = item[col.key];
      if (val == null) return "\u2014";
      return `$${Number(val).toFixed(2)}`;
    }
    const val = item[col.key];
    if (val == null) return "\u2014";
    return String(val);
  };

  return (
    <div>
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
            onClick={() => onSelectionChange(new Set())}
          >
            Clear Selection
          </button>
        </div>
      ) : (
        <TableToolbar
          title="Sales Items"
          tableState={tableState}
          activeView={activeView}
          onViewChange={onViewChange}
          addButtonLabel="+ Add Sales Item"
          onAddClick={onAddClick}
          columns={allColumns}
          searchPlaceholder="Search sales items..."
        />
      )}

      <DataTable<FlatSalesItem>
        columns={allColumns}
        data={flatItems}
        tableState={tableState}
        onRowClick={onRowClick}
        getRowKey={(item) => item.id}
        renderCell={renderCell}
        emptyMessage="No sales items found."
        footerText={`${tableState.filteredData.length} sales item${tableState.filteredData.length !== 1 ? "s" : ""}`}
        onReorderColumns={tableState.reorderColumns}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
      />
    </div>
  );
}
