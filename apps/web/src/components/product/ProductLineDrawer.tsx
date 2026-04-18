import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductLine, ProductLineCreateRequest } from "@/types";

interface ProductLineDropdownOptions {
  product_types: { id: string; name: string }[];
}

interface ProductLineDrawerProps {
  open: boolean;
  onClose: () => void;
  mode: "edit" | "add";
  productLine: ProductLine | null;
  dropdownOptions: ProductLineDropdownOptions;
  onSave: (data: ProductLineCreateRequest) => Promise<void>;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
}

export function ProductLineDrawer({
  open,
  onClose,
  mode,
  productLine,
  dropdownOptions,
  onSave,
  onArchive,
  onRestore,
}: ProductLineDrawerProps) {
  const [form, setForm] = useState({
    name: "",
    product_type_id: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isArchived = productLine ? !productLine.is_active : false;
  const isReadOnly = mode === "edit" && isArchived;

  useEffect(() => {
    if (mode === "edit" && productLine) {
      setForm({
        name: productLine.name,
        product_type_id: productLine.product_type_id,
      });
    } else if (mode === "add") {
      setForm({ name: "", product_type_id: "" });
    }
    setError(null);
  }, [mode, productLine, open]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Name cannot be empty");
      return;
    }
    if (!form.product_type_id) {
      setError("Product type is required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        product_type_id: form.product_type_id,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[520px] flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b border-border-warm">
          <div>
            <SheetTitle className="text-slate-heading">
              {mode === "add" ? "New Product Line" : "Edit Product Line"}
            </SheetTitle>
            {mode === "edit" && productLine && (
              <SheetDescription className="text-xs mt-0.5">
                {productLine.product_type_name} &middot; {productLine.name}
              </SheetDescription>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-heading">Name *</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={isReadOnly}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-heading">Product Type *</Label>
            {dropdownOptions.product_types.length === 0 ? (
              <div className="mt-1 px-3 py-1.5 bg-cream border border-border-warm rounded-md text-sm text-text-muted">
                Loading...
              </div>
            ) : (
              <Select
                key={dropdownOptions.product_types.length}
                value={form.product_type_id || "__none__"}
                onValueChange={(v) => setForm((f) => ({ ...f, product_type_id: v === "__none__" ? "" : v }))}
                disabled={isReadOnly}
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  {form.product_type_id ? (
                    <span>
                      {dropdownOptions.product_types.find((pt) => pt.id === form.product_type_id)?.name ?? "Select product type"}
                    </span>
                  ) : (
                    <SelectValue placeholder="Select product type" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {dropdownOptions.product_types.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {mode === "edit" && productLine && (
            <div className="mt-2 px-3 py-2 bg-cream border border-border-warm rounded-md text-sm text-text-muted">
              Varieties in this line: {productLine.variety_count}
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-border-warm bg-cream-warm">
          {mode === "edit" && productLine && !isArchived && (
            <Button
              variant="outline"
              size="sm"
              className="text-rose-action border-box-pink-bg hover:bg-box-pink-bg text-xs mr-auto"
              onClick={() => onArchive(productLine.id)}
            >
              Archive
            </Button>
          )}
          {mode === "edit" && productLine && isArchived && (
            <Button
              variant="outline"
              size="sm"
              className="text-sidebar-hover border-box-green-bg hover:bg-box-green-bg text-xs mr-auto"
              onClick={() => onRestore(productLine.id)}
            >
              Restore
            </Button>
          )}
          {!isReadOnly && (
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-action hover:bg-rose-action/90 text-white text-xs"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : mode === "add" ? "Create Product Line" : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
