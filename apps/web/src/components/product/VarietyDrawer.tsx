import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SalesItemList } from "./SalesItemList";
import type {
  Variety,
  VarietyCreateRequest,
  VarietyUpdateRequest,
  VarietyDropdownOptions,
  SalesItem,
} from "@/types";

interface VarietyDrawerProps {
  open: boolean;
  onClose: () => void;
  mode: "edit" | "add";
  variety: Variety | null;
  salesItems: SalesItem[];
  dropdownOptions: VarietyDropdownOptions;
  onSave: (data: VarietyCreateRequest | VarietyUpdateRequest) => Promise<void>;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onSalesItemCreate: (varietyId: string, data: { name: string; stems_per_order: number; retail_price: string }) => Promise<void>;
  onSalesItemUpdate: (id: string, data: { name?: string; stems_per_order?: number; retail_price?: string }) => Promise<void>;
  onSalesItemArchive: (id: string) => Promise<void>;
  onSalesItemRestore: (id: string) => Promise<void>;
}

export function VarietyDrawer({
  open,
  onClose,
  mode,
  variety,
  salesItems,
  dropdownOptions,
  onSave,
  onArchive,
  onRestore,
  onSalesItemCreate,
  onSalesItemUpdate,
  onSalesItemArchive,
  onSalesItemRestore,
}: VarietyDrawerProps) {
  const [form, setForm] = useState({
    name: "",
    product_line_id: "",
    color: "",
    hex_color: "#000000",
    flowering_type: "",
    weekly_sales_category: "",
    show: true,
    can_replace: false,
    item_group_id: "",
    item_group_description: "",
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isArchived = variety ? !variety.is_active : false;
  const isReadOnly = mode === "edit" && isArchived;

  useEffect(() => {
    if (mode === "edit" && variety) {
      setForm({
        name: variety.name,
        product_line_id: variety.product_line_id,
        color: variety.color ?? "",
        hex_color: variety.hex_color ?? "#000000",
        flowering_type: variety.flowering_type ?? "",
        weekly_sales_category: variety.weekly_sales_category ?? "",
        show: variety.show,
        can_replace: variety.can_replace,
        item_group_id: variety.item_group_id != null ? String(variety.item_group_id) : "",
        item_group_description: variety.item_group_description ?? "",
      });
      setAdvancedOpen(false);
    } else if (mode === "add") {
      setForm({
        name: "",
        product_line_id: "",
        color: "",
        hex_color: "#000000",
        flowering_type: "",
        weekly_sales_category: "",
        show: true,
        can_replace: false,
        item_group_id: "",
        item_group_description: "",
      });
      setAdvancedOpen(false);
    }
    setError(null);
  }, [mode, variety, open]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Name cannot be empty");
      return;
    }
    if (!form.product_line_id) {
      setError("Product line is required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (mode === "add") {
        const data: VarietyCreateRequest = {
          name: form.name.trim(),
          product_line_id: form.product_line_id,
          color: form.color || null,
          hex_color: form.hex_color || null,
          flowering_type: form.flowering_type || null,
          weekly_sales_category: form.weekly_sales_category || null,
          show: form.show,
          can_replace: form.can_replace,
          item_group_id: form.item_group_id ? parseInt(form.item_group_id, 10) : null,
          item_group_description: form.item_group_description || null,
        };
        await onSave(data);
      } else {
        const data: VarietyUpdateRequest = {
          name: form.name.trim(),
          product_line_id: form.product_line_id,
          color: form.color || null,
          hex_color: form.hex_color || null,
          flowering_type: form.flowering_type || null,
          weekly_sales_category: form.weekly_sales_category || null,
          show: form.show,
          can_replace: form.can_replace,
          item_group_id: form.item_group_id ? parseInt(form.item_group_id, 10) : null,
          item_group_description: form.item_group_description || null,
        };
        await onSave(data);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Group product lines by product type for the dropdown
  const groupedProductLines = dropdownOptions.product_lines.reduce<
    Record<string, { id: string; name: string }[]>
  >((acc, pl) => {
    if (!acc[pl.product_type]) acc[pl.product_type] = [];
    acc[pl.product_type].push({ id: pl.id, name: pl.name });
    return acc;
  }, {});

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[520px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-[#e0ddd8]">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-[#1e3a5f]">
                {mode === "add" ? "New Variety" : "Edit Variety"}
              </SheetTitle>
              {mode === "edit" && variety && (
                <SheetDescription className="text-xs mt-0.5">
                  {variety.product_line_name} &middot; {variety.name}
                </SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Identity */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
              Identity
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-[#1e3a5f]">Name *</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  disabled={isReadOnly}
                />
                {error && error.toLowerCase().includes("name") && (
                  <p className="text-xs text-red-500 mt-1">{error}</p>
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#1e3a5f]">Product Line *</Label>
                <Select
                  value={form.product_line_id || "__none__"}
                  onValueChange={(v) => setField("product_line_id", v === "__none__" ? "" : v)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue placeholder="Select product line" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {dropdownOptions.product_lines.map((pl) => (
                      <SelectItem key={pl.id} value={pl.id}>
                        {pl.product_type} &gt; {pl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {error && error.toLowerCase().includes("product line") && (
                  <p className="text-xs text-red-500 mt-1">{error}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <Label className="text-xs font-semibold text-[#1e3a5f]">Color</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={form.color}
                  onChange={(e) => setField("color", e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#1e3a5f]">Hex Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    className="h-8 text-sm flex-1"
                    value={form.hex_color}
                    onChange={(e) => setField("hex_color", e.target.value)}
                    disabled={isReadOnly}
                    placeholder="#000000"
                  />
                  <input
                    type="color"
                    value={form.hex_color || "#000000"}
                    onChange={(e) => setField("hex_color", e.target.value)}
                    disabled={isReadOnly}
                    className="h-8 w-8 rounded border border-[#e0ddd8] cursor-pointer p-0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Classification */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
              Classification
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-[#1e3a5f]">Flowering Type</Label>
                <Select
                  value={form.flowering_type || "__none__"}
                  onValueChange={(v) => setField("flowering_type", v === "__none__" ? "" : v)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {dropdownOptions.flowering_types.map((ft) => (
                      <SelectItem key={ft} value={ft}>{ft}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#1e3a5f]">Weekly Sales Category</Label>
                <Select
                  value={form.weekly_sales_category || "__none__"}
                  onValueChange={(v) => setField("weekly_sales_category", v === "__none__" ? "" : v)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {dropdownOptions.weekly_sales_categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.show}
                  onCheckedChange={(checked) => setField("show", !!checked)}
                  disabled={isReadOnly}
                />
                <span className="text-sm text-[#334155]">Show in Orders</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.can_replace}
                  onCheckedChange={(checked) => setField("can_replace", !!checked)}
                  disabled={isReadOnly}
                />
                <span className="text-sm text-[#334155]">Can Replace</span>
              </label>
            </div>
          </div>

          {/* Advanced (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] hover:text-[#334155] transition-colors"
            >
              <span style={{ transform: advancedOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms", display: "inline-block", fontSize: "8px" }}>▶</span>
              Advanced
            </button>
            {advancedOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <Label className="text-xs font-semibold text-[#1e3a5f]">Item Group ID</Label>
                  <Input
                    type="number"
                    className="mt-1 h-8 text-sm"
                    value={form.item_group_id}
                    onChange={(e) => setField("item_group_id", e.target.value)}
                    disabled={isReadOnly}
                    placeholder="e.g. 100"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-[#1e3a5f]">Item Group Description</Label>
                  <Input
                    className="mt-1 h-8 text-sm"
                    value={form.item_group_description}
                    onChange={(e) => setField("item_group_description", e.target.value)}
                    disabled={isReadOnly}
                    placeholder="e.g. Tulips Standard"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sales Items (edit mode only, with a variety id) */}
          {mode === "edit" && variety && (
            <SalesItemList
              salesItems={salesItems}
              varietyId={variety.id}
              readOnly={isReadOnly}
              onCreate={(data) => onSalesItemCreate(variety.id, data)}
              onUpdate={onSalesItemUpdate}
              onArchive={onSalesItemArchive}
              onRestore={onSalesItemRestore}
            />
          )}

          {/* General error */}
          {error && !error.toLowerCase().includes("name") && !error.toLowerCase().includes("product line") && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-[#e0ddd8] bg-[#faf8f5]">
          {mode === "edit" && variety && !isArchived && (
            <Button
              variant="outline"
              size="sm"
              className="text-[#c27890] border-[#fce7f3] hover:bg-[#fce7f3] text-xs mr-auto"
              onClick={() => onArchive(variety.id)}
            >
              Archive
            </Button>
          )}
          {mode === "edit" && variety && isArchived && (
            <Button
              variant="outline"
              size="sm"
              className="text-[#2d4a2d] border-[#e8f0e8] hover:bg-[#e8f0e8] text-xs mr-auto"
              onClick={() => onRestore(variety.id)}
            >
              Restore
            </Button>
          )}
          {!isReadOnly && (
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs"
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : mode === "add"
                    ? "Create Variety"
                    : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
