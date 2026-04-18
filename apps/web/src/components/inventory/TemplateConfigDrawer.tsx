import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { GripVertical, Trash2, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CountSheetTemplateResponse,
  TemplateColumnInput,
} from "@/types/inventory";

interface Customer {
  id: string;
  name: string;
}

interface ColumnItem {
  customer_id: string;
  customer_name: string;
  bunch_size: number;
  sleeve_type: string;
}

interface TemplateConfigDrawerProps {
  productTypeId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function TemplateConfigDrawer({
  productTypeId,
  isOpen,
  onClose,
  onSave,
}: TemplateConfigDrawerProps) {
  const [columns, setColumns] = useState<ColumnItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  // New column form state
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newBunchSize, setNewBunchSize] = useState("");
  const [newSleeveType, setNewSleeveType] = useState("Plastic");

  // Drag state
  const dragIdxRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!productTypeId) return;
    setLoading(true);
    try {
      const [tmpl, custs] = await Promise.all([
        api.get<CountSheetTemplateResponse>(
          `/api/v1/count-sheet-templates/${productTypeId}`
        ),
        api.get<Customer[]>("/api/v1/customers"),
      ]);
      setColumns(
        tmpl.columns.map((c) => ({
          customer_id: c.customer_id,
          customer_name: c.customer_name,
          bunch_size: c.bunch_size,
          sleeve_type: c.sleeve_type,
        }))
      );
      setCustomers(custs);
    } catch (err) {
      console.error("Failed to fetch template config:", err);
    } finally {
      setLoading(false);
    }
  }, [productTypeId]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setConfirmDeleteIdx(null);
    }
  }, [isOpen, fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: { columns: TemplateColumnInput[] } = {
        columns: columns.map((c) => ({
          customer_id: c.customer_id,
          bunch_size: c.bunch_size,
          sleeve_type: c.sleeve_type,
        })),
      };
      await api.put(
        `/api/v1/count-sheet-templates/${productTypeId}`,
        payload
      );
      onSave();
      onClose();
    } catch (err) {
      console.error("Failed to save template:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddColumn = () => {
    const bunchSize = parseInt(newBunchSize, 10);
    if (!newCustomerId || !newBunchSize || isNaN(bunchSize) || bunchSize < 1 || bunchSize > 100) return;
    const cust = customers.find((c) => c.id === newCustomerId);
    if (!cust) return;
    setColumns((prev) => [
      ...prev,
      {
        customer_id: newCustomerId,
        customer_name: cust.name,
        bunch_size: bunchSize,
        sleeve_type: newSleeveType,
      },
    ]);
    setNewCustomerId("");
    setNewBunchSize("");
    setNewSleeveType("Plastic");
  };

  const handleRemoveColumn = (idx: number) => {
    setColumns((prev) => prev.filter((_, i) => i !== idx));
    setConfirmDeleteIdx(null);
  };

  // Drag-to-reorder handlers
  const handleDragStart = (idx: number) => {
    dragIdxRef.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    const fromIdx = dragIdxRef.current;
    if (fromIdx === null || fromIdx === idx) {
      setDragOverIdx(null);
      dragIdxRef.current = null;
      return;
    }
    setColumns((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragOverIdx(null);
    dragIdxRef.current = null;
  };

  const handleDragEnd = () => {
    setDragOverIdx(null);
    dragIdxRef.current = null;
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-slate-heading">
            Specials Column Configuration
          </SheetTitle>
          <SheetDescription>
            Drag to reorder. Add or remove customer-bunch columns for the count sheet.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading...
            </div>
          ) : (
            <>
              {/* Column list */}
              <div className="space-y-1">
                {columns.map((col, idx) => (
                  <div
                    key={`${col.customer_id}-${col.bunch_size}-${col.sleeve_type}-${idx}`}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border bg-white px-3 py-2 transition-colors cursor-grab active:cursor-grabbing",
                      dragOverIdx === idx
                        ? "border-rose-action bg-rose-action/5"
                        : "border-border-warm"
                    )}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 text-text-muted" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-body truncate">
                        {col.customer_name}
                      </div>
                      <div className="text-xs text-text-muted">
                        {col.bunch_size}-stem / {col.sleeve_type}
                      </div>
                    </div>

                    {confirmDeleteIdx === idx ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveColumn(idx)}
                          className="text-red-600 border-red-300 hover:bg-red-50 text-xs h-8"
                        >
                          Remove
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmDeleteIdx(null)}
                          className="text-text-muted border-border-warm text-xs h-8"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteIdx(idx)}
                        className="shrink-0 p-2 rounded-md text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove column"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}

                {columns.length === 0 && (
                  <div className="text-center py-6 text-sm text-text-muted">
                    No columns configured yet. Add one below.
                  </div>
                )}
              </div>

              {/* Add column form */}
              <div className="rounded-lg border border-dashed border-border-warm bg-cream p-3 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-heading">
                  Add Column
                </h4>
                <div className="space-y-2">
                  <select
                    value={newCustomerId}
                    onChange={(e) => setNewCustomerId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border-warm bg-white px-3 text-sm text-text-body focus:ring-2 focus:ring-rose-action focus:outline-none"
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      value={newBunchSize}
                      onChange={(e) => setNewBunchSize(e.target.value)}
                      placeholder="Bunch size"
                      className="flex-1 h-10 text-sm"
                    />
                    <select
                      value={newSleeveType}
                      onChange={(e) => setNewSleeveType(e.target.value)}
                      className="h-10 rounded-lg border border-border-warm bg-white px-3 text-sm text-text-body focus:ring-2 focus:ring-rose-action focus:outline-none"
                    >
                      <option value="Plastic">Plastic</option>
                      <option value="Paper">Paper</option>
                    </select>
                  </div>
                  <Button
                    onClick={handleAddColumn}
                    disabled={!newCustomerId || !newBunchSize}
                    className="w-full bg-rose-action hover:bg-rose-action/90 text-white disabled:bg-border-warm disabled:text-text-muted"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Column
                  </Button>
                </div>
              </div>

              {confirmDeleteIdx !== null && (
                <p className="text-xs text-text-muted italic text-center">
                  Historical data for removed columns is preserved and will not be deleted.
                </p>
              )}
            </>
          )}
        </div>

        <SheetFooter>
          <div className="flex items-center gap-2 w-full">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-border-warm text-text-body"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-rose-action hover:bg-rose-action/90 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
