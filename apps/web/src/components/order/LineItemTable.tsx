import { Fragment, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { ChevronDownIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { BoxReferenceBadge } from "@/components/order/BoxReferenceBadge";
import { LineItemExpandedRow } from "@/components/order/LineItemExpandedRow";
import { ColorVarietyCombobox } from "@/components/order/ColorVarietyCombobox";
import type { CustomerPricing } from "@/types";

// ── OrderLineState ──────────────────────────────────────────
export interface OrderLineState {
  id: string;
  isNew?: boolean; // true for locally-added lines, false/undefined for lines from the server
  sales_item_id: string;
  stems: number;
  price_per_stem: number;
  varietyId: string;
  salesItemName: string;
  listPrice: number;
  expanded: boolean;
  color_variety: string;
  box_reference: string | null;
  item_fee_pct: number;
  item_fee_dollar: number;
  box_quantity: number;
  bunches_per_box: number;
  stems_per_bunch: number;
  is_special: boolean;
  sleeve: string;
  upc: string;
  notes: string;
}

interface LineItemTableProps {
  lines: OrderLineState[];
  onLinesChange: (lines: OrderLineState[]) => void;
  customerPricing: CustomerPricing[];
}

function buildBoxColorMap(lines: OrderLineState[]): Record<string, number> {
  const letters = new Set<string>();
  for (const line of lines) {
    if (!line.box_reference) continue;
    line.box_reference
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((l) => letters.add(l));
  }
  const sorted = Array.from(letters).sort();
  const map: Record<string, number> = {};
  sorted.forEach((letter, i) => {
    map[letter] = i;
  });
  return map;
}

export function LineItemTable({
  lines,
  onLinesChange,
  customerPricing,
}: LineItemTableProps) {
  const [addSearch, setAddSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  const boxColorMap = useMemo(() => buildBoxColorMap(lines), [lines]);

  useEffect(() => {
    if (!addOpen) return;
    function handleClick(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [addOpen]);

  const updateLine = useCallback(
    (id: string, updates: Partial<OrderLineState>) => {
      onLinesChange(
        lines.map((l) => (l.id === id ? { ...l, ...updates } : l))
      );
    },
    [lines, onLinesChange]
  );

  const removeLine = useCallback(
    (id: string) => {
      onLinesChange(lines.filter((l) => l.id !== id));
    },
    [lines, onLinesChange]
  );

  const toggleExpand = useCallback(
    (id: string) => {
      onLinesChange(
        lines.map((l) =>
          l.id === id ? { ...l, expanded: !l.expanded } : l
        )
      );
    },
    [lines, onLinesChange]
  );

  // Search customer pricing by sales_item_name
  const addResults = useMemo(() => {
    if (!addSearch.trim()) return [];
    const lower = addSearch.toLowerCase();
    return customerPricing
      .filter((cp) => cp.sales_item_name.toLowerCase().includes(lower))
      .sort((a, b) => {
        const aPrice = parseFloat(a.customer_price);
        const bPrice = parseFloat(b.customer_price);
        const aHasPrice = !isNaN(aPrice) && aPrice > 0;
        const bHasPrice = !isNaN(bPrice) && bPrice > 0;
        if (aHasPrice && !bHasPrice) return -1;
        if (!aHasPrice && bHasPrice) return 1;
        return a.sales_item_name.localeCompare(b.sales_item_name);
      });
  }, [addSearch, customerPricing]);

  function handleAddFromPricing(cp: CustomerPricing) {
    const price = parseFloat(cp.customer_price);
    const newLine: OrderLineState = {
      id: crypto.randomUUID(),
      sales_item_id: cp.sales_item_id,
      stems: 0,
      price_per_stem: price,
      varietyId: "",
      salesItemName: cp.sales_item_name,
      listPrice: price,
      expanded: false,
      color_variety: "",
      box_reference: null,
      item_fee_pct: 0,
      item_fee_dollar: 0,
      box_quantity: 0,
      bunches_per_box: 0,
      stems_per_bunch: 0,
      is_special: false,
      sleeve: "",
      upc: "",
      notes: "",
    };
    onLinesChange([...lines, newLine]);
    setAddSearch("");
    setAddOpen(false);
  }

  return (
    <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="bg-[#1e3a5f] text-white text-xs">
            <th className="w-7 px-1">&nbsp;</th>
            <th className="w-[30%] text-left px-2 py-2 font-medium">Sales Item</th>
            <th className="w-[20%] text-center px-2 py-2 font-medium">Color / Variety</th>
            <th className="w-[10%] text-center px-2 py-2 font-medium">Stems</th>
            <th className="w-[12%] text-center px-2 py-2 font-medium">Price/Stem</th>
            <th className="w-[12%] text-center px-2 py-2 font-medium">Effective</th>
            <th className="w-[8%] text-center px-2 py-2 font-medium">Box</th>
            <th className="w-7 px-1">&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const effectivePerStem =
              line.price_per_stem * (1 + (line.item_fee_pct || 0)) +
              (line.item_fee_dollar || 0);
            const hasFeeMod =
              line.item_fee_pct !== 0 || line.item_fee_dollar !== 0;
            const isPriceOverridden =
              line.price_per_stem !== line.listPrice || hasFeeMod;

            return (
              <Fragment key={line.id}>
                <tr className="border-b border-border/50 hover:bg-accent/30 transition-colors text-sm">
                  <td className="w-[20px] px-1">
                    <button
                      type="button"
                      onClick={() => toggleExpand(line.id)}
                      className="p-0.5 hover:bg-accent rounded transition-colors"
                    >
                      {line.expanded ? (
                        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </td>

                  <td className="px-2 py-1.5">{line.salesItemName}</td>

                  <td className="px-2 py-1.5">
                    <ColorVarietyCombobox
                      varietyId={line.varietyId}
                      value={line.color_variety}
                      onChange={(val) => updateLine(line.id, { color_variety: val })}
                    />
                  </td>

                  <td className="px-2 py-1.5">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={line.stems || ""}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0);
                        updateLine(line.id, { stems: val });
                      }}
                      className="h-7 text-xs text-right w-full [appearance:textfield]"
                    />
                  </td>

                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={line.price_per_stem || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0;
                          updateLine(line.id, { price_per_stem: val });
                        }}
                        className="h-7 text-xs text-right w-full pl-5"
                      />
                    </div>
                  </td>

                  <td
                    className={cn(
                      "w-[80px] px-2 py-1.5 text-right tabular-nums text-xs",
                      isPriceOverridden
                        ? "text-[#c27890] font-medium"
                        : "text-foreground"
                    )}
                  >
                    ${effectivePerStem.toFixed(2)}
                  </td>

                  <td className="w-[55px] px-2 py-1.5 text-center">
                    <BoxReferenceBadge
                      references={line.box_reference}
                      colorMap={boxColorMap}
                    />
                  </td>

                  <td className="w-[24px] px-1">
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="p-0.5 text-muted-foreground hover:text-destructive rounded transition-colors"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </td>
                </tr>

                {line.expanded && (
                  <LineItemExpandedRow
                    line={line}
                    onChange={(updates) => updateLine(line.id, updates)}
                  />
                )}
              </Fragment>
            );
          })}

          {/* Inline add row */}
          <tr className="border-t border-border/30">
            <td colSpan={8} className="px-2 py-2">
              <div ref={addRef} className="relative max-w-xs">
                <Command
                  shouldFilter={false}
                  className="rounded-lg border border-dashed border-border"
                >
                  <CommandInput
                    placeholder="Type to search products..."
                    value={addSearch}
                    onValueChange={(val) => {
                      setAddSearch(val);
                      if (!addOpen) setAddOpen(true);
                    }}
                    onFocus={() => setAddOpen(true)}
                  />
                  {addOpen && addSearch.trim() !== "" && (
                    <CommandList>
                      {addResults.length === 0 && (
                        <CommandEmpty>No matching products.</CommandEmpty>
                      )}
                      {addResults.map((cp) => (
                        <CommandItem
                          key={cp.sales_item_id}
                          value={cp.sales_item_id}
                          onSelect={() => handleAddFromPricing(cp)}
                        >
                          <span className="flex-1">{cp.sales_item_name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            ${parseFloat(cp.customer_price).toFixed(2)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  )}
                </Command>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
