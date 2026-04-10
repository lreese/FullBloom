import { useState, useEffect, useMemo } from "react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, Search } from "lucide-react";
import type { VarietyColor, VarietyColorCreateRequest } from "@/types";

interface ColorDrawerVariety {
  id: string;
  name: string;
}

interface ColorDrawerProps {
  open: boolean;
  onClose: () => void;
  mode: "edit" | "add";
  color: VarietyColor | null;
  varieties: ColorDrawerVariety[];
  onSave: (data: VarietyColorCreateRequest | { color_name: string }) => Promise<void>;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
}

export function ColorDrawer({
  open,
  onClose,
  mode,
  color,
  varieties,
  onSave,
  onArchive,
  onRestore,
}: ColorDrawerProps) {
  const [form, setForm] = useState({
    variety_id: "",
    color_name: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isArchived = color ? !color.is_active : false;
  const isReadOnly = mode === "edit" && isArchived;

  useEffect(() => {
    if (mode === "edit" && color) {
      setForm({
        variety_id: color.variety_id,
        color_name: color.color_name,
      });
    } else if (mode === "add") {
      setForm({ variety_id: "", color_name: "" });
    }
    setError(null);
  }, [mode, color, open]);

  const handleSave = async () => {
    if (!form.color_name.trim()) {
      setError("Color name cannot be empty");
      return;
    }
    if (mode === "add" && !form.variety_id) {
      setError("Variety is required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (mode === "add") {
        await onSave({
          variety_id: form.variety_id,
          color_name: form.color_name.trim(),
        });
      } else {
        await onSave({
          color_name: form.color_name.trim(),
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const [varietySearch, setVarietySearch] = useState("");
  const [varietyPopoverOpen, setVarietyPopoverOpen] = useState(false);

  const filteredVarieties = useMemo(() => {
    if (!varietySearch) return varieties;
    const term = varietySearch.toLowerCase();
    return varieties.filter((v) => v.name.toLowerCase().includes(term));
  }, [varieties, varietySearch]);

  const selectedVarietyName = varieties.find((v) => v.id === form.variety_id)?.name;

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
                {color.variety_name} &middot; {color.color_name}
              </SheetDescription>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-[#1e3a5f]">Variety *</Label>
            {mode === "edit" ? (
              <div className="mt-1 px-3 py-1.5 bg-[#f4f1ec] border border-[#e0ddd8] rounded-md text-sm text-[#94a3b8]">
                {color?.variety_name}
              </div>
            ) : (
              <Popover open={varietyPopoverOpen} onOpenChange={setVarietyPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="mt-1 flex items-center justify-between w-full px-3 py-1.5 h-8 text-sm border border-[#e0ddd8] rounded-md bg-white text-left hover:bg-[#faf8f5] transition-colors"
                  >
                    <span className={selectedVarietyName ? "text-[#334155]" : "text-[#94a3b8]"}>
                      {selectedVarietyName || "Search varieties..."}
                    </span>
                    <ChevronDown className="h-3 w-3 text-[#94a3b8]" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="p-2 border-b border-[#e0ddd8]">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#94a3b8]" />
                      <Input
                        placeholder="Search varieties..."
                        className="pl-7 h-7 text-xs"
                        value={varietySearch}
                        onChange={(e) => setVarietySearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredVarieties.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-[#94a3b8]">No varieties found</div>
                    ) : (
                      filteredVarieties.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-xs text-[#334155] hover:bg-[#f4f1ec] transition-colors"
                          onClick={() => {
                            setForm((f) => ({ ...f, variety_id: v.id }));
                            setVarietyPopoverOpen(false);
                            setVarietySearch("");
                          }}
                        >
                          {v.name}
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-[#1e3a5f]">Color Name *</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={form.color_name}
              onChange={(e) => setForm((f) => ({ ...f, color_name: e.target.value }))}
              disabled={isReadOnly}
            />
          </div>

          <p className="text-xs text-[#94a3b8]">
            Hex colors are managed on the variety, not here.
          </p>

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
