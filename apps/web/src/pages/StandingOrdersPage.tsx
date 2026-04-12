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
          <span className="font-medium" style={{ color: "#334155" }}>
            {item.customer_name}
          </span>
        );
      case "status":
        return <StatusBadge status={item.status} />;
      case "lines_count":
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "#dbeafe", color: "#1e40af" }}
          >
            {item.lines_count}
          </span>
        );
      case "total_stems":
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "#e8f0e8", color: "#2d4a2d" }}
          >
            {item.total_stems.toLocaleString()}
          </span>
        );
      case "updated_at":
        return (
          <span style={{ color: "#334155" }}>
            {new Date(item.updated_at).toLocaleDateString()}
          </span>
        );
      case "salesperson_email":
        return (
          <span style={{ color: "#64748b" }}>
            {item.salesperson_email ?? "\u2014"}
          </span>
        );
      case "frequency_weeks":
        return (
          <span style={{ color: "#64748b" }}>
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
    <div className="min-h-screen" style={{ backgroundColor: "#f4f1ec" }}>
      <div className="max-w-[1400px] mx-auto px-4 py-6 sm:px-6">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-[#1e3a5f]">Standing Orders</h1>
            {tableState.hasActiveFilters && (
              <button
                className="text-xs text-[#94a3b8] hover:text-[#334155] border border-[#e0ddd8] rounded px-2 py-1"
                onClick={tableState.clearAllFilters}
              >
                Clear Filters
              </button>
            )}
            {columnPrefs && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-xs text-[#94a3b8] hover:text-[#334155] border border-[#e0ddd8] rounded px-2 py-1 flex items-center gap-1">
                    <Settings2 className="h-3 w-3" /> Columns
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="end">
                  <div className="space-y-0.5">
                    {ALL_COLUMNS.map((col) => (
                      <label key={col.key} className="flex items-center gap-2 px-1 py-0.5 text-sm rounded hover:bg-[#f4f1ec] cursor-pointer">
                        <Checkbox
                          checked={columnPrefs?.visible.includes(col.key) ?? true}
                          onCheckedChange={() => tableState.toggleColumn(col.key)}
                        />
                        <span className="text-[#334155] select-none">{col.label || col.key}</span>
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
              style={{ backgroundColor: "#2d4a2d", color: "white" }}
              onClick={() => setGenerateDialogOpen(true)}
            >
              <RefreshCw className="h-4 w-4" />
              Generate Orders
            </Button>
            <Button
              onClick={() => navigate("/standing-orders/new")}
              className="gap-1.5"
              style={{ backgroundColor: "#c27890", color: "white" }}
            >
              <Plus className="h-4 w-4" />
              New Standing Order
            </Button>
          </div>
        </div>

        {/* ── Filters bar: status tabs + search + salesperson ── */}
        <div
          className="rounded-lg border p-3 mb-4 flex items-center gap-3 flex-wrap"
          style={{ backgroundColor: "white", borderColor: "#e0ddd8" }}
        >
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={
                  statusFilter === tab.value
                    ? { backgroundColor: "#1e3a5f", color: "white" }
                    : { backgroundColor: "transparent", color: "#64748b" }
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
              className="w-full h-9 rounded-lg border border-[#e0ddd8] bg-white pl-3 pr-3 text-sm text-[#334155] placeholder:text-[#94a3b8] focus:ring-2 focus:ring-[#c27890] focus:outline-none"
            />
          </div>
          <select
            value={salespersonFilter}
            onChange={(e) => setSalespersonFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#e0ddd8] bg-white px-3 text-sm text-[#334155] focus:ring-2 focus:ring-[#c27890] focus:outline-none"
          >
            <option value="">All Salespeople</option>
            {salespersonOptions.map((email) => (
              <option key={email} value={email}>{email}</option>
            ))}
          </select>
        </div>

        {/* ── Table (custom rendering for expandable rows) ── */}
        <div className="rounded-lg border border-[#e0ddd8] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#e0ddd8] bg-[#faf8f5]">
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
                          "px-3 py-2.5 text-left text-[10px] font-semibold text-[#1e3a5f] whitespace-nowrap relative select-none",
                          isSortable && "cursor-pointer",
                          headerDragIdx === idx && "opacity-50"
                        )}
                        onClick={() => isSortable && handleSort(col.key)}
                      >
                        {/* Left drop indicator */}
                        {headerDropIdx === idx &&
                          headerDragIdx !== idx &&
                          headerDragIdx !== idx - 1 && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#c27890] z-10" />
                          )}

                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {isSorted && (
                            <span className="text-[#c27890]">
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
                            <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-[#c27890] z-10" />
                          )}
                      </th>
                    );
                  })}
                  {/* Actions column */}
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#1e3a5f] whitespace-nowrap">
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
                        style={{ color: "#94a3b8" }}
                      />
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={colSpan}
                      className="text-center py-12"
                      style={{ color: "#94a3b8" }}
                    >
                      No standing orders found.
                      {hasActiveFilters && (
                        <button
                          className="ml-2 text-[#c27890] hover:underline"
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
          <div className="px-3 py-2 text-xs text-[#94a3b8] bg-[#faf8f5] border-t border-[#e0ddd8]">
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
              style={{ color: "#334155" }}
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
                  ? { backgroundColor: "#dc2626", color: "white" }
                  : { backgroundColor: "#d97706", color: "white" }
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
    active: { bg: "#e8f0e8", color: "#2d4a2d" },
    paused: { bg: "#fef3c7", color: "#92400e" },
    cancelled: { bg: "#f1f5f9", color: "#94a3b8" },
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
        className="border-b border-[#f0ede8] hover:bg-[#faf8f5] transition-colors cursor-pointer"
        style={{
          opacity: isCancelled ? 0.5 : 1,
        }}
        onClick={onToggle}
      >
        <td className="px-2 py-2.5 text-center">
          <ChevronRight
            className="h-4 w-4 transition-transform inline-block"
            style={{
              color: "#94a3b8",
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
          />
        </td>
        {activeColumns.map((col) => (
          <td key={col.key} className="px-3 py-2.5 text-[#334155]">
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
                    style={{ color: "#94a3b8" }}
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
                    style={{ color: "#d97706" }}
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
                    style={{ color: "#dc2626" }}
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
                    style={{ color: "#2d4a2d" }}
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
                    style={{ color: "#dc2626" }}
                  />
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr style={{ borderColor: "#e0ddd8" }}>
          <td
            colSpan={colSpan}
            className="px-6 py-4"
            style={{ backgroundColor: "#faf9f7" }}
          >
            {detailLoading ? (
              <div
                className="flex items-center gap-2 text-sm"
                style={{ color: "#94a3b8" }}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading line items...
              </div>
            ) : expandedDetail ? (
              <StandingOrderLineItems detail={expandedDetail} />
            ) : (
              <span className="text-sm" style={{ color: "#94a3b8" }}>
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
      style={{ borderColor: "#e0ddd8" }}
    >
      <table className="w-full text-xs">
        <thead>
          <tr style={{ backgroundColor: "#f4f1ec" }}>
            <th
              className="px-2 py-1.5 text-left font-medium"
              style={{ color: "#1e3a5f" }}
            >
              #
            </th>
            <th
              className="px-2 py-1.5 text-left font-medium"
              style={{ color: "#1e3a5f" }}
            >
              Sales Item
            </th>
            <th
              className="px-2 py-1.5 text-left font-medium"
              style={{ color: "#1e3a5f" }}
            >
              Color / Variety
            </th>
            <th
              className="px-2 py-1.5 text-right font-medium"
              style={{ color: "#1e3a5f" }}
            >
              Stems
            </th>
            <th
              className="px-2 py-1.5 text-right font-medium"
              style={{ color: "#1e3a5f" }}
            >
              Price
            </th>
            <th
              className="px-2 py-1.5 text-right font-medium"
              style={{ color: "#1e3a5f" }}
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
                style={{ borderColor: "#e0ddd8" }}
              >
                <td className="px-2 py-1.5" style={{ color: "#334155" }}>
                  {line.line_number}
                </td>
                <td className="px-2 py-1.5" style={{ color: "#334155" }}>
                  {line.sales_item_name}
                </td>
                <td className="px-2 py-1.5" style={{ color: "#334155" }}>
                  {line.color_variety ?? "--"}
                </td>
                <td
                  className="px-2 py-1.5 text-right"
                  style={{ color: "#334155" }}
                >
                  {line.stems}
                </td>
                <td
                  className="px-2 py-1.5 text-right"
                  style={{ color: "#334155" }}
                >
                  ${line.price_per_stem}
                </td>
                <td
                  className="px-2 py-1.5 text-right"
                  style={{ color: "#334155" }}
                >
                  ${lineTotal.toFixed(2)}
                </td>
              </tr>
            );
          })}
          {/* Summary row */}
          <tr
            className="border-t font-medium"
            style={{ borderColor: "#e0ddd8", backgroundColor: "#f4f1ec" }}
          >
            <td colSpan={3} className="px-2 py-1.5" style={{ color: "#1e3a5f" }}>
              Total
            </td>
            <td
              className="px-2 py-1.5 text-right"
              style={{ color: "#1e3a5f" }}
            >
              {totalStems.toLocaleString()}
            </td>
            <td className="px-2 py-1.5" />
            <td
              className="px-2 py-1.5 text-right"
              style={{ color: "#1e3a5f" }}
            >
              ${totalValue.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
