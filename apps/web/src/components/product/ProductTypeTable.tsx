import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/types";

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
  const [searchTerm, setSearchTerm] = useState("");

  const handleViewChange = (view: "active" | "archived") => {
    setSearchTerm("");
    onViewChange(view);
  };

  const filtered = useMemo(() => {
    if (!searchTerm) return productTypes;
    const term = searchTerm.toLowerCase();
    return productTypes.filter((pt) =>
      pt.name.toLowerCase().includes(term)
    );
  }, [productTypes, searchTerm]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <h1 className="text-lg font-bold text-[#1e3a5f] whitespace-nowrap">
          Product Types
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

        {searchTerm.length > 0 && (
          <button
            className="text-xs text-[#94a3b8] hover:text-[#334155] border border-[#e0ddd8] rounded px-2 py-1"
            onClick={() => setSearchTerm("")}
          >
            Clear Filters
          </button>
        )}

        <Button
          size="sm"
          className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs ml-auto"
          onClick={onAddClick}
        >
          + Add Product Type
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#e0ddd8] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-[#e0ddd8] bg-[#faf8f5]">
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-[#1e3a5f] whitespace-nowrap">
                  Name
                </th>
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-[#1e3a5f] whitespace-nowrap">
                  Product Lines
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-8 text-center text-[#94a3b8]">
                    No product types found.
                    {searchTerm.length > 0 && (
                      <button
                        className="ml-2 text-[#c27890] hover:underline"
                        onClick={() => setSearchTerm("")}
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((pt) => (
                  <tr
                    key={pt.id}
                    className="border-b border-[#f0ede8] hover:bg-[#faf8f5] cursor-pointer transition-colors"
                    onClick={() => onRowClick(pt)}
                  >
                    <td className="px-2 py-1.5 text-[#334155] font-medium">{pt.name}</td>
                    <td className="px-2 py-1.5 text-[#334155]">{pt.product_line_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-[#94a3b8] bg-[#faf8f5] border-t border-[#e0ddd8]">
          {filtered.length} {activeView} product type{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
