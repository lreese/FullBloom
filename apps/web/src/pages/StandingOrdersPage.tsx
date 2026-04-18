import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronRight,
  Pencil,
  Pause,
  Play,
  XCircle,
  Plus,
  Loader2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { GenerateOrdersDialog } from "@/components/standing-orders/GenerateOrdersDialog";
import { useTableState } from "@/hooks/useTableState";
import type { ColumnDef } from "@/hooks/useTableState";
import { ColumnFilter } from "@/components/common/ColumnFilter";
import { cn } from "@/lib/utils";
import type {
  StandingOrderListItem,
  StandingOrderDetail,
} from "@/types/standing-order";

type StatusFilter = "active" | "paused" | "cancelled" | "all";

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Cancelled", value: "cancelled" },
  { label: "All", value: "all" },
];

const ALL_COLUMNS: ColumnDef[] = [
  { key: "customer_name", label: "Customer", filterable: true, sortable: true, defaultVisible: true },
  { key: "cadence_description", label: "Cadence", filterable: true, sortable: true, defaultVisible: true },
  { key: "status", label: "Status", filterable: true, sortable: true, defaultVisible: true },
  { key: "lines_count", label: "Lines", filterable: false, sortable: true, defaultVisible: true },
  { key: "total_stems", label: "Total Stems", filterable: false, sortable: true, defaultVisible: true },
  { key: "salesperson_email", label: "Salesperson", filterable: true, sortable: true, defaultVisible: false },
  { key: "frequency_weeks", label: "Frequency", filterable: true, sortable: true, defaultVisible: false },
  { key: "updated_at", label: "Last Modified", filterable: false, sortable: true, defaultVisible: false },
];

const SEARCHABLE_FIELDS = ["customer_name", "salesperson_email", "cadence_description"];

export function StandingOrdersPage() {
  const navigate = useNavigate();

  // ── Server-side status filter (drives API call) ───────────
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  // ── Data state ────────────────────────────────────────────
  const [items, setItems] = useState<StandingOrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [salespersonFilter, setSalespersonFilter] = useState("");
  const [salespersonOptions, setSalespersonOptions] = useState<string[]>([]);

  // ── Expanded rows ─────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const detailCache = useRef<Record<string, StandingOrderDetail>>({});
  const [expandedDetail, setExpandedDetail] =
    useState<StandingOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Generate dialog ────────────────────────────────────────
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);

  // ── Reason dialog ─────────────────────────────────────────
  const [reasonAction, setReasonAction] = useState<{
    type: "pause" | "cancel";
    id: string;
    customerName: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // ── Table state (sorting, filtering, column prefs) ────────
  const tableState = useTableState<StandingOrderListItem>({
    data: items,
    columns: ALL_COLUMNS,
    searchableFields: SEARCHABLE_FIELDS,
    storageKey: "fullbloom-standing-orders-columns",
    defaultSort: { key: "customer_name", direction: "asc" },
  });

  const {
    activeColumns,
    filteredData,
    sortConfig,
    handleSort,
    columnFilters,
    setColumnFilter,
    distinctValues,
    hasActiveFilters,
    clearAllFilters,
    columnPrefs,
    reorderColumns,
  } = tableState;

  // Fetch unique salesperson emails once (unfiltered)
  useEffect(() => {
    api.get<StandingOrderListItem[]>("/api/v1/standing-orders?status=all")
      .then((all) => {
        const emails = new Set<string>();
        all.forEach((so) => { if (so.salesperson_email) emails.add(so.salesperson_email); });
        setSalespersonOptions(Array.from(emails).sort());
      })
      .catch(() => {});
  }, []);

  // ── Fetch standing orders ─────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter === "all" ? "all" : statusFilter);
      if (salespersonFilter) params.set("salesperson_email", salespersonFilter);
      const res = await api.get<StandingOrderListItem[]>(
        `/api/v1/standing-orders?${params}`
      );
      setItems(res);
    } catch {
      // TODO: toast
    } finally {
      setLoading(false);
    }
  }, [statusFilter, salespersonFilter]);

  useEffect(() => {
    detailCache.current = {};
    fetchOrders();
  }, [fetchOrders]);

  // ── Expand row ────────────────────────────────────────────
  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    if (detailCache.current[id]) {
      setExpandedDetail(detailCache.current[id]);
      return;
    }
    setDetailLoading(true);
    try {
      const detail = await api.get<StandingOrderDetail>(
        `/api/v1/standing-orders/${id}`
      );
      detailCache.current[id] = detail;
      setExpandedDetail(detail);
    } catch {
      setExpandedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Status actions ────────────────────────────────────────
  const handlePause = (id: string, customerName: string) => {
    setReasonAction({ type: "pause", id, customerName });
    setReason("");
  };

  const handleCancel = (id: string, customerName: string) => {
    setReasonAction({ type: "cancel", id, customerName });
    setReason("");
  };

  const handleResume = async (id: string) => {
    setActionLoading(true);
    try {
      await api.post(`/api/v1/standing-orders/${id}/resume`, {});
      delete detailCache.current[id];
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
      fetchOrders();
    } catch {
      // TODO: toast
    } finally {
      setActionLoading(false);
    }
  };

  const submitReasonAction = async () => {
    if (!reasonAction) return;
    setActionLoading(true);
    try {
      const endpoint =
        reasonAction.type === "pause"
          ? `/api/v1/standing-orders/${reasonAction.id}/pause`
          : `/api/v1/standing-orders/${reasonAction.id}/cancel`;
      await api.post(endpoint, { reason: reason || null });
      delete detailCache.current[reasonAction.id];
      if (expandedId === reasonAction.id) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
      setReasonAction(null);
      setReason("");
      fetchOrders();
    } catch {
      // TODO: toast
    } finally {
      setActionLoading(false);
    }
  };

  // ── Header drag-to-reorder state ──────────────────────────
  const [headerDragIdx, setHeaderDragIdx] = useState<number | null>(null);
  const [headerDropIdx, setHeaderDropIdx] = useState<number | null>(null);

  const handleHeaderDragStart = useCallback(
    (e: React.DragEvent, idx: number) => {
      setHeaderDragIdx(idx);
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleHeaderDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const insertIdx = e.clientX < midX ? idx : idx + 1;
      setHeaderDropIdx(insertIdx);
    },
    []
  );

  const handleHeaderDrop = useCallback(() => {
    if (headerDragIdx === null || headerDropIdx === null) return;
    if (headerDragIdx !== headerDropIdx) {
      reorderColumns(headerDragIdx, headerDropIdx);
    }
    setHeaderDragIdx(null);
    setHeaderDropIdx(null);
  }, [headerDragIdx, headerDropIdx, reorderColumns]);

  const handleHeaderDragEnd = useCallback(() => {
    setHeaderDragIdx(null);
    setHeaderDropIdx(null);
  }, []);

  // ── Render cell content ───────────────────────────────────
  const renderCell = (col: ColumnDef, item: StandingOrderListItem) => {
    switch (col.key) {
      case "customer_name":
        return (
          <span className="font-medium" style={{ color: "var(--color-text-body)" }}>
            {item.customer_name}
          </span>
        );
      case "status":
        return <StatusBadge status={item.status} />;
      case "lines_count":
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "var(--color-box-blue-bg)", color: "var(--color-box-blue-text)" }}
          >
            {item.lines_count}
          </span>
        );
      case "total_stems":
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "var(--color-box-green-bg)", color: "var(--color-sidebar-hover)" }}
          >
            {item.total_stems.toLocaleString()}
          </span>
        );
      case "updated_at":
        return (
          <span style={{ color: "var(--color-text-body)" }}>
            {new Date(item.updated_at).toLocaleDateString()}
          </span>
        );
      case "salesperson_email":
        return (
          <span style={{ color: "var(--color-slate-500)" }}>
            {item.salesperson_email ?? "\u2014"}
          </span>
        );
      case "frequency_weeks":
        return (
          <span style={{ color: "var(--color-slate-500)" }}>
            Every {item.frequency_weeks} week{item.frequency_weeks !== 1 ? "s" : ""}
          </span>
        );
      default: {
        const val = item[col.key as keyof StandingOrderListItem];
        if (val == null) return "\u2014";
        return String(val);
      }
    }
  };

  const colSpan = activeColumns.length + 2; // +1 chevron, +1 actions

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-cream)" }}>
      <div className="max-w-[1400px] mx-auto px-4 py-6 sm:px-6">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-slate-heading">Standing Orders</h1>
            {tableState.hasActiveFilters && (
              <button
                className="text-xs text-text-muted hover:text-text-body border border-border-warm rounded px-2 py-1"
                onClick={tableState.clearAllFilters}
              >
                Clear Filters
              </button>
            )}
            {columnPrefs && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-xs text-text-muted hover:text-text-body border border-border-warm rounded px-2 py-1 flex items-center gap-1">
                    <Settings2 className="h-3 w-3" /> Columns
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="end">
                  <div className="space-y-0.5">
                    {ALL_COLUMNS.map((col) => (
                      <label key={col.key} className="flex items-center gap-2 px-1 py-0.5 text-sm rounded hover:bg-cream cursor-pointer">
                        <Checkbox
                          checked={columnPrefs?.visible.includes(col.key) ?? true}
                          onCheckedChange={() => tableState.toggleColumn(col.key)}
                        />
                        <span className="text-text-body select-none">{col.label || col.key}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <Button
              className="gap-1.5"
              style={{ backgroundColor: "var(--color-sidebar-hover)", color: "white" }}
              onClick={() => setGenerateDialogOpen(true)}
            >
              <RefreshCw className="h-4 w-4" />
              Generate Orders
            </Button>
            <Button
              onClick={() => navigate("/standing-orders/new")}
              className="gap-1.5"
              style={{ backgroundColor: "var(--color-rose-action)", color: "white" }}
            >
              <Plus className="h-4 w-4" />
              New Standing Order
            </Button>
          </div>
        </div>

        {/* ── Filters bar: status tabs + search + salesperson ── */}
        <div
          className="rounded-lg border p-3 mb-4 flex items-center gap-3 flex-wrap"
          style={{ backgroundColor: "white", borderColor: "var(--color-border-warm)" }}
        >
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={
                  statusFilter === tab.value
                    ? { backgroundColor: "var(--color-slate-heading)", color: "white" }
                    : { backgroundColor: "transparent", color: "var(--color-slate-500)" }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[140px] max-w-[280px] relative">
            <input
              type="text"
              placeholder="Search..."
              value={tableState.searchTerm}
              onChange={(e) => tableState.setSearchTerm(e.target.value)}
              className="w-full h-9 rounded-lg border border-border-warm bg-white pl-3 pr-3 text-sm text-text-body placeholder:text-text-muted focus:ring-2 focus:ring-rose-action focus:outline-none"
            />
          </div>
          <select
            value={salespersonFilter}
            onChange={(e) => setSalespersonFilter(e.target.value)}
            className="h-9 rounded-lg border border-border-warm bg-white px-3 text-sm text-text-body focus:ring-2 focus:ring-rose-action focus:outline-none"
          >
            <option value="">All Salespeople</option>
            {salespersonOptions.map((email) => (
              <option key={email} value={email}>{email}</option>
            ))}
          </select>
        </div>

        {/* ── Table (custom rendering for expandable rows) ── */}
        <div className="rounded-lg border border-border-warm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border-warm bg-cream-warm">
                  {/* Expand chevron column */}
                  <th className="w-8 px-2 py-2.5" />
                  {/* Data columns */}
                  {activeColumns.map((col, idx) => {
                    const isSortable = col.sortable !== false;
                    const isSorted = sortConfig?.key === col.key;
                    return (
                      <th
                        key={col.key}
                        draggable
                        onDragStart={(e) => handleHeaderDragStart(e, idx)}
                        onDragOver={(e) => handleHeaderDragOver(e, idx)}
                        onDrop={handleHeaderDrop}
                        onDragEnd={handleHeaderDragEnd}
                        className={cn(
                          "px-3 py-2.5 text-left text-[10px] font-semibold text-slate-heading whitespace-nowrap relative select-none",
                          isSortable && "cursor-pointer",
                          headerDragIdx === idx && "opacity-50"
                        )}
                        onClick={() => isSortable && handleSort(col.key)}
                      >
                        {/* Left drop indicator */}
                        {headerDropIdx === idx &&
                          headerDragIdx !== idx &&
                          headerDragIdx !== idx - 1 && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-rose-action z-10" />
                          )}

                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {isSorted && (
                            <span className="text-rose-action">
                              {sortConfig.direction === "asc" ? "\u25B2" : "\u25BC"}
                            </span>
                          )}
                          {col.filterable && distinctValues[col.key] && (
                            <span onClick={(e) => e.stopPropagation()}>
                              <ColumnFilter
                                values={distinctValues[col.key]}
                                selected={columnFilters[col.key] ?? []}
                                onChange={(selected) =>
                                  setColumnFilter(col.key, selected)
                                }
                              />
                            </span>
                          )}
                        </span>

                        {/* Right drop indicator (last column) */}
                        {headerDropIdx === activeColumns.length &&
                          idx === activeColumns.length - 1 &&
                          headerDragIdx !== idx && (
                            <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-rose-action z-10" />
                          )}
                      </th>
                    );
                  })}
                  {/* Actions column */}
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-slate-heading whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="text-center py-12">
                      <Loader2
                        className="h-5 w-5 animate-spin mx-auto"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={colSpan}
                      className="text-center py-12"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      No standing orders found.
                      {hasActiveFilters && (
                        <button
                          className="ml-2 text-rose-action hover:underline"
                          onClick={clearAllFilters}
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredData.map((so) => (
                    <StandingOrderRow
                      key={so.id}
                      item={so}
                      activeColumns={activeColumns}
                      renderCell={renderCell}
                      isExpanded={expandedId === so.id}
                      expandedDetail={
                        expandedId === so.id ? expandedDetail : null
                      }
                      detailLoading={expandedId === so.id && detailLoading}
                      colSpan={colSpan}
                      onToggle={() => toggleExpand(so.id)}
                      onEdit={() =>
                        navigate(`/standing-orders/${so.id}/edit`)
                      }
                      onPause={() => handlePause(so.id, so.customer_name)}
                      onResume={() => handleResume(so.id)}
                      onCancel={() => handleCancel(so.id, so.customer_name)}
                      actionLoading={actionLoading}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="px-3 py-2 text-xs text-text-muted bg-cream-warm border-t border-border-warm">
            {filteredData.length} standing order{filteredData.length !== 1 ? "s" : ""}
            {hasActiveFilters ? " (filtered)" : ""}
          </div>
        </div>
      </div>

      {/* ── Generate orders dialog ──────────────────────── */}
      <GenerateOrdersDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        onGenerated={() => {
          detailCache.current = {};
          fetchOrders();
        }}
      />

      {/* ── Reason dialog (pause/cancel) ─────────────────── */}
      <Dialog
        open={!!reasonAction}
        onOpenChange={(open) => {
          if (!open) {
            setReasonAction(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonAction?.type === "pause"
                ? "Pause Standing Order"
                : "Cancel Standing Order"}
            </DialogTitle>
            <DialogDescription>
              {reasonAction?.type === "pause"
                ? `Pause the standing order for ${reasonAction?.customerName}. No orders will be generated while paused.`
                : `Cancel the standing order for ${reasonAction?.customerName}. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--color-text-body)" }}
            >
              Reason{reasonAction?.type === "cancel" ? "" : " (optional)"}
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                reasonAction?.type === "pause"
                  ? "e.g., Customer on vacation until May"
                  : "e.g., Customer account closed"
              }
              rows={3}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={submitReasonAction}
              disabled={actionLoading}
              style={
                reasonAction?.type === "cancel"
                  ? { backgroundColor: "var(--color-red-600)", color: "white" }
                  : { backgroundColor: "var(--color-amber-600)", color: "white" }
              }
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : reasonAction?.type === "pause" ? (
                "Pause"
              ) : (
                "Cancel Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    active: { bg: "var(--color-box-green-bg)", color: "var(--color-sidebar-hover)" },
    paused: { bg: "var(--color-box-amber-bg)", color: "var(--color-box-amber-text)" },
    cancelled: { bg: "var(--color-slate-100)", color: "var(--color-text-muted)" },
  };
  const s = styles[status] ?? styles.active;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        status === "cancelled" ? "line-through" : ""
      }`}
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Row component ────────────────────────────────────────────

interface StandingOrderRowProps {
  item: StandingOrderListItem;
  activeColumns: ColumnDef[];
  renderCell: (col: ColumnDef, item: StandingOrderListItem) => React.ReactNode;
  isExpanded: boolean;
  expandedDetail: StandingOrderDetail | null;
  detailLoading: boolean;
  colSpan: number;
  onToggle: () => void;
  onEdit: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  actionLoading: boolean;
}

function StandingOrderRow({
  item,
  activeColumns,
  renderCell,
  isExpanded,
  expandedDetail,
  detailLoading,
  colSpan,
  onToggle,
  onEdit,
  onPause,
  onResume,
  onCancel,
}: StandingOrderRowProps) {
  const isCancelled = item.status === "cancelled";

  return (
    <>
      <tr
        className="border-b border-border-warm hover:bg-cream-warm transition-colors cursor-pointer"
        style={{
          opacity: isCancelled ? 0.5 : 1,
        }}
        onClick={onToggle}
      >
        <td className="px-2 py-2.5 text-center">
          <ChevronRight
            className="h-4 w-4 transition-transform inline-block"
            style={{
              color: "var(--color-text-muted)",
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
          />
        </td>
        {activeColumns.map((col) => (
          <td key={col.key} className="px-3 py-2.5 text-text-body">
            {renderCell(col, item)}
          </td>
        ))}
        <td className="px-3 py-2.5 text-right">
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {item.status === "active" && (
              <>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onEdit}
                  title="Edit standing order"
                >
                  <Pencil
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onPause}
                  title="Pause standing order"
                >
                  <Pause
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--color-amber-600)" }}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onCancel}
                  title="Cancel standing order"
                >
                  <XCircle
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--color-red-600)" }}
                  />
                </Button>
              </>
            )}
            {item.status === "paused" && (
              <>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onResume}
                  title="Resume standing order"
                >
                  <Play
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--color-sidebar-hover)" }}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onCancel}
                  title="Cancel standing order"
                >
                  <XCircle
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--color-red-600)" }}
                  />
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr style={{ borderColor: "var(--color-border-warm)" }}>
          <td
            colSpan={colSpan}
            className="px-6 py-4"
            style={{ backgroundColor: "var(--color-cream-warm)" }}
          >
            {detailLoading ? (
              <div
                className="flex items-center gap-2 text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading line items...
              </div>
            ) : expandedDetail ? (
              <StandingOrderLineItems detail={expandedDetail} />
            ) : (
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Could not load standing order details.
              </span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Line items sub-table ─────────────────────────────────────

function StandingOrderLineItems({ detail }: { detail: StandingOrderDetail }) {
  const totalStems = detail.lines.reduce((sum, l) => sum + l.stems, 0);
  const totalValue = detail.lines.reduce(
    (sum, l) => sum + l.stems * parseFloat(l.price_per_stem),
    0
  );

  return (
    <div
      className="rounded border overflow-hidden"
      style={{ borderColor: "var(--color-border-warm)" }}
    >
      <table className="w-full text-xs">
        <thead>
          <tr style={{ backgroundColor: "var(--color-cream)" }}>
            <th
              className="px-2 py-1.5 text-left font-medium"
              style={{ color: "var(--color-slate-heading)" }}
            >
              #
            </th>
            <th
              className="px-2 py-1.5 text-left font-medium"
              style={{ color: "var(--color-slate-heading)" }}
            >
              Sales Item
            </th>
            <th
              className="px-2 py-1.5 text-left font-medium"
              style={{ color: "var(--color-slate-heading)" }}
            >
              Color / Variety
            </th>
            <th
              className="px-2 py-1.5 text-right font-medium"
              style={{ color: "var(--color-slate-heading)" }}
            >
              Stems
            </th>
            <th
              className="px-2 py-1.5 text-right font-medium"
              style={{ color: "var(--color-slate-heading)" }}
            >
              Price
            </th>
            <th
              className="px-2 py-1.5 text-right font-medium"
              style={{ color: "var(--color-slate-heading)" }}
            >
              Line Total
            </th>
          </tr>
        </thead>
        <tbody>
          {detail.lines.map((line) => {
            const lineTotal = line.stems * parseFloat(line.price_per_stem);
            return (
              <tr
                key={line.id}
                className="border-t"
                style={{ borderColor: "var(--color-border-warm)" }}
              >
                <td className="px-2 py-1.5" style={{ color: "var(--color-text-body)" }}>
                  {line.line_number}
                </td>
                <td className="px-2 py-1.5" style={{ color: "var(--color-text-body)" }}>
                  {line.sales_item_name}
                </td>
                <td className="px-2 py-1.5" style={{ color: "var(--color-text-body)" }}>
                  {line.color_variety ?? "--"}
                </td>
                <td
                  className="px-2 py-1.5 text-right"
                  style={{ color: "var(--color-text-body)" }}
                >
                  {line.stems}
                </td>
                <td
                  className="px-2 py-1.5 text-right"
                  style={{ color: "var(--color-text-body)" }}
                >
                  ${line.price_per_stem}
                </td>
                <td
                  className="px-2 py-1.5 text-right"
                  style={{ color: "var(--color-text-body)" }}
                >
                  ${lineTotal.toFixed(2)}
                </td>
              </tr>
            );
          })}
          {/* Summary row */}
          <tr
            className="border-t font-medium"
            style={{ borderColor: "var(--color-border-warm)", backgroundColor: "var(--color-cream)" }}
          >
            <td colSpan={3} className="px-2 py-1.5" style={{ color: "var(--color-slate-heading)" }}>
              Total
            </td>
            <td
              className="px-2 py-1.5 text-right"
              style={{ color: "var(--color-slate-heading)" }}
            >
              {totalStems.toLocaleString()}
            </td>
            <td className="px-2 py-1.5" />
            <td
              className="px-2 py-1.5 text-right"
              style={{ color: "var(--color-slate-heading)" }}
            >
              ${totalValue.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
