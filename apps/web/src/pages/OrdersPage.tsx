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
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  Search,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type {
  OrderListItem,
  OrderListResponse,
  OrderDetailResponse,
  Customer,
} from "@/types";

const PAGE_SIZE = 25;

export function OrdersPage() {
  const navigate = useNavigate();

  // ── Filter state ──────────────────────────────────────────
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
      // Clear cache in case it was expanded
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f4f1ec" }}>
      <div className="max-w-[1400px] mx-auto px-4 py-6 sm:px-6">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "#1e3a5f" }}>
            Orders
          </h1>
          <Button
            onClick={() => navigate("/orders/new")}
            className="gap-1.5"
            style={{ backgroundColor: "#c27890", color: "white" }}
          >
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        </div>

        {/* ── Filters ────────────────────────────────────── */}
        <div
          className="rounded-lg border p-4 mb-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6"
          style={{ backgroundColor: "white", borderColor: "#e0ddd8" }}
        >
          <div className="relative lg:col-span-1">
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
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-[#94a3b8] uppercase tracking-wide">From</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-[#94a3b8] uppercase tracking-wide">To</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          >
            <option value="">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={salesperson}
            onChange={(e) => setSalesperson(e.target.value)}
            className="h-10 rounded-lg border border-[#e0ddd8] bg-white px-3 text-sm text-[#334155] focus:ring-2 focus:ring-[#c27890] focus:outline-none"
          >
            <option value="">All Salespeople</option>
            {salespersonOptions.map((email) => (
              <option key={email} value={email}>{email}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-[#334155] whitespace-nowrap self-center">
            <input
              type="checkbox"
              checked={fromStandingOrder}
              onChange={(e) => setFromStandingOrder(e.target.checked)}
              className="rounded border-input"
            />
            From Standing Orders
          </label>
        </div>

        {/* ── Table ──────────────────────────────────────── */}
        <div
          className="rounded-lg border overflow-hidden"
          style={{ backgroundColor: "white", borderColor: "#e0ddd8" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#faf9f7" }}>
                  <th className="w-8 px-2 py-2.5" />
                  <th
                    className="px-3 py-2.5 text-left font-medium"
                    style={{ color: "#1e3a5f" }}
                  >
                    Order #
                  </th>
                  <th
                    className="px-3 py-2.5 text-left font-medium"
                    style={{ color: "#1e3a5f" }}
                  >
                    Customer
                  </th>
                  <th
                    className="px-3 py-2.5 text-left font-medium"
                    style={{ color: "#1e3a5f" }}
                  >
                    Date
                  </th>
                  <th
                    className="px-3 py-2.5 text-left font-medium"
                    style={{ color: "#1e3a5f" }}
                  >
                    Ship Via
                  </th>
                  <th
                    className="px-3 py-2.5 text-center font-medium"
                    style={{ color: "#1e3a5f" }}
                  >
                    Lines
                  </th>
                  <th
                    className="px-3 py-2.5 text-center font-medium"
                    style={{ color: "#1e3a5f" }}
                  >
                    Stems
                  </th>
                  <th
                    className="px-3 py-2.5 text-right font-medium"
                    style={{ color: "#1e3a5f" }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <Loader2
                        className="h-5 w-5 animate-spin mx-auto"
                        style={{ color: "#94a3b8" }}
                      />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-12"
                      style={{ color: "#94a3b8" }}
                    >
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  items.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      isExpanded={expandedId === order.id}
                      expandedDetail={
                        expandedId === order.id ? expandedDetail : null
                      }
                      detailLoading={
                        expandedId === order.id && detailLoading
                      }
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
  isExpanded: boolean;
  expandedDetail: OrderDetailResponse | null;
  detailLoading: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function OrderRow({
  order,
  isExpanded,
  expandedDetail,
  detailLoading,
  onToggle,
  onEdit,
  onDelete,
}: OrderRowProps) {
  return (
    <>
      <tr
        className="border-t hover:bg-[#faf9f7] transition-colors cursor-pointer"
        style={{ borderColor: "#e0ddd8" }}
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
        <td className="px-3 py-2.5">
          <span className="flex items-center gap-1.5">
            <span
              className="font-medium hover:underline cursor-pointer"
              style={{ color: "#c27890" }}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            >
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
        </td>
        <td className="px-3 py-2.5" style={{ color: "#334155" }}>
          {order.customer_name}
        </td>
        <td className="px-3 py-2.5" style={{ color: "#334155" }}>
          {order.order_date}
        </td>
        <td className="px-3 py-2.5" style={{ color: "#334155" }}>
          {order.ship_via ?? "--"}
        </td>
        <td className="px-3 py-2.5 text-center">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "#dbeafe", color: "#1e40af" }}
          >
            {order.lines_count}
          </span>
        </td>
        <td className="px-3 py-2.5 text-center">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "#e8f0e8", color: "#2d4a2d" }}
          >
            {order.total_stems.toLocaleString()}
          </span>
        </td>
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
          <td colSpan={8} className="px-6 py-4" style={{ backgroundColor: "#faf9f7" }}>
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
