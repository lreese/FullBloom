import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomerColumnFilter } from "./CustomerColumnFilter";
import { Search, Settings2 } from "lucide-react";
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
  { key: "salesperson", label: "Sales (Initials)", filterable: true, defaultVisible: true },
  { key: "default_ship_via", label: "Ship Via", filterable: true, defaultVisible: true },
  { key: "location", label: "Location", filterable: true, defaultVisible: true },
  { key: "payment_terms", label: "Terms", filterable: true, defaultVisible: true },
  { key: "price_type", label: "Price Type", filterable: true, defaultVisible: false },
  { key: "contact_name", label: "Contact", filterable: false, defaultVisible: false },
  { key: "phone", label: "Phone", filterable: false, defaultVisible: false },
  { key: "email", label: "Email", filterable: false, defaultVisible: false },
  { key: "notes", label: "Notes", filterable: false, defaultVisible: false },
];

const STORAGE_KEY = "fullbloom:customer-columns";

function loadColumnPrefs(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
}

function saveColumnPrefs(cols: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
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
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    loadColumnPrefs
  );

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
    setVisibleColumns((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      saveColumnPrefs(next);
      return next;
    });
  };

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

  const activeColumns = ALL_COLUMNS.filter((c) =>
    visibleColumns.includes(c.key)
  );

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

        {/* Column toggle */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-xs text-[#94a3b8] hover:text-[#334155] border border-[#e0ddd8] rounded px-2 py-1 flex items-center gap-1">
              <Settings2 className="h-3 w-3" /> Columns
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            <div className="space-y-1">
              {ALL_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 px-1 py-0.5 text-sm rounded hover:bg-[#f4f1ec] cursor-pointer"
                >
                  <Checkbox
                    checked={visibleColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  <span className="text-[#334155]">{col.label}</span>
                </label>
              ))}
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#e0ddd8] bg-[#faf8f5]">
                {activeColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-left text-xs font-semibold text-[#1e3a5f] whitespace-nowrap"
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
                          "px-3 py-2 text-[#334155]",
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
