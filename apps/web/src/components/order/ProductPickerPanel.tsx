import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { SalesItem, Variety, ProductListResponse, CustomerPricing } from "@/types";

interface ProductPickerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddProduct: (salesItem: SalesItem, variety: Variety) => void;
  customerPricing: CustomerPricing[];
}

interface GroupedProduct {
  variety: Variety;
  salesItem: SalesItem;
}

export function ProductPickerPanel({
  open,
  onOpenChange,
  onAddProduct,
  customerPricing,
}: ProductPickerPanelProps) {
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    api
      .get<ProductListResponse>("/api/v1/products")
      .then((res) => setVarieties(res.varieties))
      .catch(() => setVarieties([]));
  }, [open]);

  const getPrice = useCallback(
    (salesItemId: number): number | null => {
      const cp = customerPricing.find((p) => p.sales_item_id === salesItemId);
      return cp ? cp.price : null;
    },
    [customerPricing]
  );

  // Flatten and group by variety name (acting as product type)
  const grouped = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const groups = new Map<string, GroupedProduct[]>();

    for (const variety of varieties) {
      for (const si of variety.sales_items) {
        const matchName = si.name.toLowerCase().includes(lowerSearch);
        const matchVariety = variety.name.toLowerCase().includes(lowerSearch);
        if (search && !matchName && !matchVariety) continue;

        const groupKey = variety.name;
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey)!.push({ variety, salesItem: si });
      }
    }

    return groups;
  }, [varieties, search]);

  function toggleGroup(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[220px] sm:max-w-[220px] p-0 flex flex-col">
        <SheetHeader className="p-3 pb-0">
          <SheetTitle className="text-sm">Products</SheetTitle>
          <SheetDescription className="sr-only">
            Browse and add products to the order
          </SheetDescription>
        </SheetHeader>

        <div className="px-3 py-2">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-1">
          {Array.from(grouped.entries()).map(([groupName, items]) => {
            const isCollapsed = collapsed[groupName] ?? false;
            return (
              <div key={groupName} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(groupName)}
                  className="flex items-center gap-1 w-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRightIcon className="size-3" />
                  ) : (
                    <ChevronDownIcon className="size-3" />
                  )}
                  {groupName}
                </button>
                {!isCollapsed &&
                  items.map(({ variety, salesItem }) => {
                    const price = getPrice(salesItem.id);
                    return (
                      <button
                        key={`${variety.id}-${salesItem.id}`}
                        type="button"
                        onClick={() => onAddProduct(salesItem, variety)}
                        className="flex items-center gap-1.5 w-full px-3 py-1 text-xs hover:bg-accent/50 rounded transition-colors"
                      >
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: variety.hex_color }}
                        />
                        <span className="flex-1 text-left truncate">
                          {salesItem.name}
                        </span>
                        {price != null && (
                          <span className="text-muted-foreground tabular-nums">
                            ${price.toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            );
          })}
          {grouped.size === 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No products found.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
