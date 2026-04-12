import { useTableState } from "@/hooks/useTableState";
import type { ColumnDef } from "@/hooks/useTableState";
import { DataTable } from "@/components/common/DataTable";
import { TableToolbar } from "@/components/common/TableToolbar";
import type { ProductLine } from "@/types";

const COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", filterable: true, sortable: true },
  { key: "product_type_name", label: "Product Type", filterable: true, sortable: true },
  { key: "variety_count", label: "Varieties", filterable: true, sortable: true },
  { key: "is_active", label: "Active", filterable: true, sortable: true },
];

const SEARCHABLE_FIELDS = ["name", "product_type_name"];

interface ProductLineTableProps {
  productLines: ProductLine[];
  activeView: "active" | "archived";
  onViewChange: (view: "active" | "archived") => void;
  onRowClick: (productLine: ProductLine) => void;
  onAddClick: () => void;
}

export function ProductLineTable({
  productLines,
  activeView,
  onViewChange,
  onRowClick,
  onAddClick,
}: ProductLineTableProps) {
  const tableState = useTableState<ProductLine>({
    data: productLines,
    columns: COLUMNS,
    searchableFields: SEARCHABLE_FIELDS,
    storageKey: "fullbloom-product-lines-columns",
  });

  return (
    <div>
      <TableToolbar
        title="Product Lines"
        tableState={tableState}
        activeView={activeView}
        onViewChange={onViewChange}
        addButtonLabel="+ Add Product Line"
        onAddClick={onAddClick}
        columns={COLUMNS}
      />
      <DataTable<ProductLine>
        columns={COLUMNS}
        data={productLines}
        tableState={tableState}
        onRowClick={onRowClick}
        getRowKey={(pl) => pl.id}
        onReorderColumns={tableState.reorderColumns}
        cellClassName={(col) =>
          col.key === "name" ? "font-medium" : undefined
        }
        emptyMessage="No product lines found."
        footerText={`${tableState.filteredData.length} ${activeView} product line${tableState.filteredData.length !== 1 ? "s" : ""}`}
      />
    </div>
  );
}
