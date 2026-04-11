import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { ProductTypeTable } from "@/components/product/ProductTypeTable";
import { ProductTypeDrawer } from "@/components/product/ProductTypeDrawer";
import { ProductArchiveDialog } from "@/components/product/ProductArchiveDialog";
import type { ProductType, ProductTypeCreateRequest } from "@/types";

export function ProductTypesPage() {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [activeView, setActiveView] = useState<"active" | "archived">("active");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "add">("edit");
  const [selectedProductType, setSelectedProductType] = useState<ProductType | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ProductType | null>(null);

  const fetchProductTypes = useCallback(async () => {
    const data = await api.get<ProductType[]>(
      `/api/v1/product-types?active=${activeView === "active"}`
    );
    setProductTypes(data);
  }, [activeView]);

  useEffect(() => {
    fetchProductTypes();
  }, [fetchProductTypes]);

  const handleRowClick = (productType: ProductType) => {
    setSelectedProductType(productType);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const handleAddClick = () => {
    setSelectedProductType(null);
    setDrawerMode("add");
    setDrawerOpen(true);
  };

  const handleSave = async (data: ProductTypeCreateRequest) => {
    if (drawerMode === "add") {
      await api.post("/api/v1/product-types", data);
    } else if (selectedProductType) {
      await api.patch(`/api/v1/product-types/${selectedProductType.id}`, data);
    }
    await fetchProductTypes();
  };

  const handleArchiveRequest = (id: string) => {
    const pt = productTypes.find((p) => p.id === id);
    if (pt) setArchiveTarget(pt);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    await api.post(`/api/v1/product-types/${archiveTarget.id}/archive`, {});
    setArchiveTarget(null);
    setDrawerOpen(false);
    await fetchProductTypes();
  };

  const handleRestore = async (id: string) => {
    await api.post(`/api/v1/product-types/${id}/restore`, {});
    setDrawerOpen(false);
    await fetchProductTypes();
  };

  const archiveWarning = archiveTarget && archiveTarget.product_line_count > 0
    ? `This product type has ${archiveTarget.product_line_count} product line${archiveTarget.product_line_count !== 1 ? "s" : ""}. Archiving it will hide them and their varieties.`
    : undefined;

  return (
    <>
      <ProductTypeTable
        productTypes={productTypes}
        activeView={activeView}
        onViewChange={setActiveView}
        onRowClick={handleRowClick}
        onAddClick={handleAddClick}
      />

      <ProductTypeDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        productType={selectedProductType}
        onSave={handleSave}
        onArchive={handleArchiveRequest}
        onRestore={handleRestore}
      />

      <ProductArchiveDialog
        open={archiveTarget !== null}
        entityName={archiveTarget?.name ?? ""}
        entityType="product type"
        warningText={archiveWarning}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}
