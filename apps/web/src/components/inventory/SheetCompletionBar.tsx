import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SheetType, SheetCompleteResponse, SheetUncompleteResponse } from "@/types/inventory";

interface SheetCompletionBarProps {
  doneCount: number;
  totalCount: number;
  isComplete: boolean;
  completedBy?: string;
  completedAt?: string;
  productTypeId: string;
  sheetType: SheetType;
  sheetDate: string;
  onCompleteChange: (isComplete: boolean, completedBy?: string, completedAt?: string) => void;
  grandTotal?: number;
  grandTotalVariant?: "green" | "teal";
  combinedTotal?: number;
  grandTotalLabel?: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SheetCompletionBar({
  doneCount,
  totalCount,
  isComplete,
  completedBy,
  completedAt,
  productTypeId,
  sheetType,
  sheetDate,
  onCompleteChange,
  grandTotal,
  grandTotalVariant = "green",
  combinedTotal,
  grandTotalLabel = "total",
}: SheetCompletionBarProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const allDone = doneCount === totalCount && totalCount > 0;

  const handleComplete = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.post<SheetCompleteResponse>("/api/v1/sheets/complete", {
        product_type_id: productTypeId,
        sheet_type: sheetType,
        sheet_date: sheetDate,
        completed_by: "anonymous",
      });
      onCompleteChange(true, resp.completed_by, resp.completed_at);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to complete sheet";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post<SheetUncompleteResponse>("/api/v1/sheets/uncomplete", {
        product_type_id: productTypeId,
        sheet_type: sheetType,
        sheet_date: sheetDate,
        completed_by: "anonymous",
      });
      onCompleteChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reopen sheet";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Completed state: green banner
  if (isComplete) {
    return (
      <div className="space-y-2">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-lg border border-[#8fbc8f] bg-[#2d4a2d]/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-[#2d4a2d]">
            <CheckCircle2 className="h-5 w-5 text-[#2d4a2d]" />
            <span className="font-medium">
              Completed by {completedBy ?? "Unknown"}
              {completedAt && <span className="font-normal text-[#2d4a2d]/80"> at {formatTime(completedAt)}</span>}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReopen}
            disabled={loading}
            className="border-[#2d4a2d]/30 text-[#2d4a2d] hover:bg-[#2d4a2d]/10"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reopen"}
          </Button>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  // In-progress state: progress bar + complete button
  return (
    <div className="space-y-2">
      <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-lg border border-[#e0ddd8] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-sm text-[#334155]">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {doneCount}/{totalCount} varieties done
              </span>
              {grandTotal !== undefined && grandTotal > 0 && (
                <span className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  grandTotalVariant === "green" && "bg-[#e8f0e8] text-[#2d4a2d]",
                  grandTotalVariant === "teal" && "bg-[#e0f2f1] text-[#0d7377]"
                )}>
                  {grandTotal} {grandTotalLabel}
                </span>
              )}
              {combinedTotal !== undefined && combinedTotal > 0 && (
                <>
                  <div className="mx-1 h-5 w-px bg-[#e0ddd8]" />
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#f1f5f9] text-[#475569]">
                    {combinedTotal} combined
                  </span>
                </>
              )}
            </div>
            <span className="text-xs text-[#94a3b8]">{pct}%</span>
          </div>
          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#e0ddd8]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                allDone ? "bg-[#2d4a2d]" : "bg-[#c27890]"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <Button
          size="sm"
          disabled={loading}
          onClick={handleComplete}
          className={cn(
            "mt-2 sm:mt-0 sm:ml-4 shrink-0",
            loading
              ? "bg-[#e0ddd8] text-[#94a3b8] cursor-not-allowed"
              : "bg-[#2d4a2d] hover:bg-[#2d4a2d]/90 text-white"
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Complete Day
        </Button>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
