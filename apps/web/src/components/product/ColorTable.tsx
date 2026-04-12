import { useTableState } from "@/hooks/useTableState";
import type { ColumnDef } from "@/hooks/useTableState";
import { DataTable } from "@/components/common/DataTable";
import { TableToolbar } from "@/components/common/TableToolbar";
import { cn } from "@/lib/utils";
import type { Color } from "@/types";

const COLUMNS: ColumnDef[] = [
  { key: "hex_color", label: "Swatch", filterable: false, sortable: false },
  { key: "name", label: "Name", filterable: true, sortable: true },
  { key: "variety_count", label: "Varieties", filterable: true, sortable: true },
];

const SEARCHABLE_FIELDS = ["name"];

interface ColorTableProps {
  colors: Color[];
  activeView: "active" | "archived";
  onViewChange: (view: "active" | "archived") => void;
  onRowClick: (color: Color) => void;
  onAddClick: () => void;
}

export function ColorTable({
  colors,
  activeView,
  onViewChange,
  onRowClick,
  onAddClick,
}: ColorTableProps) {
  const tableState = useTableState<Color>({
    data: colors,
    columns: COLUMNS,
    searchableFields: SEARCHABLE_FIELDS,
    storageKey: "fullbloom-colors-columns",
    defaultSort: { key: "name", direction: "asc" },
  });

  const renderCell = (col: ColumnDef, color: Color): React.ReactNode => {
    if (col.key === "hex_color") {
      return color.hex_color ? (
        <div
          className="h-5 w-5 rounded-full border border-[#e0ddd8]"
          style={{ backgroundColor: color.hex_color as string }}
        />
      ) : (
        <div className="h-5 w-5 rounded-full border border-[#e0ddd8] bg-[#f4f1ec]" />
      );
    }
    const val = color[col.key as keyof Color];
    if (val == null) return "\u2014";
    return String(val);
  };

  return (
    <div>
      <TableToolbar
        title="Colors"
        tableState={tableState}
        activeView={activeView}
        onViewChange={onViewChange}
        addButtonLabel="+ Add Color"
        onAddClick={onAddClick}
        columns={COLUMNS}
      />
      <DataTable<Color>
        columns={COLUMNS}
        data={colors}
        tableState={tableState}
        onRowClick={onRowClick}
        getRowKey={(c) => c.id}
        onReorderColumns={tableState.reorderColumns}
        renderCell={renderCell}
        cellClassName={(col) =>
          cn(
            col.key === "hex_color" && "w-10",
            col.key === "name" && "font-medium",
            col.key === "variety_count" && "w-24 text-[#94a3b8]"
          ) || undefined
        }
        emptyMessage="No colors found."
        footerText={`${tableState.filteredData.length} color${tableState.filteredData.length !== 1 ? "s" : ""}`}
      />
    </div>
  );
}
