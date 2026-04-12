import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type {
  HarvestStatusEntry,
  HarvestStatusUpdateRequest,
  HarvestStatusUpdateResponse,
} from "@/types/inventory";

interface HarvestToggleListProps {
  productTypeId: string;
}

interface GroupedLines {
  productLineName: string;
  varieties: HarvestStatusEntry[];
}

function groupByProductLine(entries: HarvestStatusEntry[]): GroupedLines[] {
  const map = new Map<string, HarvestStatusEntry[]>();
  for (const entry of entries) {
    const existing = map.get(entry.product_line_name) ?? [];
    existing.push(entry);
    map.set(entry.product_line_name, existing);
  }
  return Array.from(map.entries()).map(([productLineName, varieties]) => ({
    productLineName,
    varieties,
  }));
}

export function HarvestToggleList({ productTypeId }: HarvestToggleListProps) {
  const [entries, setEntries] = useState<HarvestStatusEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<HarvestStatusEntry[]>(
        `/api/v1/varieties/harvest-status?product_type_id=${productTypeId}`
      );
      setEntries(data);
    } catch (err) {
      console.error("Failed to fetch harvest status:", err);
    } finally {
      setLoading(false);
    }
  }, [productTypeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const bulkUpdate = async (updates: { variety_id: string; in_harvest: boolean }[]) => {
    const ids = new Set(updates.map((u) => u.variety_id));
    setSaving((prev) => new Set([...prev, ...ids]));
    try {
      await api.patch<HarvestStatusUpdateResponse>(
        "/api/v1/varieties/harvest-status/bulk",
        { updates } satisfies HarvestStatusUpdateRequest
      );
      setEntries((prev) =>
        prev.map((e) => {
          const update = updates.find((u) => u.variety_id === e.variety_id);
          return update ? { ...e, in_harvest: update.in_harvest } : e;
        })
      );
    } catch (err) {
      console.error("Failed to update harvest status:", err);
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const handleToggle = (varietyId: string, currentValue: boolean) => {
    bulkUpdate([{ variety_id: varietyId, in_harvest: !currentValue }]);
  };

  const handleBulkSetAll = (varieties: HarvestStatusEntry[], inHarvest: boolean) => {
    const updates = varieties
      .filter((v) => v.in_harvest !== inHarvest)
      .map((v) => ({ variety_id: v.variety_id, in_harvest: inHarvest }));
    if (updates.length > 0) {
      bulkUpdate(updates);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#94a3b8]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading varieties...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        No varieties found for this product type.
      </div>
    );
  }

  const groups = groupByProductLine(entries);

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const harvestCount = group.varieties.filter((v) => v.in_harvest).length;
        return (
          <div key={group.productLineName}>
            {/* Section header */}
            <div className="flex items-center justify-between gap-3 border-b border-[#e0ddd8] pb-2 mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-[#1e3a5f]">
                  {group.productLineName}
                </h3>
                <span className="text-xs text-[#94a3b8]">
                  {harvestCount}/{group.varieties.length} in harvest
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => handleBulkSetAll(group.varieties, true)}
                  className="text-[#2d4a2d] border-[#2d4a2d]/30 hover:bg-[#2d4a2d]/10"
                >
                  All in harvest
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => handleBulkSetAll(group.varieties, false)}
                  className="text-[#94a3b8] border-[#e0ddd8] hover:bg-[#f4f1ec]"
                >
                  All dormant
                </Button>
              </div>
            </div>

            {/* Variety rows */}
            <div className="space-y-1">
              {group.varieties.map((variety) => {
                const isSaving = saving.has(variety.variety_id);
                return (
                  <div
                    key={variety.variety_id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 min-h-[44px] hover:bg-[#f4f1ec] transition-colors"
                  >
                    <span className="text-sm text-[#334155]">
                      {variety.variety_name}
                    </span>

                    {/* Toggle switch */}
                    <button
                      onClick={() => handleToggle(variety.variety_id, variety.in_harvest)}
                      disabled={isSaving}
                      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c27890] focus-visible:ring-offset-2 disabled:opacity-50 min-w-[44px] min-h-[44px] justify-center"
                      role="switch"
                      aria-checked={variety.in_harvest}
                      aria-label={`${variety.variety_name} harvest status`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-11 rounded-full transition-colors duration-200 ${
                          variety.in_harvest ? "bg-[#2d4a2d]" : "bg-[#e0ddd8]"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 mt-0.5 ${
                            variety.in_harvest ? "translate-x-5 ml-0.5" : "translate-x-0.5"
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
