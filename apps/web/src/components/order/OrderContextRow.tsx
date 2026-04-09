import { CustomerSelector } from "@/components/order/CustomerSelector";
import { ShipViaSelector } from "@/components/order/ShipViaSelector";
import { Input } from "@/components/ui/input";
import { FieldTooltip } from "@/components/common/Tooltip";
import type { Customer } from "@/types";

interface OrderContextRowProps {
  customer: Customer | null;
  onCustomerChange: (customer: Customer) => void;
  orderLabel: string;
  onOrderLabelChange: (label: string) => void;
  orderDate: string;
  onOrderDateChange: (date: string) => void;
  shipVia: string;
  onShipViaChange: (shipVia: string) => void;
}

export function OrderContextRow({
  customer,
  onCustomerChange,
  orderLabel,
  onOrderLabelChange,
  orderDate,
  onOrderDateChange,
  shipVia,
  onShipViaChange,
}: OrderContextRowProps) {
  return (
    <div className="flex flex-wrap items-start gap-2.5">
      {/* Customer */}
      <div className="flex-[2] min-w-[200px]">
        <label className="block text-xs font-semibold text-[#1e3a5f] mb-1 h-5 leading-5">
          Customer
        </label>
        <CustomerSelector value={customer} onSelect={onCustomerChange} />
      </div>

      {/* Order Label */}
      <div className="flex-[1] min-w-[140px]">
        <div className="h-5 mb-1 flex items-center">
          <FieldTooltip content="A label for this order, e.g. a specific store name or delivery reference for the customer">
            <label className="text-xs font-semibold text-[#1e3a5f]">
              Order Label
            </label>
          </FieldTooltip>
        </div>
        <Input
          type="text"
          placeholder="e.g. Downtown Store"
          value={orderLabel}
          onChange={(e) => onOrderLabelChange(e.target.value)}
        />
      </div>

      {/* Date */}
      <div className="flex-[1] min-w-[140px]">
        <label className="block text-xs font-semibold text-[#1e3a5f] mb-1 h-5 leading-5">
          Date
        </label>
        <Input
          type="date"
          value={orderDate}
          onChange={(e) => onOrderDateChange(e.target.value)}
        />
      </div>

      {/* Ship Via */}
      <div className="flex-[1] min-w-[140px]">
        <label className="block text-xs font-semibold text-[#1e3a5f] mb-1 h-5 leading-5">
          Ship Via
        </label>
        <ShipViaSelector value={shipVia} onChange={onShipViaChange} />
      </div>
    </div>
  );
}
