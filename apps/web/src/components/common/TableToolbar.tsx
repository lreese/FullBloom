import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Settings2, GripVertical } from "lucide-react";
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
    reorderColumns,
  } = tableState;

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const columnMap = columns
    ? Object.fromEntries(columns.map((c) => [c.key, c]))
    : {};

  const handleViewChange = (view: "active" | "archived") => {
    clearAllFilters();
    onViewChange?.(view);
  };

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) {
      // Create a clone positioned off-screen so the browser renders a clean drag ghost
      const clone = e.currentTarget.cloneNode(true) as HTMLElement;
      clone.style.position = "fixed";
      clone.style.top = "-1000px";
      clone.style.left = "-1000px";
      clone.style.width = `${e.currentTarget.offsetWidth}px`;
      clone.style.backgroundColor = "#faf8f5";
      clone.style.borderRadius = "4px";
      clone.style.padding = "4px 6px";
      clone.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
      document.body.appendChild(clone);
      const rect = e.currentTarget.getBoundingClientRect();
      e.dataTransfer.setDragImage(clone, e.clientX - rect.left, e.clientY - rect.top);
      requestAnimationFrame(() => document.body.removeChild(clone));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertIdx = e.clientY < midY ? idx : idx + 1;
    setDropIdx(insertIdx);
  }, []);

  const handleDrop = useCallback(() => {
    if (dragIdx === null || dropIdx === null) return;
    reorderColumns(dragIdx, dropIdx);
    setDragIdx(null);
    setDropIdx(null);
  }, [dragIdx, dropIdx, reorderColumns]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDropIdx(null);
  }, []);

  const showColumnsPopover = columnPrefs && columns;

  return (
    <div className="flex flex-wrap items-center gap-2.5 mb-3">
      <h1 className="text-lg font-bold text-[#1e3a5f] whitespace-nowrap">
        {title}
      </h1>

      <div className="flex-1 min-w-[180px] max-w-[320px] relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
        <Input
          placeholder={searchPlaceholder}
          className="pl-8 h-8 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {activeView && onViewChange && (
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
      )}

      {hasActiveFilters && (
        <button
          className="text-xs text-[#94a3b8] hover:text-[#334155] border border-[#e0ddd8] rounded px-2 py-1"
          onClick={clearAllFilters}
        >
          Clear Filters
        </button>
      )}

      {showColumnsPopover && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-xs text-[#94a3b8] hover:text-[#334155] border border-[#e0ddd8] rounded px-2 py-1 flex items-center gap-1">
              <Settings2 className="h-3 w-3" /> Columns
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <div
              className="space-y-0.5"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {columnPrefs.order.map((key, idx) => {
                const col = columnMap[key];
                if (!col) return null;
                return (
                  <div key={col.key}>
                    {dropIdx === idx &&
                      dragIdx !== idx &&
                      dragIdx !== idx - 1 && (
                        <div className="h-0.5 bg-[#c27890] rounded-full mx-1 my-0.5" />
                      )}
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "flex items-center gap-1.5 px-1 py-1 text-sm rounded hover:bg-[#f4f1ec] cursor-grab active:cursor-grabbing",
                        dragIdx === idx && "opacity-50"
                      )}
                    >
                      <GripVertical className="h-3 w-3 text-[#94a3b8] shrink-0" />
                      <Checkbox
                        checked={columnPrefs.visible.includes(col.key)}
                        onCheckedChange={() => toggleColumn(col.key)}
                      />
                      <span className="text-[#334155] select-none">
                        {col.label}
                      </span>
                    </div>
                  </div>
                );
              })}
              {dropIdx === columnPrefs.order.length &&
                dragIdx !== columnPrefs.order.length - 1 && (
                  <div className="h-0.5 bg-[#c27890] rounded-full mx-1 my-0.5" />
                )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {addButtonLabel && onAddClick && (
        <Button
          size="sm"
          className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs ml-auto"
          onClick={onAddClick}
        >
          {addButtonLabel}
        </Button>
      )}
    </div>
  );
}
