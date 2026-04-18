import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2, ArrowLeft } from "lucide-react";
import { api } from "@/services/api";
import { ComparisonGrid } from "@/components/inventory/ComparisonGrid";
import type { ProductType } from "@/types";
import type { ComparisonResponse } from "@/types/inventory";

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(monday: string): string {
  const d = new Date(monday + "T00:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Week of ${fmt(d)} - ${fmt(end)}`;
}

function shiftWeek(monday: string, delta: number): string {
  const d = new Date(monday + "T00:00:00");
  d.setDate(d.getDate() + 7 * delta);
  return toISO(d);
}

export function ComparisonPage() {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [selectedPtId, setSelectedPtId] = useState<string>("");
  const [weekStart, setWeekStart] = useState(() => toISO(getMonday(new Date())));
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch product types
  useEffect(() => {
    api.get<ProductType[]>("/api/v1/product-types?active=true").then((pts) => {
      setProductTypes(pts);
      if (pts.length > 0 && !selectedPtId) {
        setSelectedPtId(pts[0].id);
      }
    });
  }, []);

  // Fetch comparison data
  useEffect(() => {
    if (!selectedPtId || !weekStart) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<ComparisonResponse>(
        `/api/v1/counts/comparison?product_type_id=${selectedPtId}&week_start=${weekStart}`
      )
      .then((resp) => {
        if (!cancelled) setData(resp);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load comparison");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPtId, weekStart]);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border-warm bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/inventory/availability"
            className="flex items-center gap-1 text-text-muted hover:text-text-body transition-colors"
            title="Back to Availability"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold text-slate-heading">Estimate vs. Actual</h1>
          <div className="flex items-center gap-2 ml-auto">
            {/* Week picker */}
            <div className="flex items-center gap-1 rounded-lg border border-border-warm bg-white">
              <button
                onClick={() => setWeekStart(shiftWeek(weekStart, -1))}
                className="p-2 text-text-body hover:bg-cream rounded-l-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-sm font-medium text-text-body whitespace-nowrap">
                {formatWeekLabel(weekStart)}
              </span>
              <button
                onClick={() => setWeekStart(shiftWeek(weekStart, 1))}
                className="p-2 text-text-body hover:bg-cream rounded-r-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Product type selector */}
            <select
              value={selectedPtId}
              onChange={(e) => setSelectedPtId(e.target.value)}
              className="h-10 min-h-[44px] rounded-lg border border-border-warm bg-white px-3 text-sm text-text-body focus:ring-2 focus:ring-rose-action focus:outline-none"
            >
              {productTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-cream p-4">
        {loading && (
          <div className="flex items-center justify-center py-12 text-text-muted">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading comparison...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && data && <ComparisonGrid data={data} />}
      </div>
    </div>
  );
}
