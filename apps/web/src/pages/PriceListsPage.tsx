import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/services/api";
import { PriceListMatrix } from "@/components/pricing/PriceListMatrix";
import {
  PriceListCreateDialog,
  PriceListHeaderPopover,
} from "@/components/pricing/PriceListDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PriceList,
  PriceListMatrixRow,
  PriceListMatrixData,
  ImpactPreview,
  BulkPriceListItemRequest,
} from "@/types";

export function PriceListsPage() {
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [items, setItems] = useState<PriceListMatrixRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importPriceListId, setImportPriceListId] = useState("");
  const importFileRef = useRef<HTMLInputElement>(null);

  // Bulk action state
  const [bulkPriceListId, setBulkPriceListId] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");

  const fetchMatrix = useCallback(async () => {
    const data = await api.get<PriceListMatrixData>(
      "/api/v1/price-lists/matrix"
    );
    setPriceLists(data.price_lists);
    setItems(data.items);
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const handleCellSave = async (
    priceListId: string | null,
    salesItemId: string,
    newPrice: string
  ) => {
    if (priceListId === null) {
      // Retail price edit
      await api.patch("/api/v1/price-lists/matrix/retail", {
        sales_item_id: salesItemId,
        price: newPrice,
      });
    } else {
      await api.patch(
        `/api/v1/price-list-items/${priceListId}/${salesItemId}`,
        { price: newPrice }
      );
    }
    await fetchMatrix();
  };

  const handleFetchImpact = async (
    priceListId: string,
    salesItemId: string,
    newPrice: string
  ): Promise<ImpactPreview> => {
    return api.get<ImpactPreview>(
      `/api/v1/price-list-items/${priceListId}/${salesItemId}/impact?new_price=${newPrice}`
    );
  };

  const handleCreate = async (name: string, copyFrom: string | null) => {
    await api.post("/api/v1/price-lists", { name, copy_from: copyFrom });
    await fetchMatrix();
  };

  const handleRename = async (id: string, newName: string) => {
    await api.patch(`/api/v1/price-lists/${id}`, { name: newName });
    await fetchMatrix();
  };

  const handleArchive = async (id: string) => {
    await api.post(`/api/v1/price-lists/${id}/archive`, {});
    await fetchMatrix();
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.sales_item_id)));
    }
  };

  const handleBulkApply = async () => {
    if (!bulkPriceListId || !bulkPrice || selectedIds.size === 0) return;
    const body: BulkPriceListItemRequest = {
      price_list_id: bulkPriceListId,
      sales_item_ids: Array.from(selectedIds),
      price: bulkPrice,
    };
    await api.patch("/api/v1/price-list-items/bulk", body);
    setSelectedIds(new Set());
    setBulkPrice("");
    await fetchMatrix();
  };

  const handleHeaderClick = (priceList: PriceList) => {
    // Header popover is rendered in the matrix header, handled by PriceListHeaderPopover
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importPriceListId) return;
    try {
      await api.postFile(`/api/v1/price-lists/${importPriceListId}/import`, file);
      await fetchMatrix();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Import failed");
    }
    e.target.value = "";
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <h1 className="text-lg font-bold text-[#1e3a5f] whitespace-nowrap">
          Price Lists
        </h1>
        <div className="flex-1" />
        <Select value={importPriceListId} onValueChange={setImportPriceListId}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Import into..." />
          </SelectTrigger>
          <SelectContent>
            {priceLists.map((pl) => (
              <SelectItem key={pl.id} value={pl.id}>
                {pl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          disabled={!importPriceListId}
          onClick={() => importFileRef.current?.click()}
        >
          Import CSV
        </Button>
        <input
          ref={importFileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleImportFile}
        />
        <Button
          size="sm"
          className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs"
          onClick={() => setCreateOpen(true)}
        >
          + Add Price List
        </Button>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-[#fce7f3] rounded-lg border border-[#e0ddd8]">
          <span className="text-xs text-[#334155] font-medium">
            {selectedIds.size} selected:
          </span>
          <span className="text-xs text-[#334155]">Set</span>
          <Select value={bulkPriceListId} onValueChange={setBulkPriceListId}>
            <SelectTrigger className="h-7 w-40 text-xs">
              <SelectValue placeholder="Price list..." />
            </SelectTrigger>
            <SelectContent>
              {priceLists.map((pl) => (
                <SelectItem key={pl.id} value={pl.id}>
                  {pl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-[#334155]">=</span>
          <Input
            type="text"
            value={bulkPrice}
            onChange={(e) => setBulkPrice(e.target.value)}
            placeholder="$0.00"
            className="h-7 w-20 text-xs"
          />
          <Button
            size="sm"
            className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs h-7"
            onClick={handleBulkApply}
            disabled={!bulkPriceListId || !bulkPrice}
          >
            Apply
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <PriceListMatrix
        priceLists={priceLists}
        items={items}
        onCellSave={handleCellSave}
        onFetchImpact={handleFetchImpact}
        onHeaderClick={handleHeaderClick}
        onRename={handleRename}
        onArchive={handleArchive}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
      />

      <PriceListCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        existingLists={priceLists}
        onCreate={handleCreate}
      />
    </div>
  );
}
