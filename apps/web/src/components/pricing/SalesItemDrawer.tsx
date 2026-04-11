import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SalesItem, PriceList, Variety } from "@/types";

interface SalesItemDrawerProps {
  open: boolean;
  onClose: () => void;
  mode: "edit" | "add";
  salesItem: SalesItem | null;
  varieties: Variety[];
  priceLists: PriceList[];
  priceListPrices: Record<string, string>;
  customerPricesCount: number;
  onSave: (data: {
    name: string;
    variety_id?: string;
    stems_per_order: number;
    retail_price: string;
    price_list_prices?: Record<string, string>;
    selected_price_lists?: string[];
  }) => Promise<void>;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
}

export function SalesItemDrawer({
  open,
  onClose,
  mode,
  salesItem,
  varieties,
  priceLists,
  priceListPrices,
  customerPricesCount,
  onSave,
  onArchive,
  onRestore,
}: SalesItemDrawerProps) {
  const [form, setForm] = useState({
    name: "",
    variety_id: "",
    stems_per_order: 10,
    retail_price: "",
  });
  const [plPrices, setPlPrices] = useState<Record<string, string>>({});
  const [selectedPriceLists, setSelectedPriceLists] = useState<Set<string>>(
    new Set()
  );
  const [samePrice, setSamePrice] = useState(true);
  const [samePriceValue, setSamePriceValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === "edit" && salesItem) {
      setForm({
        name: salesItem.name,
        variety_id: salesItem.variety_id ?? "",
        stems_per_order: salesItem.stems_per_order,
        retail_price: salesItem.retail_price,
      });
      setPlPrices(priceListPrices);
    } else {
      setForm({ name: "", variety_id: "", stems_per_order: 10, retail_price: "" });
      setPlPrices({});
      setSelectedPriceLists(new Set(priceLists.map((pl) => pl.id)));
      setSamePrice(true);
      setSamePriceValue("");
    }
  }, [mode, salesItem, priceListPrices, priceLists]);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.retail_price.trim()) return;
    setSaving(true);
    try {
      if (mode === "add") {
        const prices: Record<string, string> = {};
        if (samePrice) {
          for (const id of selectedPriceLists) {
            prices[id] = samePriceValue || form.retail_price;
          }
        } else {
          for (const id of selectedPriceLists) {
            prices[id] = plPrices[id] || form.retail_price;
          }
        }
        await onSave({
          ...form,
          variety_id: form.variety_id || undefined,
          price_list_prices: prices,
          selected_price_lists: Array.from(selectedPriceLists),
        });
      } else {
        await onSave({
          ...form,
          variety_id: form.variety_id || undefined,
          price_list_prices: plPrices,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const togglePriceList = (id: string) => {
    setSelectedPriceLists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isArchived = salesItem && !salesItem.is_active;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[#1e3a5f]">
            {mode === "add" ? "Add Sales Item" : salesItem?.name ?? "Sales Item"}
          </SheetTitle>
          <SheetDescription>
            {mode === "add"
              ? "Create a new purchasable sales item."
              : "Edit sales item details and pricing."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Identity section */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1e3a5f]">
                Name *
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1e3a5f]">
                Variety
              </Label>
              <Select
                value={form.variety_id}
                onValueChange={(v) => setForm({ ...form, variety_id: v })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select variety..." />
                </SelectTrigger>
                <SelectContent>
                  {varieties.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1e3a5f]">
                Stems per Order *
              </Label>
              <Input
                type="number"
                value={form.stems_per_order}
                onChange={(e) =>
                  setForm({
                    ...form,
                    stems_per_order: parseInt(e.target.value) || 0,
                  })
                }
                className="h-8 text-sm"
                min={1}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1e3a5f]">
                Retail Price *
              </Label>
              <Input
                value={form.retail_price}
                onChange={(e) =>
                  setForm({ ...form, retail_price: e.target.value })
                }
                className="h-8 text-sm"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Price Lists section */}
          <div>
            <h3 className="text-sm font-semibold text-[#1e3a5f] mb-2">
              Price Lists
            </h3>

            {mode === "add" && (
              <div className="mb-3">
                <div className="flex items-center gap-3 mb-2">
                  <label className="flex items-center gap-1.5 text-xs text-[#334155] cursor-pointer">
                    <input
                      type="radio"
                      name="priceMode"
                      checked={samePrice}
                      onChange={() => setSamePrice(true)}
                      className="accent-[#c27890]"
                    />
                    Same price for all
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-[#334155] cursor-pointer">
                    <input
                      type="radio"
                      name="priceMode"
                      checked={!samePrice}
                      onChange={() => setSamePrice(false)}
                      className="accent-[#c27890]"
                    />
                    Edit individually
                  </label>
                </div>
                {samePrice && (
                  <Input
                    value={samePriceValue}
                    onChange={(e) => setSamePriceValue(e.target.value)}
                    placeholder="Price for all selected lists..."
                    className="h-8 text-sm max-w-[200px]"
                  />
                )}
              </div>
            )}

            <div className="space-y-1.5">
              {priceLists.map((pl) => {
                const isSelected = selectedPriceLists.has(pl.id);
                return (
                  <div
                    key={pl.id}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#f4f1ec]"
                  >
                    {mode === "add" && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => togglePriceList(pl.id)}
                      />
                    )}
                    <span className="text-sm text-[#334155] flex-1">
                      {pl.name}
                    </span>
                    {mode === "edit" ? (
                      <Input
                        value={plPrices[pl.id] ?? ""}
                        onChange={(e) =>
                          setPlPrices({ ...plPrices, [pl.id]: e.target.value })
                        }
                        className="h-7 w-24 text-xs text-right"
                        placeholder="0.00"
                      />
                    ) : (
                      !samePrice &&
                      isSelected && (
                        <Input
                          value={plPrices[pl.id] ?? ""}
                          onChange={(e) =>
                            setPlPrices({
                              ...plPrices,
                              [pl.id]: e.target.value,
                            })
                          }
                          className="h-7 w-24 text-xs text-right"
                          placeholder="0.00"
                        />
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer prices info */}
          {mode === "edit" && customerPricesCount > 0 && (
            <div className="text-xs text-[#94a3b8]">
              {customerPricesCount} customer price
              {customerPricesCount !== 1 ? "s" : ""} reference this item.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center mt-6 pt-4 border-t border-[#e0ddd8]">
          {mode === "edit" && salesItem && (
            <div>
              {isArchived ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => onRestore?.(salesItem.id)}
                >
                  Restore
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-red-600 hover:text-red-700"
                  onClick={() => onArchive?.(salesItem.id)}
                >
                  Archive
                </Button>
              )}
            </div>
          )}
          <div className="flex-1" />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs"
              onClick={handleSubmit}
              disabled={!form.name.trim() || !form.retail_price.trim() || saving}
            >
              {saving
                ? "Saving..."
                : mode === "add"
                  ? "Create"
                  : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
