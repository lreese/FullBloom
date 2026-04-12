import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import type { CustomerPricing } from "@/types";

interface ProductPickerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddProduct: (pricing: CustomerPricing) => void;
  customerPricing: CustomerPricing[];
}

export function ProductPickerPanel({
  open,
  onOpenChange,
  onAddProduct,
  customerPricing,
}: ProductPickerPanelProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const items = search
      ? customerPricing.filter((cp) =>
          cp.sales_item_name.toLowerCase().includes(search.toLowerCase())
        )
      : [...customerPricing];
    // Items with a price sort to the top, blanks/zeros to the bottom
    return items.sort((a, b) => {
      const aPrice = parseFloat(a.customer_price);
      const bPrice = parseFloat(b.customer_price);
      const aHasPrice = !isNaN(aPrice) && aPrice > 0;
      const bHasPrice = !isNaN(bPrice) && bPrice > 0;
      if (aHasPrice && !bHasPrice) return -1;
      if (!aHasPrice && bHasPrice) return 1;
      return a.sales_item_name.localeCompare(b.sales_item_name);
    });
  }, [customerPricing, search]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[260px] sm:max-w-[260px] p-0 flex flex-col">
        <SheetHeader className="p-3 pb-0">
          <SheetTitle className="text-sm">Sales Items</SheetTitle>
          <SheetDescription className="sr-only">
            Browse and add sales items to the order
          </SheetDescription>
        </SheetHeader>

        <div className="px-3 py-2">
          <Input
            placeholder="Search sales items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-1">
          {filtered.map((cp) => {
            const price = parseFloat(cp.customer_price);
            return (
              <button
                key={cp.sales_item_id}
                type="button"
                onClick={() => onAddProduct(cp)}
                className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs hover:bg-accent/50 rounded transition-colors"
              >
                <span className="flex-1 text-left truncate">
                  {cp.sales_item_name}
                </span>
                {!isNaN(price) && price > 0 && (
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    ${price.toFixed(2)}
                  </span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No sales items found.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
