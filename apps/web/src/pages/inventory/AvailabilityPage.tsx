import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Loader2 } from "lucide-react";
import { api } from "@/services/api";
import { Input } from "@/components/ui/input";
import { AvailabilityCard } from "@/components/inventory/AvailabilityCard";
import type { AvailabilityResponse } from "@/types/inventory";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AvailabilityPage() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<AvailabilityResponse>(`/api/v1/availability?date=${date}`)
      .then((resp) => {
        if (!cancelled) setData(resp);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load availability");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="shrink-0 border-b border-[#e0ddd8] bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-[#1e3a5f]">Availability</h1>
          <div className="flex items-center gap-2 ml-auto">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40 bg-white border-[#e0ddd8] text-[#334155] focus-visible:ring-[#c27890] min-h-[44px]"
            />
            <Link
              to="/inventory/comparison"
              className="flex items-center gap-1.5 rounded-lg border border-[#e0ddd8] bg-white px-3 py-2 text-sm text-[#334155] hover:bg-[#f4f1ec] transition-colors min-h-[44px]"
            >
              <BarChart3 className="h-4 w-4" />
              Comparison
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#f4f1ec] p-4">
        {loading && (
          <div className="flex items-center justify-center py-12 text-[#94a3b8]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading availability...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && data && (
          <div className="space-y-4">
            {data.product_types.map((pt) => (
              <AvailabilityCard key={pt.product_type_id} productType={pt} />
            ))}
            {data.product_types.length === 0 && (
              <div className="text-center py-12 text-sm text-[#94a3b8]">
                No availability data for this date.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
