import { useMemo, useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomerColumnFilter } from "./CustomerColumnFilter";
import { Search, Settings2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types";

interface ColumnDef {
  key: string;
  label: string;
  filterable: boolean;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "customer_number", label: "#", filterable: false, defaultVisible: true },
  { key: "name", label: "Name", filterable: true, defaultVisible: true },
  { key: "default_ship_via", label: "Ship Via", filterable: true, defaultVisible: true },
  { key: "location", label: "Location", filterable: true, defaultVisible: true },
  { key: "payment_terms", label: "Terms", filterable: true, defaultVisible: true },
  { key: "price_type", label: "Price Type", filterable: true, defaultVisible: true },
  { key: "contact_name", label: "Contact", filterable: false, defaultVisible: true },
  { key: "salesperson", label: "Sales", filterable: true, defaultVisible: true },
  { key: "phone", label: "Phone", filterable: false, defaultVisible: false },
  { key: "email", label: "Email", filterable: false, defaultVisible: false },
  { key: "notes", label: "Notes", filterable: false, defaultVisible: false },
];

const COLUMN_MAP = Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c]));
const DEFAULT_ORDER = ALL_COLUMNS.map((c) => c.key);
const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));

const STORAGE_KEY = "fullbloom:customer-columns";

interface ColumnPrefs {
  order: string[];
  visible: string[];
}

function loadColumnPrefs(): ColumnPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Handle legacy format (plain string array = visible only)
      if (Array.isArray(parsed)) {
        return { order: DEFAULT_ORDER, visible: parsed };
      }
      // Ensure all columns are represented in order (handles new columns added later)
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

const SEARCHABLE_FIELDS = [
  "name",
  "contact_name",
  "location",
  "email",
  "phone",
  "notes",
] as const;

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
  const [searchTerm, setSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(
    {}
  );
  const [columnPrefs, setColumnPrefs] = useState<ColumnPrefs>(loadColumnPrefs);
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
      for (const c of customers) {
        const val = c[col.key as keyof Customer];
        if (val != null && val !== "") values.add(String(val));
      }
      result[col.key] = Array.from(values).sort();
    }
    return result;
  }, [customers]);

  // Apply search + column filters
  const filtered = useMemo(() => {
    let result = customers;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((c) =>
        SEARCHABLE_FIELDS.some((field) => {
          const val = c[field as keyof Customer];
          return val != null && String(val).toLowerCase().includes(term);
        })
      );
    }

    for (const [key, selected] of Object.entries(columnFilters)) {
      if (selected.length === 0) continue;
      result = result.filter((c) => {
        const val = c[key as keyof Customer];
        return val != null && selected.includes(String(val));
      });
    }

    return result;
  }, [customers, searchTerm, columnFilters]);

  // Active columns: visible ones in the user's order
  const activeColumns = columnPrefs.order
    .filter((key) => columnPrefs.visible.includes(key))
    .map((key) => COLUMN_MAP[key])
    .filter(Boolean);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <h1 className="text-lg font-bold text-[#1e3a5f] whitespace-nowrap">
          Customers
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
          <PopoverContent className="w-52 p-2" align="end">
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
          + Add Customer
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#e0ddd8] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-[#e0ddd8] bg-[#faf8f5]">
                {activeColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-2 py-1.5 text-left text-[10px] font-semibold text-[#1e3a5f] whitespace-nowrap"
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      {col.filterable && distinctValues[col.key] && (
                        <CustomerColumnFilter
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
                    colSpan={activeColumns.length}
                    className="px-3 py-8 text-center text-[#94a3b8]"
                  >
                    No customers found.
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
                filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-[#f0ede8] hover:bg-[#faf8f5] cursor-pointer transition-colors"
                    onClick={() => onRowClick(customer)}
                  >
                    {activeColumns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-2 py-1.5 text-[#334155]",
                          col.key === "name" && "font-medium",
                          col.key === "notes" && "max-w-[200px] truncate"
                        )}
                      >
                        {(customer[col.key as keyof Customer] as string) ??
                          "\u2014"}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-[#94a3b8] bg-[#faf8f5] border-t border-[#e0ddd8]">
          {filtered.length} {activeView} customer{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
