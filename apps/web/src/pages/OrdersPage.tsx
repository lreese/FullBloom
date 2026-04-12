import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  Search,
  Loader2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { useTableState } from "@/hooks/useTableState";
import type { ColumnDef } from "@/hooks/useTableState";
import { ColumnFilter } from "@/components/common/ColumnFilter";
import { cn } from "@/lib/utils";
import type {
  OrderListItem,
  OrderListResponse,
  OrderDetailResponse,
  Customer,
} from "@/types";

const PAGE_SIZE = 25;

const ALL_COLUMNS: ColumnDef[] = [
  { key: "order_number", label: "Order #", filterable: false, sortable: true, defaultVisible: true },
  { key: "customer_name", label: "Customer", filterable: true, sortable: true, defaultVisible: true },
  { key: "order_date", label: "Date", filterable: false, sortable: true, defaultVisible: true },
  { key: "ship_via", label: "Ship Via", filterable: true, sortable: true, defaultVisible: true },
  { key: "lines_count", label: "Lines", filterable: false, sortable: true, defaultVisible: true },
  { key: "total_stems", label: "Stems", filterable: false, sortable: true, defaultVisible: true },
  { key: "salesperson_email", label: "Salesperson", filterable: true, sortable: true, defaultVisible: false },
  { key: "created_at", label: "Created", filterable: false, sortable: true, defaultVisible: false },
  { key: "po_number", label: "PO #", filterable: false, sortable: true, defaultVisible: false },
];

const SEARCHABLE_FIELDS: string[] = [];

export function OrdersPage() {
  const navigate = useNavigate();

  // ── Filter state (server-side) ────────────────────────────
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [fromStandingOrder, setFromStandingOrder] = useState(false);

  // ── Data state ────────────────────────────────────────────
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salespersonOptions, setSalespersonOptions] = useState<string[]>([]);

  // ── Expanded rows ─────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const detailCache = useRef<Record<string, OrderDetailResponse>>({});
  const [expandedDetail, setExpandedDetail] = useState<OrderDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Delete dialog ─────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<OrderListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Table state (client-side sorting, filtering, columns) ─
  const tableState = useTableState<OrderListItem>({
    data: items,
    columns: ALL_COLUMNS,
    searchableFields: SEARCHABLE_FIELDS,
    storageKey: "fullbloom-orders-columns",
    defaultSort: { key: "order_date", direction: "desc" },
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
  } = tableState;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch customers for dropdown
  useEffect(() => {
    api.get<Customer[]>("/api/v1/customers?active=true").then(setCustomers).catch(() => {});
  }, []);

  // Fetch unique salesperson emails for dropdown
  useEffect(() => {
    api.get<OrderListResponse>("/api/v1/orders?limit=100&offset=0")
      .then((res) => {
        const emails = new Set<string>();
        res.items.forEach((o) => { if (o.salesperson_email) emails.add(o.salesperson_email); });
        setSalespersonOptions(Array.from(emails).sort());
      })
      .catch(() => {});
  }, []);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("offset", String(offset));
      params.set("limit", String(PAGE_SIZE));
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (customerId) params.set("customer_id", customerId);
      if (salesperson) params.set("salesperson_email", salesperson);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (fromStandingOrder) params.set("from_standing_order", "true");

      const res = await api.get<OrderListResponse>(`/api/v1/orders?${params}`);
      setItems(res.items);
      setTotal(res.total);
    } catch {
      // TODO: toast
    } finally {
      setLoading(false);
    }
  }, [offset, dateFrom, dateTo, customerId, salesperson, debouncedSearch, fromStandingOrder]);

  useEffect(() => {
    setOffset(0);
  }, [dateFrom, dateTo, customerId, salesperson, debouncedSearch, fromStandingOrder]);

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
      const detail = await api.get<OrderDetailResponse>(`/api/v1/orders/${id}`);
      detailCache.current[id] = detail;
      setExpandedDetail(detail);
    } catch {
      setExpandedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/api/v1/orders/${deleteTarget.id}`);
      setDeleteTarget(null);
      delete detailCache.current[deleteTarget.id];
      if (expandedId === deleteTarget.id) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
      fetchOrders();
    } catch {
      // TODO: toast
    } finally {
      setDeleting(false);
    }
  };

  // ── Pagination helpers ────────────────────────────────────
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

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
      tableState.reorderColumns(headerDragIdx, headerDropIdx);
    }
    setHeaderDragIdx(null);
    setHeaderDropIdx(null);
  }, [headerDragIdx, headerDropIdx, tableState]);

  const handleHeaderDragEnd = useCallback(() => {
    setHeaderDragIdx(null);
    setHeaderDropIdx(null);
  }, []);

  // ── Render cell content ───────────────────────────────────
  const renderCell = (col: ColumnDef, order: OrderListItem) => {
    switch (col.key) {
      case "order_number":
        return (
          <span className="flex items-center gap-1.5">
            <span className="font-medium" style={{ color: "#c27890" }}>
              {order.order_number}
            </span>
            {order.standing_order_id && (
              <span
                className="inline-flex items-center justify-center rounded-full p-1 bg-[#f3e8ff] text-[#6b21a8]"
                title="From standing order"
              >
                <RefreshCw className="h-3 w-3" />
              </span>
            )}
          </span>
        );
      case "customer_name":
        return (
          <span className="font-medium" style={{ color: "#334155" }}>
            {order.customer_name}
          </span>
        );
      case "order_date":
        return (
          <span style={{ color: "#334155" }}>
            {order.order_date}
          </span>
        );
      case "ship_via":
        return (
          <span style={{ color: "#334155" }}>
            {order.ship_via ?? "\u2014"}
          </span>
        );
      case "lines_count":
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "#dbeafe", color: "#1e40af" }}
          >
            {order.lines_count}
          </span>
        );
      case "total_stems":
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "#e8f0e8", color: "#2d4a2d" }}
          >
            {order.total_stems.toLocaleString()}
          </span>
        );
      case "salesperson_email":
        return (
          <span style={{ color: "#64748b" }}>
            {order.salesperson_email ?? "\u2014"}
          </span>
        );
      case "created_at":
        return (
          <span style={{ color: "#334155" }}>
            {new Date(order.created_at).toLocaleDateString()}
          </span>
        );
      case "po_number":
        return (
          <span style={{ color: "#334155" }}>
            {order.po_number ?? "\u2014"}
          </span>
        );
      default: {
        const val = order[col.key as keyof OrderListItem];
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
            <h1 className="text-lg font-bold text-[#1e3a5f]">Orders</h1>
            {hasActiveFilters && (
              <button
                className="text-xs text-[#94a3b8] hover:text-[#334155] border border-[#e0ddd8] rounded px-2 py-1"
                onClick={clearAllFilters}
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
          <Button
            onClick={() => navigate("/orders/new")}
            className="gap-1.5"
            style={{ backgroundColor: "#c27890", color: "white" }}
          >
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        </div>

        {/* ── Filters bar ────────────────────────────────── */}
        <div
          className="rounded-lg border p-3 mb-4 space-y-3"
          style={{ backgroundColor: "white", borderColor: "#e0ddd8" }}
        >
          {/* Row 1: Search + Salesperson + Standing Orders toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative min-w-[140px] max-w-[280px] flex-1">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: "#94a3b8" }}
              />
              <Input
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={salesperson}
              onChange={(e) => setSalesperson(e.target.value)}
              className="h-9 rounded-lg border border-[#e0ddd8] bg-white px-3 text-sm text-[#334155] focus:ring-2 focus:ring-[#c27890] focus:outline-none"
            >
              <option value="">All Salespeople</option>
              {salespersonOptions.map((email) => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-[#334155] whitespace-nowrap">
              <input
                type="checkbox"
                checked={fromStandingOrder}
                onChange={(e) => setFromStandingOrder(e.target.checked)}
                className="rounded border-input"
              />
              From Standing Orders
            </label>
          </div>
          {/* Row 2: Date range */}
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="From (YYYY-MM-DD)"
              placeholder="From (YYYY-MM-DD)"
            />
            <span className="text-sm text-[#94a3b8]">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="To (YYYY-MM-DD)"
              placeholder="To (YYYY-MM-DD)"
            />
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────── */}
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
                      No orders found.
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
                  filteredData.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      activeColumns={activeColumns}
                      renderCell={renderCell}
                      isExpanded={expandedId === order.id}
                      expandedDetail={
                        expandedId === order.id ? expandedDetail : null
                      }
                      detailLoading={
                        expandedId === order.id && detailLoading
                      }
                      colSpan={colSpan}
                      onToggle={() => toggleExpand(order.id)}
                      onEdit={() =>
                        navigate(`/orders/${order.id}/edit`)
                      }
                      onDelete={() => setDeleteTarget(order)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ───────────────────────────────── */}
          <div
            className="flex items-center justify-between px-4 py-3 border-t text-sm"
            style={{ borderColor: "#e0ddd8", color: "#334155" }}
          >
            <span>
              Showing {pageStart}-{pageEnd} of {total} orders
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete confirmation dialog ───────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete order{" "}
              <strong>{deleteTarget?.order_number}</strong>? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Row component ─────────────────────────────────────────────

interface OrderRowProps {
  order: OrderListItem;
  activeColumns: ColumnDef[];
  renderCell: (col: ColumnDef, order: OrderListItem) => React.ReactNode;
  isExpanded: boolean;
  expandedDetail: OrderDetailResponse | null;
  detailLoading: boolean;
  colSpan: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function OrderRow({
  order,
  activeColumns,
  renderCell,
  isExpanded,
  expandedDetail,
  detailLoading,
  colSpan,
  onToggle,
  onEdit,
  onDelete,
}: OrderRowProps) {
  return (
    <>
      <tr
        className="border-b border-[#f0ede8] hover:bg-[#faf8f5] transition-colors cursor-pointer"
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
            {renderCell(col, order)}
          </td>
        ))}
        <td className="px-3 py-2.5 text-right">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onEdit}
              title="Edit order"
            >
              <Pencil className="h-3.5 w-3.5" style={{ color: "#94a3b8" }} />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onDelete}
              title="Delete order"
            >
              <Trash2 className="h-3.5 w-3.5" style={{ color: "#94a3b8" }} />
            </Button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr style={{ borderColor: "#e0ddd8" }}>
          <td colSpan={colSpan} className="px-6 py-4" style={{ backgroundColor: "#faf9f7" }}>
            {detailLoading ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "#94a3b8" }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading line items...
              </div>
            ) : expandedDetail ? (
              <LineItemsTable detail={expandedDetail} />
            ) : (
              <span className="text-sm" style={{ color: "#94a3b8" }}>
                Could not load order details.
              </span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Line items sub-table ──────────────────────────────────────

function LineItemsTable({ detail }: { detail: OrderDetailResponse }) {
  return (
    <div className="rounded border overflow-hidden" style={{ borderColor: "#e0ddd8" }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ backgroundColor: "#f4f1ec" }}>
            <th className="px-2 py-1.5 text-left font-medium" style={{ color: "#1e3a5f" }}>
              #
            </th>
            <th className="px-2 py-1.5 text-left font-medium" style={{ color: "#1e3a5f" }}>
              Product
            </th>
            <th className="px-2 py-1.5 text-left font-medium" style={{ color: "#1e3a5f" }}>
              Color / Variety
            </th>
            <th className="px-2 py-1.5 text-right font-medium" style={{ color: "#1e3a5f" }}>
              Stems
            </th>
            <th className="px-2 py-1.5 text-right font-medium" style={{ color: "#1e3a5f" }}>
              List Price
            </th>
            <th className="px-2 py-1.5 text-right font-medium" style={{ color: "#1e3a5f" }}>
              Price
            </th>
            <th className="px-2 py-1.5 text-right font-medium" style={{ color: "#1e3a5f" }}>
              Eff. Price
            </th>
            <th className="px-2 py-1.5 text-left font-medium" style={{ color: "#1e3a5f" }}>
              Box Ref
            </th>
          </tr>
        </thead>
        <tbody>
          {detail.lines.map((line) => {
            const isOverridden = line.price_per_stem !== line.list_price_per_stem;
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
                  {line.sales_item.name}
                </td>
                <td className="px-2 py-1.5" style={{ color: "#334155" }}>
                  {line.color_variety ?? "--"}
                </td>
                <td className="px-2 py-1.5 text-right" style={{ color: "#334155" }}>
                  {line.stems}
                </td>
                <td className="px-2 py-1.5 text-right" style={{ color: "#334155" }}>
                  ${line.list_price_per_stem}
                </td>
                <td
                  className="px-2 py-1.5 text-right font-medium"
                  style={{ color: isOverridden ? "#c27890" : "#334155" }}
                >
                  ${line.price_per_stem}
                </td>
                <td className="px-2 py-1.5 text-right" style={{ color: "#334155" }}>
                  ${line.effective_price_per_stem}
                </td>
                <td className="px-2 py-1.5" style={{ color: "#334155" }}>
                  {line.box_reference ?? "--"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
