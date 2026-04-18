import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, RotateCcw, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SalesItem } from "@/types";

interface SalesItemListProps {
  salesItems: SalesItem[];
  varietyId: string;
  readOnly: boolean;
  onCreate: (data: { name: string; stems_per_order: number; retail_price: string }) => Promise<void>;
  onUpdate: (id: string, data: { name?: string; stems_per_order?: number; retail_price?: string }) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
}

interface EditState {
  name: string;
  stems_per_order: string;
  retail_price: string;
}

export function SalesItemList({
  salesItems,
  readOnly,
  onCreate,
  onUpdate,
  onArchive,
  onRestore,
}: SalesItemListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditState>({ name: "", stems_per_order: "", retail_price: "" });
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<EditState>({ name: "", stems_per_order: "", retail_price: "" });
  const [showArchived, setShowArchived] = useState(false);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeItems = salesItems.filter((si) => si.is_active);
  const archivedItems = salesItems.filter((si) => !si.is_active);

  const startEdit = (item: SalesItem) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      stems_per_order: String(item.stems_per_order),
      retail_price: item.retail_price,
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.name.trim()) {
      setError("Name cannot be empty");
      return;
    }
    const stems = parseInt(editForm.stems_per_order, 10);
    if (isNaN(stems) || stems <= 0) {
      setError("Stems must be a positive number");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onUpdate(editingId, {
        name: editForm.name.trim(),
        stems_per_order: stems,
        retail_price: editForm.retail_price,
      });
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const startAdd = () => {
    setAdding(true);
    setAddForm({ name: "", stems_per_order: "", retail_price: "" });
    setError(null);
  };

  const cancelAdd = () => {
    setAdding(false);
    setError(null);
  };

  const saveAdd = async () => {
    if (!addForm.name.trim()) {
      setError("Name cannot be empty");
      return;
    }
    const stems = parseInt(addForm.stems_per_order, 10);
    if (isNaN(stems) || stems <= 0) {
      setError("Stems must be a positive number");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        name: addForm.name.trim(),
        stems_per_order: stems,
        retail_price: addForm.retail_price || "0.00",
      });
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveClick = (item: SalesItem) => {
    if (item.customer_prices_count > 0) {
      setArchiveConfirmId(item.id);
    } else {
      onArchive(item.id);
    }
  };

  const confirmArchive = async () => {
    if (!archiveConfirmId) return;
    await onArchive(archiveConfirmId);
    setArchiveConfirmId(null);
  };

  const archiveTarget = salesItems.find((si) => si.id === archiveConfirmId);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
          Sales Items
        </div>
        {!readOnly && (
          <button
            className="text-xs text-rose-action hover:underline"
            onClick={startAdd}
            disabled={adding}
          >
            + Add
          </button>
        )}
      </div>

      {/* Archive confirmation inline */}
      {archiveConfirmId && archiveTarget && (
        <div className="mb-2 p-2 bg-box-pink-bg border border-pink-300 rounded text-xs text-box-pink-text">
          <p className="font-medium">
            This sales item has {archiveTarget.customer_prices_count} customer price{archiveTarget.customer_prices_count !== 1 ? "s" : ""}. Archive it?
          </p>
          <div className="flex gap-2 mt-1.5">
            <Button
              size="sm"
              className="bg-rose-action hover:bg-rose-action/90 text-white text-xs h-6 px-2"
              onClick={confirmArchive}
            >
              Archive
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={() => setArchiveConfirmId(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      <div className="rounded border border-border-warm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-warm bg-cream-warm">
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-slate-heading">Name</th>
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-slate-heading w-16">Stems</th>
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-slate-heading w-20">Retail $</th>
              {!readOnly && (
                <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-slate-heading w-16">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {activeItems.length === 0 && !adding && (
              <tr>
                <td colSpan={readOnly ? 3 : 4} className="px-2 py-4 text-center text-text-muted">
                  No sales items
                </td>
              </tr>
            )}
            {activeItems.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <tr key={item.id} className="border-b border-border-warm">
                  {isEditing ? (
                    <>
                      <td className="px-2 py-1">
                        <Input
                          className="h-7 text-xs border-rose-action"
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-7 text-xs border-rose-action w-14"
                          type="number"
                          value={editForm.stems_per_order}
                          onChange={(e) => setEditForm((f) => ({ ...f, stems_per_order: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-7 text-xs border-rose-action w-18"
                          value={editForm.retail_price}
                          onChange={(e) => setEditForm((f) => ({ ...f, retail_price: e.target.value }))}
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="text-sidebar-hover hover:text-sidebar"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={cancelEdit} className="text-text-muted hover:text-text-body">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-1.5 text-text-body">
                        <div>{item.name}</div>
                        {item.customer_prices_count > 0 && (
                          <div className="text-[10px] text-text-muted">
                            {item.customer_prices_count} customer price{item.customer_prices_count !== 1 ? "s" : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-text-body">{item.stems_per_order}</td>
                      <td className="px-2 py-1.5 text-text-body">${item.retail_price}</td>
                      {!readOnly && (
                        <td className="px-2 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEdit(item)}
                              className="text-text-muted hover:text-text-body"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchiveClick(item)}
                              className="text-text-muted hover:text-rose-action"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              );
            })}

            {/* Add row */}
            {adding && (
              <tr className="border-b border-border-warm">
                <td className="px-2 py-1">
                  <Input
                    className="h-7 text-xs border-rose-action"
                    placeholder="Name"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    className="h-7 text-xs border-rose-action w-14"
                    type="number"
                    placeholder="10"
                    value={addForm.stems_per_order}
                    onChange={(e) => setAddForm((f) => ({ ...f, stems_per_order: e.target.value }))}
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    className="h-7 text-xs border-rose-action w-18"
                    placeholder="0.00"
                    value={addForm.retail_price}
                    onChange={(e) => setAddForm((f) => ({ ...f, retail_price: e.target.value }))}
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={saveAdd}
                      disabled={saving}
                      className="text-sidebar-hover hover:text-sidebar"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={cancelAdd} className="text-text-muted hover:text-text-body">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Archived toggle */}
      {archivedItems.length > 0 && (
        <div className="mt-2">
          <button
            className="text-xs text-text-muted hover:text-text-body hover:underline"
            onClick={() => setShowArchived((prev) => !prev)}
          >
            {showArchived ? "Hide" : "Show"} archived ({archivedItems.length})
          </button>
          {showArchived && (
            <div className="mt-1 rounded border border-border-warm overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {archivedItems.map((item) => (
                    <tr key={item.id} className={cn("border-b border-border-warm opacity-60")}>
                      <td className="px-2 py-1.5 text-text-muted">{item.name}</td>
                      <td className="px-2 py-1.5 text-text-muted w-16">{item.stems_per_order}</td>
                      <td className="px-2 py-1.5 text-text-muted w-20">${item.retail_price}</td>
                      <td className="px-2 py-1.5 text-right w-16">
                        <button
                          onClick={() => onRestore(item.id)}
                          className="text-sidebar-hover hover:text-sidebar"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
