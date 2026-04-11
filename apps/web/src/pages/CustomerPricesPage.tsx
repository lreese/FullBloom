import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/services/api";
import { CustomerPriceGrid } from "@/components/pricing/CustomerPriceGrid";
import { ItemPriceGrid } from "@/components/pricing/ItemPriceGrid";
import { PricingSummaryBar } from "@/components/pricing/PricingSummaryBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Customer,
  SalesItem,
  CustomerPricingData,
  CustomerPricingItem,
  ItemPricingData,
  ItemPricingCustomer,
  PricingSummary,
} from "@/types";

type ViewMode = "customer" | "item";

export function CustomerPricesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("customer");

  // Customer view state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [customerPricing, setCustomerPricing] =
    useState<CustomerPricingData | null>(null);

  // Item view state
  const [salesItems, setSalesItems] = useState<SalesItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemPricing, setItemPricing] = useState<ItemPricingData | null>(null);
  const [itemSelectedIds, setItemSelectedIds] = useState<Set<string>>(new Set());

  // Fetch customers and sales items for selectors
  useEffect(() => {
    api.get<Customer[]>("/api/v1/customers?active=true").then(setCustomers);
    api.get<SalesItem[]>("/api/v1/sales-items?active=true").then(setSalesItems);
  }, []);

  // Fetch customer pricing when selected
  const fetchCustomerPricing = useCallback(async (customerId: string) => {
    const data = await api.get<CustomerPricingData>(
      `/api/v1/customers/${customerId}/pricing`
    );
    setCustomerPricing(data);
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerPricing(selectedCustomerId);
    }
  }, [selectedCustomerId, fetchCustomerPricing]);

  // Fetch item pricing when selected
  const fetchItemPricing = useCallback(async (itemId: string) => {
    const data = await api.get<ItemPricingData>(
      `/api/v1/sales-items/${itemId}/customer-pricing`
    );
    setItemPricing(data);
  }, []);

  useEffect(() => {
    if (selectedItemId) {
      fetchItemPricing(selectedItemId);
    }
  }, [selectedItemId, fetchItemPricing]);

  // Customer view handlers
  const handleSetOverride = async (salesItemId: string, price: string) => {
    if (!selectedCustomerId) return;
    await api.post(`/api/v1/customers/${selectedCustomerId}/prices`, {
      sales_item_id: salesItemId,
      price,
    });
    await fetchCustomerPricing(selectedCustomerId);
  };

  const handleRemoveOverride = async (salesItemId: string) => {
    if (!selectedCustomerId) return;
    await api.del(
      `/api/v1/customers/${selectedCustomerId}/prices/${salesItemId}`
    );
    await fetchCustomerPricing(selectedCustomerId);
  };

  const handleBulkSetPrice = async (
    salesItemIds: string[],
    price: string
  ) => {
    if (!selectedCustomerId) return;
    await api.post(`/api/v1/customers/${selectedCustomerId}/prices/bulk`, {
      action: "set_price",
      sales_item_ids: salesItemIds,
      price,
    });
    await fetchCustomerPricing(selectedCustomerId);
  };

  const handleBulkRemoveOverrides = async (salesItemIds: string[]) => {
    if (!selectedCustomerId) return;
    await api.post(`/api/v1/customers/${selectedCustomerId}/prices/bulk`, {
      action: "remove_overrides",
      sales_item_ids: salesItemIds,
    });
    await fetchCustomerPricing(selectedCustomerId);
  };

  // Item view handlers
  const handleItemSetOverride = async (
    customerId: string,
    price: string
  ) => {
    if (!selectedItemId) return;
    await api.post(`/api/v1/customers/${customerId}/prices`, {
      sales_item_id: selectedItemId,
      price,
    });
    await fetchItemPricing(selectedItemId);
  };

  const handleItemRemoveOverride = async (customerId: string) => {
    if (!selectedItemId) return;
    await api.del(`/api/v1/customers/${customerId}/prices/${selectedItemId}`);
    await fetchItemPricing(selectedItemId);
  };

  const handleItemToggleSelect = (id: string) => {
    setItemSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleItemToggleSelectAll = () => {
    if (!itemPricing) return;
    if (itemSelectedIds.size === itemPricing.customers.length) {
      setItemSelectedIds(new Set());
    } else {
      setItemSelectedIds(new Set(itemPricing.customers.map((c) => c.customer_id)));
    }
  };

  const handleItemBulkSetPrice = async (customerIds: string[], price: string) => {
    if (!selectedItemId) return;
    await Promise.all(
      customerIds.map((cid) =>
        api.post(`/api/v1/customers/${cid}/prices`, {
          sales_item_id: selectedItemId,
          price,
        })
      )
    );
    setItemSelectedIds(new Set());
    await fetchItemPricing(selectedItemId);
  };

  const handleItemBulkRemoveOverrides = async (customerIds: string[]) => {
    if (!selectedItemId) return;
    await Promise.all(
      customerIds.map((cid) =>
        api.del(`/api/v1/customers/${cid}/prices/${selectedItemId}`)
      )
    );
    setItemSelectedIds(new Set());
    await fetchItemPricing(selectedItemId);
  };

  // Import handler
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCustomerId) return;
    try {
      await api.postFile(`/api/v1/customers/${selectedCustomerId}/prices/import`, file);
      await fetchCustomerPricing(selectedCustomerId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Import failed");
    }
    e.target.value = "";
  };

  // Export handler
  const handleExport = () => {
    if (viewMode === "customer" && selectedCustomerId) {
      window.open(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/api/v1/customers/${selectedCustomerId}/pricing/export`,
        "_blank"
      );
    }
  };

  // Filtered selectors
  const filteredCustomers = customerSearch
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase())
      )
    : customers;

  const filteredSalesItems = itemSearch
    ? salesItems.filter((s) =>
        s.name.toLowerCase().includes(itemSearch.toLowerCase())
      )
    : salesItems;

  const emptySummary: PricingSummary = {
    total_items: 0,
    override_count: 0,
    override_percentage: 0,
  };

  return (
    <div>
      {/* Header + view toggle */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <h1 className="text-lg font-bold text-[#1e3a5f] whitespace-nowrap">
          Customer Prices
        </h1>

        <div className="flex gap-px bg-[#e0ddd8] rounded-md overflow-hidden">
          <button
            className={cn(
              "px-3 py-1 text-xs transition-colors",
              viewMode === "customer"
                ? "bg-[#c27890] text-white"
                : "bg-white text-[#334155] hover:bg-[#f4f1ec]"
            )}
            onClick={() => setViewMode("customer")}
          >
            By Customer
          </button>
          <button
            className={cn(
              "px-3 py-1 text-xs transition-colors",
              viewMode === "item"
                ? "bg-[#c27890] text-white"
                : "bg-white text-[#334155] hover:bg-[#f4f1ec]"
            )}
            onClick={() => setViewMode("item")}
          >
            By Item
          </button>
        </div>

        <div className="flex-1" />

        {viewMode === "customer" && selectedCustomerId && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => importFileRef.current?.click()}
            >
              Import CSV
            </Button>
            <input
              ref={importFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleExport}
            >
              Export CSV
            </Button>
          </>
        )}
      </div>

      {/* Customer view */}
      {viewMode === "customer" && (
        <div>
          {/* Customer selector */}
          <div className="mb-3">
            <div className="relative max-w-[400px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
              <Input
                placeholder="Search customers..."
                className="pl-8 h-8 text-sm"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
            {(customerSearch || !selectedCustomerId) && (
              <div className="mt-1 max-h-48 overflow-y-auto border border-[#e0ddd8] rounded-md bg-white">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm hover:bg-[#f4f1ec] transition-colors flex items-center gap-2",
                      selectedCustomerId === c.id && "bg-[#f4f1ec] font-medium"
                    )}
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setCustomerSearch("");
                    }}
                  >
                    <span className="text-[#334155]">{c.name}</span>
                    {c.price_list_name && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#dbeafe] text-[#1e3a5f]">
                        {c.price_list_name}
                      </span>
                    )}
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="px-3 py-4 text-sm text-[#94a3b8] text-center">
                    No customers found.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Summary bar */}
          {customerPricing && (
            <PricingSummaryBar
              summary={customerPricing.summary ?? emptySummary}
            />
          )}

          {/* Grid */}
          {selectedCustomerId && customerPricing ? (
            <CustomerPriceGrid
              items={
                customerPricing.items as (CustomerPricingItem &
                  Record<string, unknown>)[]
              }
              priceListName={customerPricing.customer.price_list_name ?? "Retail"}
              onSetOverride={handleSetOverride}
              onRemoveOverride={handleRemoveOverride}
              onBulkSetPrice={handleBulkSetPrice}
              onBulkRemoveOverrides={handleBulkRemoveOverrides}
            />
          ) : (
            <div className="py-12 text-center text-sm text-[#94a3b8]">
              Select a customer to view their pricing.
            </div>
          )}
        </div>
      )}

      {/* Item view */}
      {viewMode === "item" && (
        <div>
          {/* Sales item selector */}
          <div className="mb-3">
            <div className="relative max-w-[400px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
              <Input
                placeholder="Search sales items..."
                className="pl-8 h-8 text-sm"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
              />
            </div>
            {(itemSearch || !selectedItemId) && (
              <div className="mt-1 max-h-48 overflow-y-auto border border-[#e0ddd8] rounded-md bg-white">
                {filteredSalesItems.map((s) => (
                  <button
                    key={s.id}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm hover:bg-[#f4f1ec] transition-colors",
                      selectedItemId === s.id && "bg-[#f4f1ec] font-medium"
                    )}
                    onClick={() => {
                      setSelectedItemId(s.id);
                      setItemSearch("");
                    }}
                  >
                    <span className="text-[#334155]">{s.name}</span>
                    <span className="text-[#94a3b8] ml-2 text-xs">
                      ${Number(s.retail_price).toFixed(2)}
                    </span>
                  </button>
                ))}
                {filteredSalesItems.length === 0 && (
                  <div className="px-3 py-4 text-sm text-[#94a3b8] text-center">
                    No sales items found.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Grid */}
          {selectedItemId && itemPricing ? (
            <ItemPriceGrid
              customers={
                itemPricing.customers as (ItemPricingCustomer &
                  Record<string, unknown>)[]
              }
              onSetOverride={handleItemSetOverride}
              onRemoveOverride={handleItemRemoveOverride}
              selectedIds={itemSelectedIds}
              onToggleSelect={handleItemToggleSelect}
              onToggleSelectAll={handleItemToggleSelectAll}
              onBulkSetPrice={handleItemBulkSetPrice}
              onBulkRemoveOverrides={handleItemBulkRemoveOverrides}
            />
          ) : (
            <div className="py-12 text-center text-sm text-[#94a3b8]">
              Select a sales item to view customer pricing.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
