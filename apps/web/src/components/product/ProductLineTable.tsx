import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ColumnFilter } from "@/components/common/ColumnFilter";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductLine } from "@/types";

interface ColumnDef {
  key: string;
  label: string;
  filterable: boolean;
  sortable: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", filterable: true, sortable: true },
  { key: "product_type_name", label: "Product Type", filterable: true, sortable: true },
  { key: "variety_count", label: "Varieties", filterable: true, sortable: true },
  { key: "is_active", label: "Active", filterable: true, sortable: true },
];

const SEARCHABLE_FIELDS = ["name", "product_type_name"] as const;

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
  const [searchTerm, setSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

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

  const distinctValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const col of COLUMNS) {
      if (!col.filterable) continue;
      const values = new Set<string>();
      for (const pl of productLines) {
        const val = pl[col.key as keyof ProductLine];
        if (val != null && val !== "") values.add(String(val));
      }
      result[col.key] = Array.from(values).sort();
    }
    return result;
  }, [productLines]);

  const filtered = useMemo(() => {
    let result = productLines;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((pl) =>
        SEARCHABLE_FIELDS.some((field) => {
          const val = pl[field as keyof ProductLine];
          return val != null && String(val).toLowerCase().includes(term);
        })
      );
    }

    for (const [key, selected] of Object.entries(columnFilters)) {
      if (selected.length === 0) continue;
      result = result.filter((pl) => {
        const val = pl[key as keyof ProductLine];
        return val != null && selected.includes(String(val));
      });
    }

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key as keyof ProductLine];
        const bVal = b[sortConfig.key as keyof ProductLine];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === "boolean") return sortConfig.direction === "asc" ? (aVal ? 1 : -1) - ((bVal as boolean) ? 1 : -1) : ((bVal as boolean) ? 1 : -1) - (aVal ? 1 : -1);
        if (typeof aVal === "number") return sortConfig.direction === "asc" ? aVal - (bVal as number) : (bVal as number) - aVal;
        return sortConfig.direction === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      });
    }

    return result;
  }, [productLines, searchTerm, columnFilters, sortConfig]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <h1 className="text-lg font-bold text-[#1e3a5f] whitespace-nowrap">
          Product Lines
        </h1>

        <div className="flex-1 min-w-[180px] max-w-[320px] relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
          <Input
            placeholder="Search..."
            className="pl-8 h-8 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

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

        <Button
          size="sm"
          className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs ml-auto"
          onClick={onAddClick}
        >
          + Add Product Line
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#e0ddd8] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-[#e0ddd8] bg-[#faf8f5]">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-2 py-1.5 text-left text-[10px] font-semibold text-[#1e3a5f] whitespace-nowrap cursor-pointer select-none"
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortConfig?.key === col.key && (
                        <span className="text-[#c27890]">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                      )}
                      {col.filterable && distinctValues[col.key] && (
                        <ColumnFilter
                          values={distinctValues[col.key]}
                          selected={columnFilters[col.key] ?? []}
                          onChange={(selected) =>
                            setColumnFilters((prev) => ({ ...prev, [col.key]: selected }))
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
                  <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-[#94a3b8]">
                    No product lines found.
                    {hasActiveFilters && (
                      <button className="ml-2 text-[#c27890] hover:underline" onClick={clearAllFilters}>
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((pl) => (
                  <tr
                    key={pl.id}
                    className="border-b border-[#f0ede8] hover:bg-[#faf8f5] cursor-pointer transition-colors"
                    onClick={() => onRowClick(pl)}
                  >
                    <td className="px-2 py-1.5 text-[#334155] font-medium">{pl.name}</td>
                    <td className="px-2 py-1.5 text-[#334155]">{pl.product_type_name}</td>
                    <td className="px-2 py-1.5 text-[#334155]">{pl.variety_count}</td>
                    <td className="px-2 py-1.5 text-[#334155]">{pl.is_active ? "Yes" : "No"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-[#94a3b8] bg-[#faf8f5] border-t border-[#e0ddd8]">
          {filtered.length} {activeView} product line{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
