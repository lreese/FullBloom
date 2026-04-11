import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { ProductLineTable } from "@/components/product/ProductLineTable";
import { ProductLineDrawer } from "@/components/product/ProductLineDrawer";
import { ProductArchiveDialog } from "@/components/product/ProductArchiveDialog";
import type { ProductLine, ProductLineCreateRequest } from "@/types";

interface ProductLineDropdownOptions {
  product_types: { id: string; name: string }[];
}

export function ProductLinesPage() {
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [dropdownOptions, setDropdownOptions] = useState<ProductLineDropdownOptions>({
    product_types: [],
  });
  const [activeView, setActiveView] = useState<"active" | "archived">("active");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "add">("edit");
  const [selectedProductLine, setSelectedProductLine] = useState<ProductLine | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ProductLine | null>(null);

  const fetchProductLines = useCallback(async () => {
    const data = await api.get<ProductLine[]>(
      `/api/v1/product-lines?active=${activeView === "active"}`
    );
    setProductLines(data);
  }, [activeView]);

  const fetchDropdownOptions = useCallback(async () => {
    const data = await api.get<ProductLineDropdownOptions>(
      "/api/v1/product-lines/dropdown-options"
    );
    setDropdownOptions(data);
  }, []);

  useEffect(() => {
    fetchProductLines();
  }, [fetchProductLines]);

  useEffect(() => {
    fetchDropdownOptions();
  }, [fetchDropdownOptions]);

  const handleRowClick = (productLine: ProductLine) => {
    setSelectedProductLine(productLine);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const handleAddClick = () => {
    setSelectedProductLine(null);
    setDrawerMode("add");
    setDrawerOpen(true);
  };

  const handleSave = async (data: ProductLineCreateRequest) => {
    if (drawerMode === "add") {
      await api.post("/api/v1/product-lines", data);
    } else if (selectedProductLine) {
      await api.patch(`/api/v1/product-lines/${selectedProductLine.id}`, data);
    }
    await fetchProductLines();
    await fetchDropdownOptions();
  };

  const handleArchiveRequest = (id: string) => {
    const pl = productLines.find((p) => p.id === id);
    if (pl) setArchiveTarget(pl);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    await api.post(`/api/v1/product-lines/${archiveTarget.id}/archive`, {});
    setArchiveTarget(null);
    setDrawerOpen(false);
    await fetchProductLines();
  };

  const handleRestore = async (id: string) => {
    await api.post(`/api/v1/product-lines/${id}/restore`, {});
    setDrawerOpen(false);
    await fetchProductLines();
  };

  const archiveWarning = archiveTarget && archiveTarget.variety_count > 0
    ? `This product line has ${archiveTarget.variety_count} variet${archiveTarget.variety_count !== 1 ? "ies" : "y"}. Archiving it will hide them from the active varieties list.`
    : undefined;

  return (
    <>
      <ProductLineTable
        productLines={productLines}
        activeView={activeView}
        onViewChange={setActiveView}
        onRowClick={handleRowClick}
        onAddClick={handleAddClick}
      />

      <ProductLineDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        productLine={selectedProductLine}
        dropdownOptions={dropdownOptions}
        onSave={handleSave}
        onArchive={handleArchiveRequest}
        onRestore={handleRestore}
      />

      <ProductArchiveDialog
        open={archiveTarget !== null}
        entityName={archiveTarget?.name ?? ""}
        entityType="product line"
        warningText={archiveWarning}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}
