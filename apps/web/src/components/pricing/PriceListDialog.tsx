import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import type { PriceList } from "@/types";

// ── Create Dialog ─────────────────────────────────────────────

interface PriceListCreateDialogProps {
  open: boolean;
  onClose: () => void;
  existingLists: PriceList[];
  onCreate: (name: string, copyFrom: string | null) => Promise<void>;
}

export function PriceListCreateDialog({
  open,
  onClose,
  existingLists,
  onCreate,
}: PriceListCreateDialogProps) {
  const [name, setName] = useState("");
  const [copyFrom, setCopyFrom] = useState<string>("retail");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate(name.trim(), copyFrom === "retail" ? null : copyFrom);
      setName("");
      setCopyFrom("retail");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-slate-heading">Add Price List</DialogTitle>
          <DialogDescription>
            Create a new price list with prices copied from an existing source.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-heading">
              Name *
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Wholesale Medium"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-heading">
              Copy prices from
            </Label>
            <Select value={copyFrom} onValueChange={setCopyFrom}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Retail</SelectItem>
                {existingLists.map((pl) => (
                  <SelectItem key={pl.id} value={pl.id}>
                    {pl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
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
              className="bg-rose-action hover:bg-rose-action/90 text-white text-xs"
              onClick={handleCreate}
              disabled={!name.trim() || saving}
            >
              {saving ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Header Popover (rename / archive) ─────────────────────────

interface PriceListHeaderPopoverProps {
  priceList: PriceList;
  onRename: (id: string, newName: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  children: React.ReactNode;
}

export function PriceListHeaderPopover({
  priceList,
  onRename,
  onArchive,
  children,
}: PriceListHeaderPopoverProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(priceList.name);
  const [open, setOpen] = useState(false);

  const handleRename = async () => {
    if (name.trim() && name.trim() !== priceList.name) {
      await onRename(priceList.id, name.trim());
    }
    setEditing(false);
  };

  const handleArchive = async () => {
    await onArchive(priceList.id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="center">
        {editing ? (
          <div className="space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-7 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={handleRename}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <button
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-cream text-text-body"
              onClick={() => {
                setName(priceList.name);
                setEditing(true);
              }}
            >
              Rename
            </button>
            <button
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-box-pink-bg text-red-600"
              onClick={handleArchive}
            >
              Archive
              {priceList.customer_count > 0 && (
                <span className="text-xs text-text-muted block">
                  {priceList.customer_count} customer
                  {priceList.customer_count !== 1 ? "s" : ""} will be converted
                </span>
              )}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
