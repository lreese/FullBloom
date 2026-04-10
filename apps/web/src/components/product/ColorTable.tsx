import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Color } from "@/types";

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
  const [searchTerm, setSearchTerm] = useState("");

  const hasActiveFilters = searchTerm.length > 0;

  const clearAllFilters = () => {
    setSearchTerm("");
  };

  const handleViewChange = (view: "active" | "archived") => {
    clearAllFilters();
    onViewChange(view);
  };

  const sorted = useMemo(() => {
    return [...colors].sort((a, b) => a.name.localeCompare(b.name));
  }, [colors]);

  const filtered = useMemo(() => {
    if (!searchTerm) return sorted;
    const term = searchTerm.toLowerCase();
    return sorted.filter((c) => c.name.toLowerCase().includes(term));
  }, [sorted, searchTerm]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <h1 className="text-lg font-bold text-[#1e3a5f] whitespace-nowrap">
          Colors
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
          + Add Color
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#e0ddd8] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-[#e0ddd8] bg-[#faf8f5]">
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-[#1e3a5f] w-10">Swatch</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-[#1e3a5f]">Name</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-8 text-center text-[#94a3b8]">
                    No colors found.
                    {hasActiveFilters && (
                      <button className="ml-2 text-[#c27890] hover:underline" onClick={clearAllFilters}>
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((color) => (
                  <tr
                    key={color.id}
                    className="border-b border-[#f0ede8] hover:bg-[#faf8f5] cursor-pointer transition-colors"
                    onClick={() => onRowClick(color)}
                  >
                    <td className="px-2 py-1.5">
                      {color.hex_color ? (
                        <div
                          className="h-5 w-5 rounded-full border border-[#e0ddd8]"
                          style={{ backgroundColor: color.hex_color }}
                        />
                      ) : (
                        <div className="h-5 w-5 rounded-full border border-[#e0ddd8] bg-[#f4f1ec]" />
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-[#334155] font-medium">{color.name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-[#94a3b8] bg-[#faf8f5] border-t border-[#e0ddd8]">
          {filtered.length} color{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
