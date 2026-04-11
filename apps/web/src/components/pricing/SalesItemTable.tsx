import { useMemo } from "react";
import { useTableState } from "@/hooks/useTableState";
import type { ColumnDef } from "@/hooks/useTableState";
import { DataTable } from "@/components/common/DataTable";
import { TableToolbar } from "@/components/common/TableToolbar";
import type { SalesItem, PriceList } from "@/types";

type FlatSalesItem = SalesItem & {
  price_list_prices?: Record<string, string>;
} & Record<string, unknown>;

interface SalesItemTableProps {
  salesItems: FlatSalesItem[];
  priceLists: PriceList[];
  activeView: "active" | "archived";
  onViewChange: (view: "active" | "archived") => void;
  onRowClick: (item: FlatSalesItem) => void;
  onAddClick: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
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
  activeView,
  onViewChange,
  onRowClick,
  onAddClick,
  selectedIds,
  onSelectionChange,
}: SalesItemTableProps) {
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
