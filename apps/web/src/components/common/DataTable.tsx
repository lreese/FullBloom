import { useState, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnFilter } from "@/components/common/ColumnFilter";
import { cn } from "@/lib/utils";
import type { ColumnDef, UseTableStateReturn } from "@/hooks/useTableState";

interface DataTableProps<T> {
  columns: ColumnDef[];
  data: T[];
  tableState: UseTableStateReturn<T>;
  onRowClick?: (item: T) => void;
  getRowKey: (item: T) => string;
  renderCell?: (col: ColumnDef, item: T) => React.ReactNode;
  cellClassName?: (col: ColumnDef, item: T) => string | undefined;
  emptyMessage?: string;
  footerText?: string;
  onReorderColumns?: (fromIdx: number, toIdx: number) => void;

  // Optional bulk selection
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

export function DataTable<T extends Record<string, unknown>>({
  tableState,
  onRowClick,
  getRowKey,
  renderCell,
  cellClassName,
  emptyMessage = "No items found.",
  footerText,
  onReorderColumns,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: DataTableProps<T>) {
  const {
    activeColumns,
    filteredData,
    columnFilters,
    setColumnFilter,
    distinctValues,
    sortConfig,
    handleSort,
    hasActiveFilters,
    clearAllFilters,
  } = tableState;

  const hasBulkSelect = selectedIds && onToggleSelect && onToggleSelectAll;
  const allSelected =
    hasBulkSelect &&
    filteredData.length > 0 &&
    selectedIds.size === filteredData.length;
  const colSpan = activeColumns.length + (hasBulkSelect ? 1 : 0);

  // Header drag-to-reorder state
  const [headerDragIdx, setHeaderDragIdx] = useState<number | null>(null);
  const [headerDropIdx, setHeaderDropIdx] = useState<number | null>(null);

  const handleHeaderDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setHeaderDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleHeaderDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const insertIdx = e.clientX < midX ? idx : idx + 1;
    setHeaderDropIdx(insertIdx);
  }, []);

  const handleHeaderDrop = useCallback(() => {
    if (headerDragIdx === null || headerDropIdx === null) return;
    if (headerDragIdx !== headerDropIdx && onReorderColumns) {
      onReorderColumns(headerDragIdx, headerDropIdx);
    }
    setHeaderDragIdx(null);
    setHeaderDropIdx(null);
  }, [headerDragIdx, headerDropIdx, onReorderColumns]);

  const handleHeaderDragEnd = useCallback(() => {
    setHeaderDragIdx(null);
    setHeaderDropIdx(null);
  }, []);

  return (
    <div className="rounded-lg border border-[#e0ddd8] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-2 border-[#e0ddd8] bg-[#faf8f5]">
              {hasBulkSelect && (
                <th className="px-2 py-1.5 w-8">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onToggleSelectAll}
                  />
                </th>
              )}
              {activeColumns.map((col, idx) => {
                const isSortable = col.sortable !== false;
                const isSorted = sortConfig?.key === col.key;
                return (
                  <th
                    key={col.key}
                    draggable={!!onReorderColumns}
                    onDragStart={(e) => handleHeaderDragStart(e, idx)}
                    onDragOver={(e) => handleHeaderDragOver(e, idx)}
                    onDrop={handleHeaderDrop}
                    onDragEnd={handleHeaderDragEnd}
                    className={cn(
                      "px-2 py-1.5 text-left text-[10px] font-semibold text-[#1e3a5f] whitespace-nowrap relative",
                      isSortable && "cursor-pointer select-none",
                      headerDragIdx === idx && "opacity-50"
                    )}
                    onClick={() => isSortable && handleSort(col.key)}
                  >
                    {/* Left drop indicator */}
                    {headerDropIdx === idx && headerDragIdx !== idx && headerDragIdx !== idx - 1 && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#c27890] z-10" />
                    )}

                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {isSorted && (
                        <span className="text-[#c27890]">
                          {sortConfig.direction === "asc" ? "\u25B2" : "\u25BC"}
                        </span>
                      )}
                      {col.filterable && distinctValues[col.key] && (
                        <ColumnFilter
                          values={distinctValues[col.key]}
                          selected={columnFilters[col.key] ?? []}
                          onChange={(selected) =>
                            setColumnFilter(col.key, selected)
                          }
                        />
                      )}
                    </span>

                    {/* Right drop indicator (only on last column) */}
                    {headerDropIdx === activeColumns.length && idx === activeColumns.length - 1 && headerDragIdx !== idx && (
                      <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-[#c27890] z-10" />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-3 py-8 text-center text-[#94a3b8]"
                >
                  {emptyMessage}
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
              filteredData.map((item) => {
                const rowKey = getRowKey(item);
                const isSelected = hasBulkSelect && selectedIds.has(rowKey);
                return (
                  <tr
                    key={rowKey}
                    className={cn(
                      "border-b border-[#f0ede8] hover:bg-[#faf8f5] cursor-pointer transition-colors",
                      isSelected && "bg-[#fce7f3] hover:bg-[#fce7f3]"
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    {hasBulkSelect && (
                      <td
                        className="px-2 py-1.5 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSelect(rowKey);
                        }}
                      >
                        <Checkbox checked={isSelected} />
                      </td>
                    )}
                    {activeColumns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-2 py-1.5 text-[#334155]",
                          cellClassName?.(col, item)
                        )}
                      >
                        {renderCell
                          ? renderCell(col, item)
                          : defaultRenderCell(col, item)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {footerText && (
        <div className="px-3 py-2 text-xs text-[#94a3b8] bg-[#faf8f5] border-t border-[#e0ddd8]">
          {footerText}
        </div>
      )}
    </div>
  );
}

function defaultRenderCell<T extends Record<string, unknown>>(
  col: ColumnDef,
  item: T
): React.ReactNode {
  const val = item[col.key];
  if (val == null) return "\u2014";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}
