import { useState, useRef } from "react";
import { DataTable } from "@/components/common/DataTable";
import { TableToolbar } from "@/components/common/TableToolbar";
import { useTableState } from "@/hooks/useTableState";
import { PriceAnomalyBadge } from "@/components/pricing/PriceAnomalyBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@/hooks/useTableState";
import type { CustomerPricingItem } from "@/types";

type FlatItem = CustomerPricingItem & Record<string, unknown>;

interface CustomerPriceGridProps {
  items: FlatItem[];
  priceListName: string;
  onSetOverride: (salesItemId: string, price: string) => Promise<void>;
  onRemoveOverride: (salesItemId: string) => Promise<void>;
  onBulkSetPrice: (salesItemIds: string[], price: string) => Promise<void>;
  onBulkRemoveOverrides: (salesItemIds: string[]) => Promise<void>;
}

const COLUMNS: ColumnDef[] = [
  { key: "sales_item_name", label: "Sales Item", filterable: true },
  { key: "variety_name", label: "Variety", filterable: true },
  { key: "stems_per_order", label: "Stems", filterable: false },
  { key: "price_list_price", label: "List Price", filterable: false },
  { key: "customer_override", label: "Customer Price", filterable: false },
];

const SEARCHABLE_FIELDS = ["sales_item_name", "variety_name"];

export function CustomerPriceGrid({
  items,
  priceListName,
  onSetOverride,
  onRemoveOverride,
  onBulkSetPrice,
  onBulkRemoveOverrides,
}: CustomerPriceGridProps) {
  const [onlyOverrides, setOnlyOverrides] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState(false);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkPriceError, setBulkPriceError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayedItems = onlyOverrides
    ? items.filter((i) => i.source === "override")
    : items;

  const tableState = useTableState<FlatItem>({
    data: displayedItems,
    columns: COLUMNS,
    searchableFields: SEARCHABLE_FIELDS,
    storageKey: "fullbloom:customer-price-columns",
  });

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const allIds = tableState.filteredData.map((i) => i.sales_item_id);
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const startEdit = (item: FlatItem) => {
    setEditingId(item.sales_item_id);
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

  const handleBulkSetPrice = async () => {
    if (!bulkPrice.trim() || selectedIds.size === 0) return;
    const numVal = parseFloat(bulkPrice.trim());
    if (isNaN(numVal) || numVal < 0) {
      setBulkPriceError(true);
      return;
    }
    await onBulkSetPrice(Array.from(selectedIds), bulkPrice.trim());
    setSelectedIds(new Set());
    setBulkPrice("");
    setBulkPriceError(false);
  };

  const handleBulkRemoveOverrides = async () => {
    if (selectedIds.size === 0) return;
    await onBulkRemoveOverrides(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const renderPriceTooltip = (item: FlatItem, children: React.ReactNode) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="text-xs">
          <div>Price List: {priceListName}</div>
          <div>List Price: ${Number(item.price_list_price).toFixed(2)}</div>
          <div>
            Override:{" "}
            {item.customer_override
              ? `$${Number(item.customer_override).toFixed(2)}`
              : "No override"}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const renderCell = (col: ColumnDef, item: FlatItem) => {
    if (col.key === "price_list_price") {
      const val = item.price_list_price;
      if (!val) return "\u2014";
      return renderPriceTooltip(
        item,
        <span className="cursor-default">
          ${Number(val).toFixed(2)}
        </span>
      );
    }

    if (col.key === "customer_override") {
      const isEditing = editingId === item.sales_item_id;
      const hasOverride = item.source === "override";

      if (isEditing) {
        return (
          <input
            ref={inputRef}
            type="text"
            className={cn(
              "w-20 h-6 px-1 text-xs text-center border-2 rounded outline-none bg-white",
              editError ? "border-red-500" : "border-[#c27890]"
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
        return renderPriceTooltip(
          item,
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
                onRemoveOverride(item.sales_item_id);
              }}
              title="Remove override"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      }

      return renderPriceTooltip(
        item,
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

    if (col.key === "stems_per_order") {
      return String(item.stems_per_order);
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
    <div>
      {/* Only Overrides toggle */}
      <div className="flex items-center gap-2 mb-2">
        <label className="flex items-center gap-1.5 text-xs text-[#334155] cursor-pointer">
          <Checkbox
            checked={onlyOverrides}
            onCheckedChange={(v) => setOnlyOverrides(v === true)}
          />
          Only Overrides
        </label>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-[#fce7f3] rounded-lg border border-[#e0ddd8]">
          <span className="text-xs text-[#334155] font-medium">
            {selectedIds.size} selected:
          </span>
          <Input
            type="text"
            value={bulkPrice}
            onChange={(e) => {
              setBulkPrice(e.target.value);
              setBulkPriceError(false);
            }}
            placeholder="$0.00"
            className={cn("h-7 w-20 text-xs", bulkPriceError && "border-red-500")}
          />
          <Button
            size="sm"
            className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs h-7"
            onClick={handleBulkSetPrice}
            disabled={!bulkPrice.trim()}
          >
            Set Price
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={handleBulkRemoveOverrides}
          >
            Remove Overrides
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <DataTable<FlatItem>
        columns={COLUMNS}
        data={displayedItems}
        tableState={tableState}
        getRowKey={(item) => item.sales_item_id}
        renderCell={renderCell}
        cellClassName={cellClassName}
        emptyMessage="No pricing data found."
        footerText={`${tableState.filteredData.length} item${tableState.filteredData.length !== 1 ? "s" : ""}`}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
      />
    </div>
  );
}
