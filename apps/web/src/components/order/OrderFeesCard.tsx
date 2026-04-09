import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { FieldTooltip } from "@/components/common/Tooltip";

interface OrderFeesCardProps {
  boxCharge: number;
  holidayChargePct: number;
  specialCharge: number;
  freightCharge: number;
  freightChargeIncluded: boolean;
  onChange: (field: string, value: number | boolean) => void;
}

export function OrderFeesCard({
  boxCharge,
  holidayChargePct,
  specialCharge,
  freightCharge,
  freightChargeIncluded,
  onChange,
}: OrderFeesCardProps) {
  return (
    <div className="bg-white border border-border rounded-lg p-4 flex-1 min-w-[260px]">
      <h3 className="text-sm font-bold text-[#1e3a5f] mb-3">Order Fees</h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Box Charge */}
        <div>
          <FieldTooltip content="Flat dollar charge per box">
            <label className="block text-xs font-semibold text-[#1e3a5f] mb-1">
              Box Charge ($)
            </label>
          </FieldTooltip>
          <Input
            type="number"
            value={boxCharge || ""}
            onChange={(e) => onChange("boxCharge", parseFloat(e.target.value) || 0)}
            className="h-7 text-sm"
            min={0}
            step={0.01}
          />
        </div>

        {/* Holiday Charge */}
        <div>
          <FieldTooltip content="Percentage surcharge applied for holiday periods">
            <label className="block text-xs font-semibold text-[#1e3a5f] mb-1">
              Holiday Charge (%)
            </label>
          </FieldTooltip>
          <Input
            type="number"
            value={holidayChargePct || ""}
            onChange={(e) => onChange("holidayChargePct", parseFloat(e.target.value) || 0)}
            className="h-7 text-sm"
            min={0}
            step={0.01}
          />
        </div>

        {/* Special Charge */}
        <div>
          <FieldTooltip content="Flat dollar charge for special handling">
            <label className="block text-xs font-semibold text-[#1e3a5f] mb-1">
              Special Charge ($)
            </label>
          </FieldTooltip>
          <Input
            type="number"
            value={specialCharge || ""}
            onChange={(e) => onChange("specialCharge", parseFloat(e.target.value) || 0)}
            className="h-7 text-sm"
            min={0}
            step={0.01}
          />
        </div>

        {/* Freight Charge */}
        <div>
          <FieldTooltip content="Flat dollar charge for freight/shipping">
            <label className="block text-xs font-semibold text-[#1e3a5f] mb-1">
              Freight Charge ($)
            </label>
          </FieldTooltip>
          <Input
            type="number"
            value={freightCharge || ""}
            onChange={(e) => onChange("freightCharge", parseFloat(e.target.value) || 0)}
            className="h-7 text-sm"
            min={0}
            step={0.01}
          />
        </div>
      </div>

      {/* Freight Charge Included toggle */}
      <div className="mt-3 flex items-center gap-2">
        <FieldTooltip content="When on, freight is already included in pricing — no additional charge applied">
          <span className="text-xs font-semibold text-[#1e3a5f]">
            Freight Charge Included
          </span>
        </FieldTooltip>
        <button
          type="button"
          onClick={() => onChange("freightChargeIncluded", !freightChargeIncluded)}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            freightChargeIncluded ? "bg-rose-500" : "bg-gray-300"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform",
              freightChargeIncluded ? "translate-x-4" : "translate-x-0"
            )}
          />
        </button>
      </div>
    </div>
  );
}
