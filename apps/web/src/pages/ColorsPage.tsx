import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { ColorTable } from "@/components/product/ColorTable";
import { ColorDrawer } from "@/components/product/ColorDrawer";
import { ProductArchiveDialog } from "@/components/product/ProductArchiveDialog";
import type { VarietyColor, VarietyColorCreateRequest, Variety } from "@/types";

export function ColorsPage() {
  const [colors, setColors] = useState<VarietyColor[]>([]);
  const [varieties, setVarieties] = useState<{ id: string; name: string; hex_color: string | null }[]>([]);
  const [activeView, setActiveView] = useState<"active" | "archived">("active");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "add">("edit");
  const [selectedColor, setSelectedColor] = useState<VarietyColor | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<VarietyColor | null>(null);

  const fetchColors = useCallback(async () => {
    const data = await api.get<VarietyColor[]>(
      `/api/v1/variety-colors?active=${activeView === "active"}`
    );
    setColors(data);
  }, [activeView]);

  const fetchVarieties = useCallback(async () => {
    const data = await api.get<Variety[]>("/api/v1/varieties?active=true");
    setVarieties(data.map((v) => ({ id: v.id, name: v.name, hex_color: v.hex_color })));
  }, []);

  useEffect(() => {
    fetchColors();
  }, [fetchColors]);

  useEffect(() => {
    fetchVarieties();
  }, [fetchVarieties]);

  // Build a hex color lookup from variety_id to hex_color
  const varietyHexColors = varieties.reduce<Record<string, string>>((acc, v) => {
    if (v.hex_color) acc[v.id] = v.hex_color;
    return acc;
  }, {});

  const handleRowClick = (color: VarietyColor) => {
    setSelectedColor(color);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const handleAddClick = () => {
    setSelectedColor(null);
    setDrawerMode("add");
    setDrawerOpen(true);
  };

  const handleSave = async (data: VarietyColorCreateRequest | { color_name: string }) => {
    if (drawerMode === "add") {
      await api.post("/api/v1/variety-colors", data);
    } else if (selectedColor) {
      await api.patch(`/api/v1/variety-colors/${selectedColor.id}`, data);
    }
    await fetchColors();
  };

  const handleArchiveRequest = (id: string) => {
    const color = colors.find((c) => c.id === id);
    if (color) setArchiveTarget(color);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    await api.post(`/api/v1/variety-colors/${archiveTarget.id}/archive`, {});
    setArchiveTarget(null);
    setDrawerOpen(false);
    await fetchColors();
  };

  const handleRestore = async (id: string) => {
    await api.post(`/api/v1/variety-colors/${id}/restore`, {});
    setDrawerOpen(false);
    await fetchColors();
  };

  return (
    <>
      <ColorTable
        colors={colors}
        varietyHexColors={varietyHexColors}
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
        varieties={varieties}
        onSave={handleSave}
        onArchive={handleArchiveRequest}
        onRestore={handleRestore}
      />

      <ProductArchiveDialog
        open={archiveTarget !== null}
        entityName={archiveTarget?.color_name ?? ""}
        entityType="color"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}
