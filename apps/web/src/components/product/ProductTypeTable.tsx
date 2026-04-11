import { useTableState } from "@/hooks/useTableState";
import type { ColumnDef } from "@/hooks/useTableState";
import { DataTable } from "@/components/common/DataTable";
import { TableToolbar } from "@/components/common/TableToolbar";
import type { ProductType } from "@/types";

const COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", filterable: true, sortable: true },
  { key: "product_line_count", label: "Product Lines", filterable: true, sortable: true },
];

const SEARCHABLE_FIELDS = ["name"];

interface ProductTypeTableProps {
  productTypes: ProductType[];
  activeView: "active" | "archived";
  onViewChange: (view: "active" | "archived") => void;
  onRowClick: (productType: ProductType) => void;
  onAddClick: () => void;
}

export function ProductTypeTable({
  productTypes,
  activeView,
  onViewChange,
  onRowClick,
  onAddClick,
}: ProductTypeTableProps) {
  const tableState = useTableState<ProductType>({
    data: productTypes,
    columns: COLUMNS,
    searchableFields: SEARCHABLE_FIELDS,
  });

  return (
    <div>
      <TableToolbar
        title="Product Types"
        tableState={tableState}
        activeView={activeView}
        onViewChange={onViewChange}
        addButtonLabel="+ Add Product Type"
        onAddClick={onAddClick}
      />
      <DataTable<ProductType>
        columns={COLUMNS}
        data={productTypes}
        tableState={tableState}
        onRowClick={onRowClick}
        getRowKey={(pt) => pt.id}
        cellClassName={(col) =>
          col.key === "name" ? "font-medium" : undefined
        }
        emptyMessage="No product types found."
        footerText={`${tableState.filteredData.length} ${activeView} product type${tableState.filteredData.length !== 1 ? "s" : ""}`}
      />
    </div>
  );
}
