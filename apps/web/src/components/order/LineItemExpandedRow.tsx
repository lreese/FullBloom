import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { FieldTooltip } from "@/components/common/Tooltip";
import type { OrderLineState } from "@/components/order/LineItemTable";

interface LineItemExpandedRowProps {
  line: OrderLineState;
  onChange: (updates: Partial<OrderLineState>) => void;
}

export function LineItemExpandedRow({
  line,
  onChange,
}: LineItemExpandedRowProps) {
  const handleNumber = useCallback(
    (field: keyof OrderLineState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value === "" ? 0 : Number(e.target.value);
      onChange({ [field]: val });
    },
    [onChange]
  );

  const handleText = useCallback(
    (field: keyof OrderLineState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ [field]: e.target.value });
    },
    [onChange]
  );

  return (
    <tr>
      <td colSpan={8} className="bg-cream-warm border-b border-border/50">
        <div className="py-3 pr-4" style={{ paddingLeft: "44px" }}>
          <div className="grid grid-cols-4 gap-x-6 gap-y-3">
            {/* Fees */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Fees
              </span>
              <div className="space-y-1">
                <FieldTooltip content="Percentage fee applied to this line item">
                  <label className="text-xs text-muted-foreground">
                    Item Fee %
                  </label>
                </FieldTooltip>
                <Input
                  type="number"
                  value={line.item_fee_pct ?? ""}
                  onChange={handleNumber("item_fee_pct")}
                  className="h-7 text-xs w-24"
                  min={0}
                  step={0.1}
                />
              </div>
              <div className="space-y-1">
                <FieldTooltip content="Flat dollar fee applied to this line item">
                  <label className="text-xs text-muted-foreground">
                    Item Fee $
                  </label>
                </FieldTooltip>
                <Input
                  type="number"
                  value={line.item_fee_dollar ?? ""}
                  onChange={handleNumber("item_fee_dollar")}
                  className="h-7 text-xs w-24"
                  min={0}
                  step={0.01}
                />
              </div>
            </div>

            {/* Packing Details */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Packing Details
              </span>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Box Qty</label>
                <Input
                  type="number"
                  value={line.box_quantity ?? ""}
                  onChange={handleNumber("box_quantity")}
                  className="h-7 text-xs w-20"
                  min={0}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Bunches/Box
                </label>
                <Input
                  type="number"
                  value={line.bunches_per_box ?? ""}
                  onChange={handleNumber("bunches_per_box")}
                  className="h-7 text-xs w-20"
                  min={0}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Stems/Bunch
                </label>
                <Input
                  type="number"
                  value={line.stems_per_bunch ?? ""}
                  onChange={handleNumber("stems_per_bunch")}
                  className="h-7 text-xs w-20"
                  min={0}
                />
              </div>
            </div>

            {/* Special */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Special
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={line.is_special ?? false}
                  onClick={() => onChange({ is_special: !line.is_special })}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                    line.is_special ? "bg-slate-heading" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform",
                      line.is_special ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
                <span className="text-xs text-muted-foreground">Special</span>
              </div>
              {line.is_special && (
                <div className="space-y-1 mt-1">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Sleeve
                    </label>
                    <Input
                      type="text"
                      value={line.sleeve ?? ""}
                      onChange={handleText("sleeve")}
                      className="h-7 text-xs w-32"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">UPC</label>
                    <Input
                      type="text"
                      value={line.upc ?? ""}
                      onChange={handleText("upc")}
                      className="h-7 text-xs w-32"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Notes
              </span>
              <Input
                type="text"
                value={line.notes ?? ""}
                onChange={handleText("notes")}
                placeholder="Add notes..."
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
