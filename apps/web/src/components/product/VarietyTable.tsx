import { useMemo, useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnFilter } from "@/components/common/ColumnFilter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Settings2, GripVertical, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Variety, VarietyDropdownOptions } from "@/types";

interface ColumnDef {
  key: string;
  label: string;
  filterable: boolean;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", filterable: true, defaultVisible: true },
  { key: "product_line_name", label: "Product Line", filterable: true, defaultVisible: true },
  { key: "product_type_name", label: "Type", filterable: true, defaultVisible: true },
  { key: "color_name", label: "Color", filterable: true, defaultVisible: true },
  { key: "show", label: "Show", filterable: true, defaultVisible: true },
  { key: "flowering_type", label: "Flowering Type", filterable: true, defaultVisible: true },
  { key: "weekly_sales_category", label: "Weekly Sales Category", filterable: true, defaultVisible: true },
  { key: "hex_color", label: "Hex Color", filterable: true, defaultVisible: false },
  { key: "can_replace", label: "Can Replace", filterable: true, defaultVisible: false },
  { key: "item_group_id", label: "Item Group ID", filterable: true, defaultVisible: false },
  { key: "item_group_description", label: "Item Group Description", filterable: true, defaultVisible: false },
];

const COLUMN_MAP = Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c]));
const DEFAULT_ORDER = ALL_COLUMNS.map((c) => c.key);
const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));

const STORAGE_KEY = "fullbloom:variety-columns";

const SEARCHABLE_FIELDS = [
  "name",
  "color_name",
  "product_line_name",
  "product_type_name",
  "flowering_type",
] as const;

const BULK_FIELDS = [
  { key: "show", label: "Show" },
  { key: "weekly_sales_category", label: "Weekly Sales Category" },
  { key: "product_line_id", label: "Product Line" },
  { key: "color_id", label: "Color" },
  { key: "flowering_type", label: "Flowering Type" },
] as const;

interface ColumnPrefs {
  order: string[];
  visible: string[];
}

function loadColumnPrefs(): ColumnPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return { order: DEFAULT_ORDER, visible: parsed };
      }
      const order = parsed.order ?? DEFAULT_ORDER;
      const allKeys = new Set(DEFAULT_ORDER);
      const missing = DEFAULT_ORDER.filter((k) => !order.includes(k));
      return {
        order: [...order.filter((k: string) => allKeys.has(k)), ...missing],
        visible: parsed.visible ?? [...DEFAULT_VISIBLE],
      };
    }
  } catch { /* ignore */ }
  return { order: DEFAULT_ORDER, visible: [...DEFAULT_VISIBLE] };
}

function saveColumnPrefs(prefs: ColumnPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

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
  const [searchTerm, setSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [columnPrefs, setColumnPrefs] = useState<ColumnPrefs>(loadColumnPrefs);
  const [bulkField, setBulkField] = useState<string>("");
  const [bulkValue, setBulkValue] = useState<string>("");
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const hasActiveFilters =
    searchTerm.length > 0 ||
    Object.values(columnFilters).some((v) => v.length > 0);

  const clearAllFilters = () => {
    setSearchTerm("");
    setColumnFilters({});
  };

  const handleViewChange = (view: "active" | "archived") => {
    clearAllFilters();
    onSelectionChange(new Set());
    onViewChange(view);
  };

  const toggleColumn = (key: string) => {
    setColumnPrefs((prev) => {
      const visible = prev.visible.includes(key)
        ? prev.visible.filter((k) => k !== key)
        : [...prev.visible, key];
      const next = { ...prev, visible };
      saveColumnPrefs(next);
      return next;
    });
  };

  const handleDragStart = useCallback((idx: number) => {
    dragItem.current = idx;
  }, []);

  const handleDragEnter = useCallback((idx: number) => {
    dragOver.current = idx;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || dragOver.current === null) return;
    if (dragItem.current === dragOver.current) {
      dragItem.current = null;
      dragOver.current = null;
      return;
    }
    setColumnPrefs((prev) => {
      const order = [...prev.order];
      const [removed] = order.splice(dragItem.current!, 1);
      order.splice(dragOver.current!, 0, removed);
      dragItem.current = null;
      dragOver.current = null;
      const next = { ...prev, order };
      saveColumnPrefs(next);
      return next;
    });
  }, []);

  // Compute distinct values for filterable columns
  const distinctValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const col of ALL_COLUMNS) {
      if (!col.filterable) continue;
      const values = new Set<string>();
      for (const v of varieties) {
        const val = v[col.key as keyof Variety];
        if (val != null && val !== "") values.add(String(val));
      }
      result[col.key] = Array.from(values).sort();
    }
    return result;
  }, [varieties]);

  // Apply search + column filters
  const filtered = useMemo(() => {
    let result = varieties;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((v) =>
        SEARCHABLE_FIELDS.some((field) => {
          const val = v[field as keyof Variety];
          return val != null && String(val).toLowerCase().includes(term);
        })
      );
    }

    for (const [key, selected] of Object.entries(columnFilters)) {
      if (selected.length === 0) continue;
      result = result.filter((v) => {
        const val = v[key as keyof Variety];
        return val != null && selected.includes(String(val));
      });
    }

    return result;
  }, [varieties, searchTerm, columnFilters]);

  // Active columns: visible ones in the user's order
  const activeColumns = columnPrefs.order
    .filter((key) => columnPrefs.visible.includes(key))
    .map((key) => COLUMN_MAP[key])
    .filter(Boolean);

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
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(filtered.map((v) => v.id)));
    }
  };

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
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

  const formatCellValue = (col: ColumnDef, variety: Variety): string => {
    const val = variety[col.key as keyof Variety];
    if (val == null) return "\u2014";
    if (col.key === "show" || col.key === "can_replace") return val ? "Yes" : "No";
    return String(val);
  };

  return (
    <div>
      {/* Toolbar / Bulk Toolbar */}
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
        // Main toolbar
        <div className="flex flex-wrap items-center gap-2.5 mb-3">
          <h1 className="text-lg font-bold text-[#1e3a5f] whitespace-nowrap">
            Varieties
          </h1>

          <div className="flex-1 min-w-[180px] max-w-[320px] relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
            <Input
              placeholder="Search all fields..."
              className="pl-8 h-8 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Active/Archived toggle */}
          <div className="flex gap-px bg-[#e0ddd8] rounded-md overflow-hidden">
            <button
              className={cn(
                "px-3 py-1 text-xs transition-colors",
                activeView === "active"
                  ? "bg-[#c27890] text-white"
                  : "bg-white text-[#334155] hover:bg-[#f4f1ec]"
              )}
              onClick={() => handleViewChange("active")}
            >
              Active
            </button>
            <button
              className={cn(
                "px-3 py-1 text-xs transition-colors",
                activeView === "archived"
                  ? "bg-[#c27890] text-white"
                  : "bg-white text-[#334155] hover:bg-[#f4f1ec]"
              )}
              onClick={() => handleViewChange("archived")}
            >
              Archived
            </button>
          </div>

          {hasActiveFilters && (
            <button
              className="text-xs text-[#94a3b8] hover:text-[#334155] border border-[#e0ddd8] rounded px-2 py-1"
              onClick={clearAllFilters}
            >
              Clear Filters
            </button>
          )}

          {/* Column toggle + reorder */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-xs text-[#94a3b8] hover:text-[#334155] border border-[#e0ddd8] rounded px-2 py-1 flex items-center gap-1">
                <Settings2 className="h-3 w-3" /> Columns
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="space-y-0.5">
                {columnPrefs.order.map((key, idx) => {
                  const col = COLUMN_MAP[key];
                  if (!col) return null;
                  return (
                    <div
                      key={col.key}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragEnter={() => handleDragEnter(idx)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      className="flex items-center gap-1.5 px-1 py-1 text-sm rounded hover:bg-[#f4f1ec] cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="h-3 w-3 text-[#94a3b8] shrink-0" />
                      <Checkbox
                        checked={columnPrefs.visible.includes(col.key)}
                        onCheckedChange={() => toggleColumn(col.key)}
                      />
                      <span className="text-[#334155] select-none">{col.label}</span>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            size="sm"
            className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs ml-auto"
            onClick={onAddClick}
          >
            + Add Variety
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-[#e0ddd8] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-[#e0ddd8] bg-[#faf8f5]">
                <th className="px-2 py-1.5 w-8">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                {activeColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-2 py-1.5 text-left text-[10px] font-semibold text-[#1e3a5f] whitespace-nowrap"
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      {col.filterable && distinctValues[col.key] && (
                        <ColumnFilter
                          values={distinctValues[col.key]}
                          selected={columnFilters[col.key] ?? []}
                          onChange={(selected) =>
                            setColumnFilters((prev) => ({
                              ...prev,
                              [col.key]: selected,
                            }))
                          }
                        />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeColumns.length + 1}
                    className="px-3 py-8 text-center text-[#94a3b8]"
                  >
                    No varieties found.
                    {hasActiveFilters && (
                      <button
                        className="ml-2 text-[#c27890] hover:underline"
                        onClick={clearAllFilters}
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((variety) => {
                  const isSelected = selectedIds.has(variety.id);
                  return (
                    <tr
                      key={variety.id}
                      className={cn(
                        "border-b border-[#f0ede8] hover:bg-[#faf8f5] cursor-pointer transition-colors",
                        isSelected && "bg-[#fce7f3] hover:bg-[#fce7f3]"
                      )}
                      onClick={() => onRowClick(variety)}
                    >
                      <td
                        className="px-2 py-1.5 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(variety.id);
                        }}
                      >
                        <Checkbox checked={isSelected} />
                      </td>
                      {activeColumns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-2 py-1.5 text-[#334155]",
                            col.key === "name" && "font-medium"
                          )}
                        >
                          {formatCellValue(col, variety)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-[#94a3b8] bg-[#faf8f5] border-t border-[#e0ddd8]">
          {someSelected
            ? `${selectedIds.size} of ${filtered.length} selected`
            : `${filtered.length} ${activeView} variet${filtered.length !== 1 ? "ies" : "y"}`}
        </div>
      </div>
    </div>
  );
}
