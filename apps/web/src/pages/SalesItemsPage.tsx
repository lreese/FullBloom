import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { SalesItemTable } from "@/components/pricing/SalesItemTable";
import { SalesItemDrawer } from "@/components/pricing/SalesItemDrawer";
import { ProductArchiveDialog } from "@/components/product/ProductArchiveDialog";
import type { SalesItem, PriceList, Variety } from "@/types";

type FlatSalesItem = SalesItem & {
  variety_name?: string;
  variety_id?: string;
  price_list_prices?: Record<string, string>;
} & Record<string, unknown>;

export function SalesItemsPage() {
  const [salesItems, setSalesItems] = useState<FlatSalesItem[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [activeView, setActiveView] = useState<"active" | "archived">("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "add">("edit");
  const [selectedItem, setSelectedItem] = useState<FlatSalesItem | null>(null);
  const [priceListPrices, setPriceListPrices] = useState<Record<string, string>>({});
  const [customerPricesCount, setCustomerPricesCount] = useState(0);

  // Archive dialog state
  const [archiveTarget, setArchiveTarget] = useState<FlatSalesItem | null>(null);

  const fetchSalesItems = useCallback(async () => {
    const data = await api.get<FlatSalesItem[]>(
      `/api/v1/sales-items?active=${activeView === "active"}`
    );
    setSalesItems(data);
  }, [activeView]);

  const fetchPriceLists = useCallback(async () => {
    const data = await api.get<PriceList[]>("/api/v1/price-lists?active=true");
    setPriceLists(data);
  }, []);

  const fetchVarieties = useCallback(async () => {
    const data = await api.get<Variety[]>("/api/v1/varieties?active=true");
    setVarieties(data);
  }, []);

  useEffect(() => {
    fetchSalesItems();
  }, [fetchSalesItems]);

  useEffect(() => {
    fetchPriceLists();
    fetchVarieties();
  }, [fetchPriceLists, fetchVarieties]);

  const handleRowClick = async (item: FlatSalesItem) => {
    setSelectedItem(item);
    setPriceListPrices(item.price_list_prices ?? {});
    setCustomerPricesCount(item.customer_prices_count ?? 0);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const handleAddClick = () => {
    setSelectedItem(null);
    setPriceListPrices({});
    setCustomerPricesCount(0);
    setDrawerMode("add");
    setDrawerOpen(true);
  };

  const handleSave = async (data: {
    name: string;
    variety_id?: string;
    stems_per_order: number;
    retail_price: string;
    price_list_prices?: Record<string, string>;
    selected_price_lists?: string[];
  }) => {
    if (drawerMode === "add") {
      await api.post("/api/v1/sales-items", data);
    } else if (selectedItem) {
      await api.patch(`/api/v1/sales-items/${selectedItem.id}`, data);
      // Update individual price list prices
      if (data.price_list_prices) {
        for (const [plId, price] of Object.entries(data.price_list_prices)) {
          await api.patch(
            `/api/v1/price-list-items/${plId}/${selectedItem.id}`,
            { price }
          );
        }
      }
    }
    await fetchSalesItems();
  };

  const handleArchiveRequest = (id: string) => {
    const item = salesItems.find((i) => i.id === id);
    if (item) setArchiveTarget(item);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    await api.post(`/api/v1/sales-items/${archiveTarget.id}/archive`, {});
    setArchiveTarget(null);
    setDrawerOpen(false);
    await fetchSalesItems();
  };

  const handleRestore = async (id: string) => {
    await api.post(`/api/v1/sales-items/${id}/restore`, {});
    setDrawerOpen(false);
    await fetchSalesItems();
  };

  return (
    <>
      <SalesItemTable
        salesItems={salesItems}
        priceLists={priceLists}
        activeView={activeView}
        onViewChange={setActiveView}
        onRowClick={handleRowClick}
        onAddClick={handleAddClick}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <SalesItemDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        salesItem={selectedItem}
        varieties={varieties}
        priceLists={priceLists}
        priceListPrices={priceListPrices}
        customerPricesCount={customerPricesCount}
        onSave={handleSave}
        onArchive={handleArchiveRequest}
        onRestore={handleRestore}
      />

      <ProductArchiveDialog
        open={archiveTarget !== null}
        entityName={archiveTarget?.name ?? ""}
        entityType="sales item"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}
