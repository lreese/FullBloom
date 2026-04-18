import { useState, useRef } from "react";
import { DataTable } from "@/components/common/DataTable";
import { useTableState } from "@/hooks/useTableState";
import { PriceAnomalyBadge } from "@/components/pricing/PriceAnomalyBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@/hooks/useTableState";
import type { ItemPricingCustomer } from "@/types";

type FlatItem = ItemPricingCustomer & Record<string, unknown>;

interface ItemPriceGridProps {
  customers: FlatItem[];
  onSetOverride: (customerId: string, price: string) => Promise<void>;
  onRemoveOverride: (customerId: string) => Promise<void>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onBulkSetPrice: (customerIds: string[], price: string) => Promise<void>;
  onBulkRemoveOverrides: (customerIds: string[]) => Promise<void>;
}

const COLUMNS: ColumnDef[] = [
  { key: "customer_name", label: "Customer Name", filterable: true },
  { key: "price_list_name", label: "Price List", filterable: true },
  { key: "price_list_price", label: "List Price", filterable: true },
  { key: "customer_override", label: "Customer Price", filterable: true },
];

const SEARCHABLE_FIELDS = ["customer_name", "price_list_name"];

export function ItemPriceGrid({
  customers,
  onSetOverride,
  onRemoveOverride,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onBulkSetPrice,
  onBulkRemoveOverrides,
}: ItemPriceGridProps) {
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkError, setBulkError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tableState = useTableState<FlatItem>({
    data: customers,
    columns: COLUMNS,
    searchableFields: SEARCHABLE_FIELDS,
  });

  const startEdit = (item: FlatItem) => {
    setEditingId(item.customer_id);
    setEditValue(item.customer_override ?? "");
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (editValue.trim()) {
      const numVal = parseFloat(editValue.trim());
      if (isNaN(numVal) || numVal < 0) {
        setEditError(true);
        return;
      }
      await onSetOverride(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
    setEditError(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
    setEditError(false);
  };

  const renderCell = (col: ColumnDef, item: FlatItem) => {
    if (col.key === "price_list_price") {
      const val = item.price_list_price;
      return val ? `$${Number(val).toFixed(2)}` : "\u2014";
    }

    if (col.key === "customer_override") {
      const isEditing = editingId === item.customer_id;
      const hasOverride = item.source === "override";

      if (isEditing) {
        return (
          <input
            ref={inputRef}
            type="text"
            className={cn(
              "w-20 h-6 px-1 text-xs text-center border-2 rounded outline-none bg-white",
              editError ? "border-red-500" : "border-rose-action"
            )}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setEditError(false);
            }}
            onBlur={handleSaveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveEdit();
              if (e.key === "Escape") handleCancelEdit();
            }}
            autoFocus
          />
        );
      }

      if (hasOverride) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1">
                  <button
                    className="text-xs font-medium text-text-body hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(item);
                    }}
                  >
                    ${Number(item.customer_override).toFixed(2)}
                  </button>
                  <PriceAnomalyBadge
                    listPrice={item.price_list_price}
                    overridePrice={item.customer_override!}
                  />
                  <button
                    className="text-text-muted hover:text-red-500 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveOverride(item.customer_id);
                    }}
                    title="Remove override"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <div>Price List: {item.price_list_name}</div>
                <div>
                  List Price: ${Number(item.price_list_price).toFixed(2)}
                </div>
                <div>
                  Override: ${Number(item.customer_override).toFixed(2)}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      return (
        <button
          className="text-xs italic text-text-muted hover:text-rose-action transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            startEdit(item);
          }}
        >
          click to set
        </button>
      );
    }

    const val = item[col.key];
    if (val == null) return "\u2014";
    return String(val);
  };

  const cellClassName = (col: ColumnDef, item: FlatItem) => {
    if (item.source === "override") return "bg-box-pink-bg";
    return undefined;
  };

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-box-pink-bg rounded-lg text-xs">
          <span className="font-semibold text-slate-heading">{selectedIds.size} selected:</span>
          <input
            type="text"
            placeholder="Price"
            className={cn(
              "w-20 h-6 px-2 text-xs border rounded",
              bulkError ? "border-red-500" : "border-border-warm"
            )}
            value={bulkPrice}
            onChange={(e) => { setBulkPrice(e.target.value); setBulkError(false); }}
          />
          <button
            className="px-2 py-0.5 bg-rose-action text-white rounded text-xs"
            onClick={async () => {
              const num = parseFloat(bulkPrice);
              if (isNaN(num) || num < 0) { setBulkError(true); return; }
              await onBulkSetPrice(Array.from(selectedIds), bulkPrice);
              setBulkPrice("");
            }}
          >
            Set Price
          </button>
          <button
            className="px-2 py-0.5 border border-border-warm rounded text-xs text-text-body"
            onClick={() => onBulkRemoveOverrides(Array.from(selectedIds))}
          >
            Remove Overrides
          </button>
          <button
            className="ml-auto text-xs text-text-muted"
            onClick={() => { onToggleSelectAll(); }}
          >
            Clear Selection
          </button>
        </div>
      )}
      <DataTable<FlatItem>
        columns={COLUMNS}
        data={customers}
        tableState={tableState}
        getRowKey={(item) => item.customer_id}
        renderCell={renderCell}
        cellClassName={cellClassName}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={onToggleSelectAll}
        emptyMessage="No customer pricing data found."
        footerText={`${tableState.filteredData.length} customer${tableState.filteredData.length !== 1 ? "s" : ""}`}
      />
    </div>
  );
}
