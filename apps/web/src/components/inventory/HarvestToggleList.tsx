import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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
    setSearch("");
  }, [fetchData]);

  // Default all product lines to collapsed once data loads
  useEffect(() => {
    if (entries.length > 0) {
      const allLines = new Set(entries.map((e) => e.product_line_name));
      setCollapsed(allLines);
    }
  }, [entries]);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const lower = search.toLowerCase();
    return entries.filter((e) => e.variety_name.toLowerCase().includes(lower));
  }, [entries, search]);

  const groups = useMemo(() => groupByProductLine(filtered), [filtered]);

  const toggleCollapse = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

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
      <div className="flex items-center justify-center py-12 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading varieties...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-text-muted">
        No varieties found for this product type.
      </div>
    );
  }

  const totalInHarvest = entries.filter((e) => e.in_harvest).length;

  return (
    <div className="space-y-4">
      {/* Summary + Search */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search varieties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-white border-border-warm text-text-body placeholder:text-text-muted"
        />
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-box-green-bg text-sidebar-hover whitespace-nowrap">
          {totalInHarvest}/{entries.length} in harvest
        </span>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.productLineName);
          const harvestCount = group.varieties.filter((v) => v.in_harvest).length;
          return (
            <div key={group.productLineName}>
              {/* Section header — clickable to collapse */}
              <div className="flex items-center justify-between gap-3 border-b border-border-warm pb-2 mb-3">
                <button
                  type="button"
                  onClick={() => toggleCollapse(group.productLineName)}
                  className="flex items-center gap-2 hover:text-slate-heading transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-text-muted" />
                  )}
                  <h3 className="text-sm font-semibold text-slate-heading">
                    {group.productLineName}
                  </h3>
                  <span className="text-xs text-text-muted">
                    {harvestCount}/{group.varieties.length} in harvest
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleBulkSetAll(group.varieties, true)}
                    className="text-sidebar-hover border-sidebar-hover/30 hover:bg-sidebar-hover/10"
                  >
                    All in harvest
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleBulkSetAll(group.varieties, false)}
                    className="text-text-muted border-border-warm hover:bg-cream"
                  >
                    All dormant
                  </Button>
                </div>
              </div>

              {/* Variety rows — hidden when collapsed */}
              {!isCollapsed && (
                <div className="space-y-1">
                  {group.varieties.map((variety) => {
                    const isSaving = saving.has(variety.variety_id);
                    return (
                      <div
                        key={variety.variety_id}
                        className="flex items-center justify-between rounded-lg px-3 py-2 min-h-[44px] hover:bg-cream transition-colors"
                      >
                        <span className="flex-1 text-sm text-text-body">
                          {variety.variety_name}
                        </span>
                        <div className="flex items-center gap-2 min-w-[36px] min-h-[36px] justify-center">
                          <Checkbox
                            checked={variety.in_harvest}
                            onCheckedChange={() => handleToggle(variety.variety_id, variety.in_harvest)}
                            disabled={isSaving}
                            className="h-5 w-5 data-checked:bg-sidebar-hover data-checked:border-sidebar-hover"
                            aria-label={`${variety.variety_name} harvest status`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {groups.length === 0 && search && (
          <div className="text-center py-8 text-text-muted text-sm">
            No varieties matching "{search}"
          </div>
        )}
      </div>
    </div>
  );
}
