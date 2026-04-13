import { Input } from "@/components/ui/input";

export interface Salesperson {
  id: string;
  email: string;
  display_name: string | null;
}

interface OrderDetailsCardProps {
  poNumber: string;
  salespersonEmail: string;
  orderNotes: string;
  onChange: (field: string, value: string) => void;
  salespeople?: Salesperson[];
  canWriteOrders?: boolean;
}

export function OrderDetailsCard({
  poNumber,
  salespersonEmail,
  orderNotes,
  onChange,
  salespeople,
  canWriteOrders = true,
}: OrderDetailsCardProps) {
  const hasSalespeople = salespeople && salespeople.length > 0;

  return (
    <div className="bg-white border border-border rounded-lg p-4 flex-1 min-w-[260px]">
      <h3 className="text-sm font-bold text-[#1e3a5f] mb-3">Order Details</h3>

      <div className="flex flex-col gap-3">
        {/* PO Number */}
        <div>
          <label className="block text-xs font-semibold text-[#1e3a5f] mb-1">
            PO Number
          </label>
          <Input
            type="text"
            placeholder="e.g. PO-12345"
            value={poNumber}
            onChange={(e) => onChange("poNumber", e.target.value)}
            className="h-7 text-sm"
          />
        </div>

        {/* Salesperson */}
        {canWriteOrders && (
          <div>
            <label className="block text-xs font-semibold text-[#1e3a5f] mb-1">
              Salesperson
            </label>
            {hasSalespeople ? (
              <select
                value={salespersonEmail}
                onChange={(e) => onChange("salespersonEmail", e.target.value)}
                className="w-full h-7 rounded-md border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">— None —</option>
                {salespeople.map((sp) => (
                  <option key={sp.id} value={sp.email}>
                    {sp.display_name ? `${sp.display_name} (${sp.email})` : sp.email}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type="email"
                placeholder="jane@oregonflowers.com"
                value={salespersonEmail}
                onChange={(e) => onChange("salespersonEmail", e.target.value)}
                className="h-7 text-sm"
              />
            )}
          </div>
        )}

        {/* Order Notes */}
        <div>
          <label className="block text-xs font-semibold text-[#1e3a5f] mb-1">
            Order Notes
          </label>
          <textarea
            placeholder="Additional notes for this order..."
            value={orderNotes}
            onChange={(e) => onChange("orderNotes", e.target.value)}
            className="w-full min-h-[60px] rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
          />
        </div>
      </div>
    </div>
  );
}
