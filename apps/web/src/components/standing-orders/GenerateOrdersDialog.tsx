import { useState, useEffect, useMemo } from "react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Loader2, Calendar, CheckCircle2 } from "lucide-react";
import type {
  GeneratePreviewMatch,
  GeneratePreviewResponse,
  GenerateResponse,
} from "@/types/standing-order";

interface GenerateOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => void;
}

/** Format a date string as "Mon Apr 14" */
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Count weekdays between two dates (inclusive) */
function countDays(from: string, to: string): number {
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

/** Get next Monday as YYYY-MM-DD */
function getNextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}

/** Get Friday of the same week as a Monday date */
function getFridayOfWeek(mondayStr: string): string {
  const d = new Date(mondayStr + "T00:00:00");
  d.setDate(d.getDate() + 4);
  return d.toISOString().slice(0, 10);
}

export function GenerateOrdersDialog({
  open,
  onOpenChange,
  onGenerated,
}: GenerateOrdersDialogProps) {
  // ── Date range ───────────────────────────────────────────
  const defaultFrom = getNextMonday();
  const defaultTo = getFridayOfWeek(defaultFrom);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  // ── Preview data ─────────────────────────────────────────
  const [matches, setMatches] = useState<GeneratePreviewMatch[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ── Selection ────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Generate state ───────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [successResult, setSuccessResult] = useState<GenerateResponse | null>(
    null
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      const from = getNextMonday();
      const to = getFridayOfWeek(from);
      setDateFrom(from);
      setDateTo(to);
      setMatches([]);
      setSelected(new Set());
      setPreviewError(null);
      setSuccessResult(null);
    }
  }, [open]);

  // Fetch preview when dates change
  useEffect(() => {
    if (!open || !dateFrom || !dateTo) return;
    if (dateFrom > dateTo) return;

    let cancelled = false;
    const fetchPreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await api.post<GeneratePreviewResponse>(
          "/api/v1/standing-orders/generate-preview",
          { date_from: dateFrom, date_to: dateTo }
        );
        if (cancelled) return;
        setMatches(res.matches);
        // Select all rows that are NOT already generated
        const autoSelected = new Set<string>();
        res.matches.forEach((m, i) => {
          if (!m.already_generated) {
            autoSelected.add(matchKey(m, i));
          }
        });
        setSelected(autoSelected);
      } catch (err) {
        if (cancelled) return;
        setPreviewError(
          err instanceof Error ? err.message : "Failed to load preview"
        );
        setMatches([]);
        setSelected(new Set());
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    fetchPreview();
    return () => {
      cancelled = true;
    };
  }, [open, dateFrom, dateTo]);

  // ── Derived values ───────────────────────────────────────

  /** Unique key for a match row (standing_order_id + date + index for safety) */
  function matchKey(m: GeneratePreviewMatch, idx: number): string {
    return `${m.standing_order_id}::${m.generate_date}::${idx}`;
  }

  const selectedCount = selected.size;
  const totalCount = matches.length;
  const allSelected =
    totalCount > 0 && matches.every((m, i) => selected.has(matchKey(m, i)));
  const someSelected = selectedCount > 0 && !allSelected;

  const selectedStems = useMemo(() => {
    return matches.reduce((sum, m, i) => {
      if (selected.has(matchKey(m, i))) return sum + m.total_stems;
      return sum;
    }, 0);
  }, [matches, selected]);

  const dateSummary = useMemo(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return "";
    const days = countDays(dateFrom, dateTo);
    return `${days} day${days !== 1 ? "s" : ""} \u00b7 ${formatShortDate(dateFrom)} \u2013 ${formatShortDate(dateTo)}`;
  }, [dateFrom, dateTo]);

  // ── Handlers ─────────────────────────────────────────────

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      const all = new Set<string>();
      matches.forEach((m, i) => all.add(matchKey(m, i)));
      setSelected(all);
    }
  };

  const toggleOne = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selectedCount === 0) return;
    setGenerating(true);
    try {
      // Determine which matches are selected
      const selectedMatches = matches.filter((m, i) =>
        selected.has(matchKey(m, i))
      );

      // Check if any already-generated rows were unchecked (i.e., user wants to skip them)
      const hasUnselectedDuplicates = matches.some(
        (m, i) => m.already_generated && !selected.has(matchKey(m, i))
      );

      // Build the generate request with specific standing order + date pairs
      const res = await api.post<GenerateResponse>(
        "/api/v1/standing-orders/generate",
        {
          date_from: dateFrom,
          date_to: dateTo,
          skip_already_generated: hasUnselectedDuplicates,
          standing_order_ids: selectedMatches.map((m) => m.standing_order_id),
          dates: [...new Set(selectedMatches.map((m) => m.generate_date))],
        }
      );
      setSuccessResult(res);
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Failed to generate orders"
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    if (successResult) {
      onGenerated();
    }
    onOpenChange(false);
  };

  // ── Render ───────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full !sm:max-w-full !max-w-none flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle style={{ color: "var(--color-slate-heading)" }}>
            Generate Orders
          </SheetTitle>
          <SheetDescription>
            Create regular orders from active standing orders for the selected
            dates.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">

        {successResult ? (
          /* ── Success view ─────────────────────────────── */
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2
              className="h-10 w-10"
              style={{ color: "var(--color-sidebar-hover)" }}
            />
            <p className="text-base font-medium" style={{ color: "var(--color-sidebar-hover)" }}>
              {successResult.orders_created} order
              {successResult.orders_created !== 1 ? "s" : ""} created
              successfully
            </p>
            {successResult.orders_skipped > 0 && (
              <p className="text-sm" style={{ color: "var(--color-box-amber-text)" }}>
                {successResult.orders_skipped} duplicate
                {successResult.orders_skipped !== 1 ? "s" : ""} skipped
              </p>
            )}
          </div>
        ) : (
          /* ── Main view ────────────────────────────────── */
          <>
            {/* Date range card */}
            <div
              className="rounded-lg border p-3"
              style={{
                backgroundColor: "var(--color-cream-warm)",
                borderColor: "var(--color-border-warm)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Calendar
                  className="h-4 w-4"
                  style={{ color: "var(--color-slate-500)" }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-body)" }}
                >
                  Date Range
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1">
                  <label
                    className="block text-xs mb-1"
                    style={{ color: "var(--color-slate-500)" }}
                  >
                    From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                    style={{ borderColor: "var(--color-border-warm)" }}
                  />
                </div>
                <div className="flex-1">
                  <label
                    className="block text-xs mb-1"
                    style={{ color: "var(--color-slate-500)" }}
                  >
                    To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                    style={{ borderColor: "var(--color-border-warm)" }}
                  />
                </div>
              </div>
              {dateSummary && (
                <p
                  className="text-xs mt-2"
                  style={{ color: "var(--color-slate-500)" }}
                >
                  {dateSummary}
                </p>
              )}
            </div>

            {/* Preview table */}
            <div className="flex-1 overflow-auto min-h-0">
              {previewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <span
                    className="ml-2 text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Loading preview...
                  </span>
                </div>
              ) : previewError ? (
                <div
                  className="rounded-lg border p-4 text-sm text-center"
                  style={{
                    backgroundColor: "var(--color-red-50)",
                    borderColor: "var(--color-red-200)",
                    color: "var(--color-red-600)",
                  }}
                >
                  {previewError}
                </div>
              ) : matches.length === 0 ? (
                <div
                  className="rounded-lg border p-4 text-sm text-center"
                  style={{
                    backgroundColor: "var(--color-cream-warm)",
                    borderColor: "var(--color-border-warm)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  No matching standing orders for the selected dates.
                </div>
              ) : (
                <div
                  className="rounded-lg border overflow-x-auto"
                  style={{ borderColor: "var(--color-border-warm)" }}
                >
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr style={{ backgroundColor: "var(--color-cream-warm)" }}>
                        <th className="w-8 px-2 py-2">
                          <Checkbox
                            checked={allSelected}
                            indeterminate={someSelected}
                            onCheckedChange={toggleAll}
                          />
                        </th>
                        <th
                          className="px-3 py-2 text-left font-medium"
                          style={{ color: "var(--color-slate-heading)" }}
                        >
                          Customer
                        </th>
                        <th
                          className="px-3 py-2 text-left font-medium"
                          style={{ color: "var(--color-slate-heading)" }}
                        >
                          Date
                        </th>
                        <th
                          className="px-3 py-2 text-center font-medium"
                          style={{ color: "var(--color-slate-heading)" }}
                        >
                          Lines
                        </th>
                        <th
                          className="px-3 py-2 text-center font-medium"
                          style={{ color: "var(--color-slate-heading)" }}
                        >
                          Stems
                        </th>
                        <th
                          className="px-3 py-2 text-left font-medium"
                          style={{ color: "var(--color-slate-heading)" }}
                        >
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((m, i) => {
                        const key = matchKey(m, i);
                        const isSelected = selected.has(key);
                        return (
                          <tr
                            key={key}
                            className="border-t cursor-pointer hover:bg-cream-warm transition-colors"
                            style={{ borderColor: "var(--color-border-warm)" }}
                            onClick={() => toggleOne(key)}
                          >
                            <td className="px-2 py-2 text-center">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleOne(key)}
                              />
                            </td>
                            <td
                              className="px-3 py-2 font-medium"
                              style={{ color: "var(--color-text-body)" }}
                            >
                              {m.customer_name}
                            </td>
                            <td
                              className="px-3 py-2"
                              style={{ color: "var(--color-text-body)" }}
                            >
                              {formatShortDate(m.generate_date)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor: "var(--color-box-blue-bg)",
                                  color: "var(--color-box-blue-text)",
                                }}
                              >
                                {m.lines_count}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor: "var(--color-box-green-bg)",
                                  color: "var(--color-sidebar-hover)",
                                }}
                              >
                                {m.total_stems.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {m.already_generated ? (
                                <span
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                  style={{
                                    backgroundColor: "var(--color-box-amber-bg)",
                                    color: "var(--color-box-amber-text)",
                                  }}
                                >
                                  Already generated
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                  style={{
                                    backgroundColor: "var(--color-box-green-bg)",
                                    color: "var(--color-sidebar-hover)",
                                  }}
                                >
                                  Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Summary bar */}
            {matches.length > 0 && (
              <div
                className="rounded-lg px-4 py-2.5 text-sm font-medium"
                style={{
                  backgroundColor: "var(--color-box-green-bg)",
                  color: "var(--color-sidebar-hover)",
                }}
              >
                {selectedCount} selected of {totalCount} match
                {totalCount !== 1 ? "es" : ""} &middot;{" "}
                {selectedStems.toLocaleString()} total stems
              </div>
            )}
          </>
        )}
        </div>

        {/* Footer */}
        <div className="border-t border-border-warm px-6 py-4 mt-auto">
          {successResult ? (
            <Button
              onClick={handleClose}
              className="w-full"
              style={{ backgroundColor: "var(--color-sidebar-hover)", color: "white" }}
            >
              Done
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: "var(--color-slate-500)" }}>
                Orders will appear in the Orders list with a standing order badge.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleGenerate}
                  disabled={selectedCount === 0 || generating || previewLoading}
                  style={{
                    backgroundColor:
                      selectedCount === 0 ? "var(--color-text-muted)" : "var(--color-sidebar-hover)",
                    color: "white",
                  }}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : null}
                  Generate {selectedCount} Order
                  {selectedCount !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
