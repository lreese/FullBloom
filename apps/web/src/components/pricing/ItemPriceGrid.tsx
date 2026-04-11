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
import type { ColumnDef } from "@/hooks/useTableState";
import type { ItemPricingCustomer } from "@/types";

type FlatItem = ItemPricingCustomer & Record<string, unknown>;

interface ItemPriceGridProps {
  customers: FlatItem[];
  onSetOverride: (customerId: string, price: string) => Promise<void>;
  onRemoveOverride: (customerId: string) => Promise<void>;
}

const COLUMNS: ColumnDef[] = [
  { key: "customer_name", label: "Customer Name", filterable: true },
  { key: "price_list_name", label: "Price List", filterable: true },
  { key: "price_list_price", label: "List Price", filterable: false },
  { key: "customer_override", label: "Customer Price", filterable: false },
];

const SEARCHABLE_FIELDS = ["customer_name", "price_list_name"];

export function ItemPriceGrid({
  customers,
  onSetOverride,
  onRemoveOverride,
}: ItemPriceGridProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
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
      await onSetOverride(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
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
            className="w-20 h-6 px-1 text-xs text-center border-2 border-[#c27890] rounded outline-none bg-white"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
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
                    className="text-xs font-medium text-[#334155] hover:underline"
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
                    className="text-[#94a3b8] hover:text-red-500 transition-colors"
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
          className="text-xs italic text-[#94a3b8] hover:text-[#c27890] transition-colors"
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
    if (item.source === "override") return "bg-[#fce7f3]";
    return undefined;
  };

  return (
    <DataTable<FlatItem>
      columns={COLUMNS}
      data={customers}
      tableState={tableState}
      getRowKey={(item) => item.customer_id}
      renderCell={renderCell}
      cellClassName={cellClassName}
      emptyMessage="No customer pricing data found."
      footerText={`${tableState.filteredData.length} customer${tableState.filteredData.length !== 1 ? "s" : ""}`}
    />
  );
}
