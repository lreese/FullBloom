import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnDef, UseTableStateReturn } from "@/hooks/useTableState";

interface TableToolbarProps {
  title: string;
  tableState: UseTableStateReturn<any>;
  activeView?: "active" | "archived";
  onViewChange?: (view: "active" | "archived") => void;
  addButtonLabel?: string;
  onAddClick?: () => void;
  columns?: ColumnDef[];
  searchPlaceholder?: string;
}

export function TableToolbar({
  title,
  tableState,
  activeView,
  onViewChange,
  addButtonLabel,
  onAddClick,
  columns,
  searchPlaceholder = "Search...",
}: TableToolbarProps) {
  const {
    searchTerm,
    setSearchTerm,
    hasActiveFilters,
    clearAllFilters,
    columnPrefs,
    toggleColumn,
  } = tableState;

  const handleViewChange = (view: "active" | "archived") => {
    clearAllFilters();
    onViewChange?.(view);
  };

  const showColumnsPopover = columnPrefs && columns;

  return (
    <div className="flex flex-wrap items-center gap-2.5 mb-3">
      <h1 className="text-lg font-bold text-slate-heading whitespace-nowrap">
        {title}
      </h1>

      <div className="flex-1 min-w-[180px] max-w-[320px] relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          placeholder={searchPlaceholder}
          className="pl-8 h-8 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {activeView && onViewChange && (
        <div className="flex gap-px bg-border-warm rounded-md overflow-hidden">
          <button
            className={cn(
              "px-3 py-1 text-xs transition-colors",
              activeView === "active"
                ? "bg-rose-action text-white"
                : "bg-white text-text-body hover:bg-cream"
            )}
            onClick={() => handleViewChange("active")}
          >
            Active
          </button>
          <button
            className={cn(
              "px-3 py-1 text-xs transition-colors",
              activeView === "archived"
                ? "bg-rose-action text-white"
                : "bg-white text-text-body hover:bg-cream"
            )}
            onClick={() => handleViewChange("archived")}
          >
            Archived
          </button>
        </div>
      )}

      {hasActiveFilters && (
        <button
          className="text-xs text-text-muted hover:text-text-body border border-border-warm rounded px-2 py-1"
          onClick={clearAllFilters}
        >
          Clear Filters
        </button>
      )}

      {showColumnsPopover && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-xs text-text-muted hover:text-text-body border border-border-warm rounded px-2 py-1 flex items-center gap-1">
              <Settings2 className="h-3 w-3" /> Columns
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <div className="space-y-0.5">
              {columns.map((col) => (
                <label key={col.key} className="flex items-center gap-2 px-1 py-0.5 text-sm rounded hover:bg-cream cursor-pointer">
                  <Checkbox
                    checked={columnPrefs?.visible.includes(col.key) ?? true}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  <span className="text-text-body select-none">{col.label || col.key}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {addButtonLabel && onAddClick && (
        <Button
          size="sm"
          className="bg-rose-action hover:bg-rose-action/90 text-white text-xs ml-auto"
          onClick={onAddClick}
        >
          {addButtonLabel}
        </Button>
      )}
    </div>
  );
}
