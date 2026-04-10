import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { ColorTable } from "@/components/product/ColorTable";
import { ColorDrawer } from "@/components/product/ColorDrawer";
import { ProductArchiveDialog } from "@/components/product/ProductArchiveDialog";
import type { Color, ColorCreateRequest } from "@/types";

export function ColorsPage() {
  const [colors, setColors] = useState<Color[]>([]);
  const [activeView, setActiveView] = useState<"active" | "archived">("active");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "add">("edit");
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Color | null>(null);

  const fetchColors = useCallback(async () => {
    const data = await api.get<Color[]>(
      `/api/v1/colors?active=${activeView === "active"}`
    );
    setColors(data);
  }, [activeView]);

  useEffect(() => {
    fetchColors();
  }, [fetchColors]);

  const handleRowClick = (color: Color) => {
    setSelectedColor(color);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const handleAddClick = () => {
    setSelectedColor(null);
    setDrawerMode("add");
    setDrawerOpen(true);
  };

  const handleSave = async (data: ColorCreateRequest) => {
    if (drawerMode === "add") {
      await api.post("/api/v1/colors", data);
    } else if (selectedColor) {
      await api.patch(`/api/v1/colors/${selectedColor.id}`, data);
    }
    await fetchColors();
  };

  const handleArchiveRequest = (id: string) => {
    const color = colors.find((c) => c.id === id);
    if (color) setArchiveTarget(color);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    await api.post(`/api/v1/colors/${archiveTarget.id}/archive`, {});
    setArchiveTarget(null);
    setDrawerOpen(false);
    await fetchColors();
  };

  const handleRestore = async (id: string) => {
    await api.post(`/api/v1/colors/${id}/restore`, {});
    setDrawerOpen(false);
    await fetchColors();
  };

  return (
    <>
      <ColorTable
        colors={colors}
        activeView={activeView}
        onViewChange={setActiveView}
        onRowClick={handleRowClick}
        onAddClick={handleAddClick}
      />

      <ColorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        color={selectedColor}
        onSave={handleSave}
        onArchive={handleArchiveRequest}
        onRestore={handleRestore}
      />

      <ProductArchiveDialog
        open={archiveTarget !== null}
        entityName={archiveTarget?.name ?? ""}
        entityType="color"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}
