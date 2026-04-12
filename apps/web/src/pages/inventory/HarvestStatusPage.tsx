import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { HarvestToggleList } from "@/components/inventory/HarvestToggleList";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { ProductType } from "@/types";

export function HarvestStatusPage() {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchProductTypes = useCallback(async () => {
    try {
      const data = await api.get<ProductType[]>("/api/v1/product-types");
      const active = data.filter((pt) => pt.is_active);
      setProductTypes(active);
      if (active.length > 0 && !selectedTypeId) {
        setSelectedTypeId(active[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch product types:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProductTypes();
  }, [fetchProductTypes]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Harvest Status</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          Toggle varieties between in-harvest and dormant.
        </p>
      </div>

      {/* Product type selector */}
      <div className="mb-6">
        <Select
          value={selectedTypeId}
          onValueChange={(val) => setSelectedTypeId(val)}
        >
          <SelectTrigger className="w-64 bg-white border-[#e0ddd8] text-[#334155] min-h-[44px]">
            <SelectValue placeholder="Select product type" />
          </SelectTrigger>
          <SelectContent>
            {productTypes.map((pt) => (
              <SelectItem key={pt.id} value={pt.id}>
                {pt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Toggle list */}
      {selectedTypeId && !loading && (
        <div className="rounded-lg border border-[#e0ddd8] bg-white p-4">
          <HarvestToggleList productTypeId={selectedTypeId} />
        </div>
      )}
    </div>
  );
}
