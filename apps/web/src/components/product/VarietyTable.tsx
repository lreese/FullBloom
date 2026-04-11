import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";
import { useTableState } from "@/hooks/useTableState";
import type { ColumnDef } from "@/hooks/useTableState";
import { DataTable } from "@/components/common/DataTable";
import { TableToolbar } from "@/components/common/TableToolbar";
import { cn } from "@/lib/utils";
import type { Variety, VarietyDropdownOptions } from "@/types";

const ALL_COLUMNS: ColumnDef[] = [
  { key: "hex_color", label: "", filterable: false, defaultVisible: true },
  { key: "name", label: "Name", filterable: true, defaultVisible: true },
  { key: "product_line_name", label: "Product Line", filterable: true, defaultVisible: true },
  { key: "product_type_name", label: "Type", filterable: true, defaultVisible: true },
  { key: "color_name", label: "Color", filterable: true, defaultVisible: true },
  { key: "show", label: "Show", filterable: true, defaultVisible: true },
  { key: "flowering_type", label: "Flowering Type", filterable: true, defaultVisible: true },
  { key: "weekly_sales_category", label: "Weekly Sales Category", filterable: true, defaultVisible: true },
  { key: "can_replace", label: "Can Replace", filterable: true, defaultVisible: false },
  { key: "item_group_id", label: "Item Group ID", filterable: true, defaultVisible: false },
  { key: "item_group_description", label: "Item Group Description", filterable: true, defaultVisible: false },
];

const SEARCHABLE_FIELDS = [
  "name",
  "color_name",
  "product_line_name",
  "product_type_name",
  "flowering_type",
];

const BULK_FIELDS = [
  { key: "show", label: "Show" },
  { key: "weekly_sales_category", label: "Weekly Sales Category" },
  { key: "product_line_id", label: "Product Line" },
  { key: "color_id", label: "Color" },
  { key: "flowering_type", label: "Flowering Type" },
] as const;

interface VarietyTableProps {
  varieties: Variety[];
  dropdownOptions: VarietyDropdownOptions;
  activeView: "active" | "archived";
  onViewChange: (view: "active" | "archived") => void;
  onRowClick: (variety: Variety) => void;
  onAddClick: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onBulkUpdate: (field: string, value: string | boolean) => void;
}

export function VarietyTable({
  varieties,
  dropdownOptions,
  activeView,
  onViewChange,
  onRowClick,
  onAddClick,
  selectedIds,
  onSelectionChange,
  onBulkUpdate,
}: VarietyTableProps) {
  const [bulkField, setBulkField] = useState<string>("");
  const [bulkValue, setBulkValue] = useState<string>("");

  const tableState = useTableState<Variety>({
    data: varieties,
    columns: ALL_COLUMNS,
    searchableFields: SEARCHABLE_FIELDS,
    storageKey: "fullbloom:variety-columns",
  });

  const { filteredData, clearAllFilters } = tableState;

  const handleViewChange = (view: "active" | "archived") => {
    clearAllFilters();
    onSelectionChange(new Set());
    onViewChange(view);
  };

  // Selection helpers
  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length && filteredData.length > 0) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(filteredData.map((v) => v.id)));
    }
  };

  const someSelected = selectedIds.size > 0;

  // Bulk value options based on selected field
  const bulkValueOptions = useMemo((): string[] => {
    if (!bulkField) return [];
    if (bulkField === "show") return ["true", "false"];
    if (bulkField === "weekly_sales_category") return dropdownOptions.weekly_sales_categories;
    if (bulkField === "product_line_id") return dropdownOptions.product_lines.map((pl) => pl.id);
    if (bulkField === "color_id") return dropdownOptions.colors.map((c) => c.id);
    if (bulkField === "flowering_type") return dropdownOptions.flowering_types;
    return [];
  }, [bulkField, dropdownOptions]);

  const bulkValueLabels = useMemo((): Record<string, string> => {
    if (bulkField === "show") return { true: "Yes", false: "No" };
    if (bulkField === "product_line_id") {
      return Object.fromEntries(
        dropdownOptions.product_lines.map((pl) => [pl.id, `${pl.product_type} > ${pl.name}`])
      );
    }
    if (bulkField === "color_id") {
      return Object.fromEntries(
        dropdownOptions.colors.map((c) => [c.id, c.name])
      );
    }
    return {};
  }, [bulkField, dropdownOptions]);

  const handleBulkApply = () => {
    if (!bulkField || !bulkValue) return;
    const value = bulkField === "show" ? bulkValue === "true" : bulkValue;
    onBulkUpdate(bulkField, value);
    setBulkField("");
    setBulkValue("");
  };

  const renderCell = (col: ColumnDef, variety: Variety): React.ReactNode => {
    if (col.key === "hex_color") {
      return variety.hex_color ? (
        <div
          className="h-4 w-4 rounded-full border border-[#e0ddd8]"
          style={{ backgroundColor: variety.hex_color as string }}
          title={variety.hex_color as string}
        />
      ) : (
        <div className="h-4 w-4 rounded-full border border-[#e0ddd8] bg-[#f4f1ec]" />
      );
    }
    const val = variety[col.key as keyof Variety];
    if (val == null) return "\u2014";
    if (col.key === "show" || col.key === "can_replace") return val ? "Yes" : "No";
    return String(val);
  };

  const footerText = someSelected
    ? `${selectedIds.size} of ${filteredData.length} selected`
    : `${filteredData.length} ${activeView} variet${filteredData.length !== 1 ? "ies" : "y"}`;

  return (
    <div>
      {someSelected ? (
        // Bulk action toolbar
        <div className="flex flex-wrap items-center gap-2.5 mb-3 px-3 py-2 bg-[#fce7f3] rounded-lg border border-[#f9a8d4]">
          <span className="flex items-center gap-1.5 text-sm font-medium text-[#831843]">
            <CheckCircle2 className="h-4 w-4" />
            {selectedIds.size} selected
          </span>

          <div className="h-5 w-px bg-[#f9a8d4]" />

          <span className="text-xs text-[#831843]">Set</span>
          <Select value={bulkField} onValueChange={(v) => { setBulkField(v); setBulkValue(""); }}>
            <SelectTrigger className="h-7 w-[160px] text-xs bg-white">
              <SelectValue placeholder="Field..." />
            </SelectTrigger>
            <SelectContent>
              {BULK_FIELDS.map((f) => (
                <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-[#831843]">to</span>
          <Select value={bulkValue} onValueChange={setBulkValue} disabled={!bulkField}>
            <SelectTrigger className="h-7 w-[160px] text-xs bg-white">
              <SelectValue placeholder="Value..." />
            </SelectTrigger>
            <SelectContent>
              {bulkValueOptions.map((v) => (
                <SelectItem key={v} value={v}>
                  {bulkValueLabels[v] ?? v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs h-7"
            disabled={!bulkField || !bulkValue}
            onClick={handleBulkApply}
          >
            Apply
          </Button>

          <button
            className="ml-auto text-xs text-[#94a3b8] hover:text-[#334155]"
            onClick={() => onSelectionChange(new Set())}
          >
            Clear Selection
          </button>
        </div>
      ) : (
        <TableToolbar
          title="Varieties"
          tableState={tableState}
          activeView={activeView}
          onViewChange={handleViewChange}
          addButtonLabel="+ Add Variety"
          onAddClick={onAddClick}
          columns={ALL_COLUMNS}
          searchPlaceholder="Search all fields..."
        />
      )}

      <DataTable<Variety>
        columns={ALL_COLUMNS}
        data={varieties}
        tableState={tableState}
        onRowClick={onRowClick}
        getRowKey={(v) => v.id}
        renderCell={renderCell}
        cellClassName={(col) =>
          cn(
            col.key === "name" && "font-medium",
            col.key === "hex_color" && "w-8"
          ) || undefined
        }
        emptyMessage="No varieties found."
        footerText={footerText}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelection}
        onToggleSelectAll={toggleSelectAll}
      />
    </div>
  );
}
