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
import type { Color, ColorCreateRequest } from "@/types";

interface ColorDrawerProps {
  open: boolean;
  onClose: () => void;
  mode: "edit" | "add";
  color: Color | null;
  onSave: (data: ColorCreateRequest) => Promise<void>;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
}

export function ColorDrawer({
  open,
  onClose,
  mode,
  color,
  onSave,
  onArchive,
  onRestore,
}: ColorDrawerProps) {
  const [form, setForm] = useState({
    name: "",
    hex_color: "#000000",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isArchived = color ? !color.is_active : false;
  const isReadOnly = mode === "edit" && isArchived;

  useEffect(() => {
    if (mode === "edit" && color) {
      setForm({
        name: color.name,
        hex_color: color.hex_color ?? "#000000",
      });
    } else if (mode === "add") {
      setForm({ name: "", hex_color: "#000000" });
    }
    setError(null);
  }, [mode, color, open]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Name cannot be empty");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        hex_color: form.hex_color || null,
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
        <SheetHeader className="px-5 py-4 border-b border-[#e0ddd8]">
          <div>
            <SheetTitle className="text-[#1e3a5f]">
              {mode === "add" ? "New Color" : "Edit Color"}
            </SheetTitle>
            {mode === "edit" && color && (
              <SheetDescription className="text-xs mt-0.5">
                {color.name}
              </SheetDescription>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-[#1e3a5f]">Name *</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={isReadOnly}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-[#1e3a5f]">Hex Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                className="h-8 text-sm flex-1"
                value={form.hex_color}
                onChange={(e) => setForm((f) => ({ ...f, hex_color: e.target.value }))}
                disabled={isReadOnly}
                placeholder="#000000"
              />
              <input
                type="color"
                value={form.hex_color || "#000000"}
                onChange={(e) => setForm((f) => ({ ...f, hex_color: e.target.value }))}
                disabled={isReadOnly}
                className="h-8 w-8 rounded border border-[#e0ddd8] cursor-pointer p-0"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-[#e0ddd8] bg-[#faf8f5]">
          {mode === "edit" && color && !isArchived && (
            <Button
              variant="outline"
              size="sm"
              className="text-[#c27890] border-[#fce7f3] hover:bg-[#fce7f3] text-xs mr-auto"
              onClick={() => onArchive(color.id)}
            >
              Archive
            </Button>
          )}
          {mode === "edit" && color && isArchived && (
            <Button
              variant="outline"
              size="sm"
              className="text-[#2d4a2d] border-[#e8f0e8] hover:bg-[#e8f0e8] text-xs mr-auto"
              onClick={() => onRestore(color.id)}
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
                className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : mode === "add" ? "Create Color" : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
