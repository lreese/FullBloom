import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductLine {
  id: string;
  name: string;
}

type StatusFilter = "all" | "blank" | "filled";

interface SearchFilterBarProps {
  onSearchChange: (term: string) => void;
  onProductLineFilter: (lineId: string | null) => void;
  onStatusFilter: (status: StatusFilter) => void;
  productLines: ProductLine[];
}

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "blank", label: "Blank only" },
  { value: "filled", label: "Filled only" },
];

export function SearchFilterBar({
  onSearchChange,
  onProductLineFilter,
  onStatusFilter,
  productLines,
}: SearchFilterBarProps) {
  const [search, setSearch] = useState("");
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");

  const handleSearchChange = (value: string) => {
    setSearch(value);
    onSearchChange(value);
  };

  const handleLineClick = (lineId: string) => {
    const next = activeLineId === lineId ? null : lineId;
    setActiveLineId(next);
    onProductLineFilter(next);
  };

  const handleStatusClick = (status: StatusFilter) => {
    setActiveStatus(status);
    onStatusFilter(status);
  };

  return (
    <div className="space-y-3">
      {/* Search input — full width */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          placeholder="Search varieties..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 pr-9 bg-white border-border-warm text-text-body placeholder:text-text-muted focus-visible:ring-rose-action"
        />
        {search && (
          <button
            onClick={() => handleSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-body transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter chips row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Product line chips */}
        {productLines.map((line) => (
          <button
            key={line.id}
            onClick={() => handleLineClick(line.id)}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
              activeLineId === line.id
                ? "bg-sidebar-hover text-white"
                : "bg-white text-text-body border border-border-warm hover:bg-cream"
            )}
          >
            {line.name}
          </button>
        ))}

        {/* Separator if both chips exist */}
        {productLines.length > 0 && (
          <div className="w-px h-5 bg-border-warm mx-1" />
        )}

        {/* Status filter chips */}
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleStatusClick(opt.value)}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
              activeStatus === opt.value
                ? "bg-slate-heading text-white"
                : "bg-white text-text-body border border-border-warm hover:bg-cream"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
