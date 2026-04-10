import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { VarietyTable } from "@/components/product/VarietyTable";
import { VarietyDrawer } from "@/components/product/VarietyDrawer";
import { ProductArchiveDialog } from "@/components/product/ProductArchiveDialog";
import type {
  Variety,
  VarietyCreateRequest,
  VarietyUpdateRequest,
  VarietyDropdownOptions,
  SalesItem,
} from "@/types";

export function VarietiesPage() {
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [dropdownOptions, setDropdownOptions] = useState<VarietyDropdownOptions>({
    product_lines: [],
    colors: [],
    flowering_types: [],
    weekly_sales_categories: [],
  });
  const [activeView, setActiveView] = useState<"active" | "archived">("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "add">("edit");
  const [selectedVariety, setSelectedVariety] = useState<Variety | null>(null);
  const [salesItems, setSalesItems] = useState<SalesItem[]>([]);
  const [archiveTarget, setArchiveTarget] = useState<Variety | null>(null);

  const fetchVarieties = useCallback(async () => {
    const data = await api.get<Variety[]>(
      `/api/v1/varieties?active=${activeView === "active"}`
    );
    setVarieties(data);
  }, [activeView]);

  const fetchDropdownOptions = useCallback(async () => {
    const data = await api.get<VarietyDropdownOptions>(
      "/api/v1/varieties/dropdown-options"
    );
    setDropdownOptions(data);
  }, []);

  const fetchSalesItems = useCallback(async (varietyId: string) => {
    const data = await api.get<SalesItem[]>(
      `/api/v1/varieties/${varietyId}/sales-items?include_inactive=true`
    );
    setSalesItems(data);
  }, []);

  useEffect(() => {
    fetchVarieties();
  }, [fetchVarieties]);

  useEffect(() => {
    fetchDropdownOptions();
  }, [fetchDropdownOptions]);

  const handleRowClick = async (variety: Variety) => {
    const detail = await api.get<Variety>(`/api/v1/varieties/${variety.id}`);
    setSelectedVariety(detail);
    setSalesItems(detail.sales_items ?? []);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const handleAddClick = () => {
    setSelectedVariety(null);
    setSalesItems([]);
    setDrawerMode("add");
    setDrawerOpen(true);
  };

  const handleSave = async (data: VarietyCreateRequest | VarietyUpdateRequest) => {
    if (drawerMode === "add") {
      await api.post("/api/v1/varieties", data);
    } else if (selectedVariety) {
      await api.patch(`/api/v1/varieties/${selectedVariety.id}`, data);
    }
    await fetchVarieties();
    await fetchDropdownOptions();
  };

  const handleArchiveRequest = (id: string) => {
    const variety = varieties.find((v) => v.id === id);
    if (variety) setArchiveTarget(variety);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    await api.post(`/api/v1/varieties/${archiveTarget.id}/archive`, {});
    setArchiveTarget(null);
    setDrawerOpen(false);
    await fetchVarieties();
  };

  const handleRestore = async (id: string) => {
    await api.post(`/api/v1/varieties/${id}/restore`, {});
    setDrawerOpen(false);
    await fetchVarieties();
  };

  const handleBulkUpdate = async (field: string, value: string | boolean) => {
    await api.patch("/api/v1/varieties/bulk", {
      ids: Array.from(selectedIds),
      field,
      value,
    });
    setSelectedIds(new Set());
    await fetchVarieties();
  };

  // Sales item handlers
  const handleSalesItemCreate = async (
    varietyId: string,
    data: { name: string; stems_per_order: number; retail_price: string }
  ) => {
    await api.post(`/api/v1/varieties/${varietyId}/sales-items`, data);
    await fetchSalesItems(varietyId);
  };

  const handleSalesItemUpdate = async (
    id: string,
    data: { name?: string; stems_per_order?: number; retail_price?: string }
  ) => {
    await api.patch(`/api/v1/sales-items/${id}`, data);
    if (selectedVariety) await fetchSalesItems(selectedVariety.id);
  };

  const handleSalesItemArchive = async (id: string) => {
    await api.post(`/api/v1/sales-items/${id}/archive`, {});
    if (selectedVariety) await fetchSalesItems(selectedVariety.id);
  };

  const handleSalesItemRestore = async (id: string) => {
    await api.post(`/api/v1/sales-items/${id}/restore`, {});
    if (selectedVariety) await fetchSalesItems(selectedVariety.id);
  };

  return (
    <>
      <VarietyTable
        varieties={varieties}
        dropdownOptions={dropdownOptions}
        activeView={activeView}
        onViewChange={setActiveView}
        onRowClick={handleRowClick}
        onAddClick={handleAddClick}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onBulkUpdate={handleBulkUpdate}
      />

      <VarietyDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        variety={selectedVariety}
        salesItems={salesItems}
        dropdownOptions={dropdownOptions}
        onSave={handleSave}
        onArchive={handleArchiveRequest}
        onRestore={handleRestore}
        onSalesItemCreate={handleSalesItemCreate}
        onSalesItemUpdate={handleSalesItemUpdate}
        onSalesItemArchive={handleSalesItemArchive}
        onSalesItemRestore={handleSalesItemRestore}
      />

      <ProductArchiveDialog
        open={archiveTarget !== null}
        entityName={archiveTarget?.name ?? ""}
        entityType="variety"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}
