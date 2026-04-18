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
import type { ProductType, ProductTypeCreateRequest } from "@/types";

interface ProductTypeDrawerProps {
  open: boolean;
  onClose: () => void;
  mode: "edit" | "add";
  productType: ProductType | null;
  onSave: (data: ProductTypeCreateRequest) => Promise<void>;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
}

export function ProductTypeDrawer({
  open,
  onClose,
  mode,
  productType,
  onSave,
  onArchive,
  onRestore,
}: ProductTypeDrawerProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isArchived = productType ? !productType.is_active : false;
  const isReadOnly = mode === "edit" && isArchived;

  useEffect(() => {
    if (mode === "edit" && productType) {
      setName(productType.name);
    } else if (mode === "add") {
      setName("");
    }
    setError(null);
  }, [mode, productType, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name cannot be empty");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({ name: name.trim() });
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
              {mode === "add" ? "New Product Type" : "Edit Product Type"}
            </SheetTitle>
            {mode === "edit" && productType && (
              <SheetDescription className="text-xs mt-0.5">
                {productType.name}
              </SheetDescription>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-heading">Name *</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isReadOnly}
            />
          </div>

          {mode === "edit" && productType && (
            <div className="mt-2 px-3 py-2 bg-cream border border-border-warm rounded-md text-sm text-text-muted">
              Product lines in this type: {productType.product_line_count}
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-border-warm bg-cream-warm">
          {mode === "edit" && productType && !isArchived && (
            <Button
              variant="outline"
              size="sm"
              className="text-rose-action border-box-pink-bg hover:bg-box-pink-bg text-xs mr-auto"
              onClick={() => onArchive(productType.id)}
            >
              Archive
            </Button>
          )}
          {mode === "edit" && productType && isArchived && (
            <Button
              variant="outline"
              size="sm"
              className="text-sidebar-hover border-box-green-bg hover:bg-box-green-bg text-xs mr-auto"
              onClick={() => onRestore(productType.id)}
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
                {saving ? "Saving..." : mode === "add" ? "Create Product Type" : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
