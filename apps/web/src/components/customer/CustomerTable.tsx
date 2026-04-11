import { useTableState } from "@/hooks/useTableState";
import type { ColumnDef } from "@/hooks/useTableState";
import { DataTable } from "@/components/common/DataTable";
import { TableToolbar } from "@/components/common/TableToolbar";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types";

const ALL_COLUMNS: ColumnDef[] = [
  { key: "customer_number", label: "#", filterable: true, defaultVisible: true },
  { key: "name", label: "Name", filterable: true, defaultVisible: true },
  { key: "default_ship_via", label: "Ship Via", filterable: true, defaultVisible: true },
  { key: "location", label: "Location", filterable: true, defaultVisible: true },
  { key: "payment_terms", label: "Terms", filterable: true, defaultVisible: true },
  { key: "price_type", label: "Price Type", filterable: true, defaultVisible: true },
  { key: "contact_name", label: "Contact", filterable: true, defaultVisible: true },
  { key: "salesperson", label: "Sales", filterable: true, defaultVisible: true },
  { key: "phone", label: "Phone", filterable: true, defaultVisible: false },
  { key: "email", label: "Email", filterable: true, defaultVisible: false },
  { key: "notes", label: "Notes", filterable: true, defaultVisible: false },
];

const SEARCHABLE_FIELDS = [
  "name",
  "contact_name",
  "location",
  "email",
  "phone",
  "notes",
];

interface CustomerTableProps {
  customers: Customer[];
  activeView: "active" | "archived";
  onViewChange: (view: "active" | "archived") => void;
  onRowClick: (customer: Customer) => void;
  onAddClick: () => void;
}

export function CustomerTable({
  customers,
  activeView,
  onViewChange,
  onRowClick,
  onAddClick,
}: CustomerTableProps) {
  const tableState = useTableState<Customer>({
    data: customers,
    columns: ALL_COLUMNS,
    searchableFields: SEARCHABLE_FIELDS,
    storageKey: "fullbloom:customer-columns",
  });

  return (
    <div>
      <TableToolbar
        title="Customers"
        tableState={tableState}
        activeView={activeView}
        onViewChange={onViewChange}
        addButtonLabel="+ Add Customer"
        onAddClick={onAddClick}
        columns={ALL_COLUMNS}
        searchPlaceholder="Search all fields..."
      />
      <DataTable<Customer>
        columns={ALL_COLUMNS}
        data={customers}
        tableState={tableState}
        onRowClick={onRowClick}
        getRowKey={(c) => c.id}
        cellClassName={(col) =>
          cn(
            col.key === "name" && "font-medium",
            col.key === "notes" && "max-w-[200px] truncate"
          ) || undefined
        }
        emptyMessage="No customers found."
        footerText={`${tableState.filteredData.length} ${activeView} customer${tableState.filteredData.length !== 1 ? "s" : ""}`}
      />
    </div>
  );
}
