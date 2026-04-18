import { useState, useCallback, useEffect, useRef, useMemo, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "@/components/ui/dialog";
import { ArrowLeft, Pause, Play, XCircle } from "lucide-react";
import { CustomerSelector } from "@/components/order/CustomerSelector";
import { ShipViaSelector } from "@/components/order/ShipViaSelector";
import { ProductPickerPanel } from "@/components/order/ProductPickerPanel";
import { OrderFeesCard } from "@/components/order/OrderFeesCard";
import { CadencePicker } from "@/components/standing-orders/CadencePicker";
import { StandingOrderAuditLog } from "@/components/standing-orders/StandingOrderAuditLog";
import { cn } from "@/lib/utils";
import type {
  Customer,
  CustomerPricing,
  CustomerPricingData,
} from "@/types";
import type {
  StandingOrderDetail,
  StandingOrderCreateRequest,
  StandingOrderUpdateRequest,
  StandingOrderLineRequest,
  StatusChangeRequest,
} from "@/types/standing-order";

// ── Local line state ───────────────────────────────────────────
interface LineState {
  localId: string;
  serverId: string | null;
  sales_item_id: string;
  salesItemName: string;
  color_variety: string;
  stems: number;
  price_per_stem: number;
  item_fee_pct: number;
  item_fee_dollar: number;
  notes: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: "Active", bg: "bg-box-green-bg", text: "text-sidebar-hover" },
  paused: { label: "Paused", bg: "bg-box-amber-bg", text: "text-box-amber-text" },
  cancelled: { label: "Cancelled", bg: "bg-rose-action/10", text: "text-rose-action" },
};

export function StandingOrderForm() {
  const { standingOrderId } = useParams<{ standingOrderId: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(standingOrderId);

  // ── Customer & context ──────────────────────────────────────
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerPricing, setCustomerPricing] = useState<CustomerPricing[]>([]);
  const [shipVia, setShipVia] = useState("");
  const [salespersonEmail, setSalespersonEmail] = useState("");
  const [status, setStatus] = useState<string>("active");

  // ── Cadence ──────────────────────────────────────────────────
  const [frequencyWeeks, setFrequencyWeeks] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [referenceDate, setReferenceDate] = useState(todayISO);

  // ── Line items ──────────────────────────────────────────────
  const [lines, setLines] = useState<LineState[]>([]);

  // ── Fees ─────────────────────────────────────────────────────
  const [boxCharge, setBoxCharge] = useState(0);
  const [holidayChargePct, setHolidayChargePct] = useState(0);
  const [specialCharge, setSpecialCharge] = useState(0);
  const [freightCharge, setFreightCharge] = useState(0);
  const [freightChargeIncluded, setFreightChargeIncluded] = useState(false);

  // ── Notes ────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");

  // ── UI state ────────────────────────────────────────────────
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Reason dialog (for edit saves, pause, cancel) ───────────
  const [reasonDialog, setReasonDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    showApplyFuture: boolean;
    onConfirm: (reason: string, applyFuture: boolean) => void;
  }>({ open: false, title: "", description: "", showApplyFuture: false, onConfirm: () => {} });
  const [reasonText, setReasonText] = useState("");
  const [applyToFuture, setApplyToFuture] = useState(false);

  // ── Dirty tracking ──────────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false);
  const initialLoadDone = useRef(false);
  // Counter to force audit log refresh
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);

  const markDirty = useCallback(() => {
    if (initialLoadDone.current) setIsDirty(true);
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Fetch existing standing order ───────────────────────────
  useEffect(() => {
    if (!standingOrderId) {
      initialLoadDone.current = true;
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const so = await api.get<StandingOrderDetail>(
          `/api/v1/standing-orders/${standingOrderId}`
        );
        if (cancelled) return;

        setCustomer({
          id: so.customer_id,
          customer_number: 0,
          name: so.customer_name,
          salesperson: null,
          contact_name: null,
          default_ship_via: null,
          phone: null,
          location: null,
          payment_terms: null,
          email: null,
          notes: null,
          price_list_id: null,
          price_list_name: null,
          is_active: true,
        });

        setStatus(so.status);
        setFrequencyWeeks(so.frequency_weeks);
        setDaysOfWeek(so.days_of_week);
        setReferenceDate(so.reference_date);
        setShipVia(so.ship_via ?? "");
        setSalespersonEmail(so.salesperson_email ?? "");
        setBoxCharge(so.box_charge ? parseFloat(so.box_charge) : 0);
        setHolidayChargePct(so.holiday_charge_pct ? parseFloat(so.holiday_charge_pct) : 0);
        setSpecialCharge(so.special_charge ? parseFloat(so.special_charge) : 0);
        setFreightCharge(so.freight_charge ? parseFloat(so.freight_charge) : 0);
        setFreightChargeIncluded(so.freight_charge_included);
        setNotes(so.notes ?? "");

        const convertedLines: LineState[] = so.lines.map((l) => ({
          localId: crypto.randomUUID(),
          serverId: l.id,
          sales_item_id: l.sales_item_id,
          salesItemName: l.sales_item_name,
          color_variety: l.color_variety ?? "",
          stems: l.stems,
          price_per_stem: parseFloat(l.price_per_stem),
          item_fee_pct: l.item_fee_pct ? parseFloat(l.item_fee_pct) : 0,
          item_fee_dollar: l.item_fee_dollar ? parseFloat(l.item_fee_dollar) : 0,
          notes: l.notes ?? "",
        }));
        setLines(convertedLines);

        // Fetch customer pricing for the product picker
        try {
          const resp = await api.get<CustomerPricingData>(
            `/api/v1/customers/${so.customer_id}/pricing`
          );
          if (!cancelled) {
            setCustomerPricing(
              resp.items.map((item) => ({
                sales_item_id: item.sales_item_id,
                sales_item_name: item.sales_item_name,
                stems_per_order: item.stems_per_order,
                customer_price: item.effective_price,
                retail_price: item.retail_price,
                is_custom: item.source !== "retail",
              }))
            );
          }
        } catch {
          if (!cancelled) setCustomerPricing([]);
        }

        setTimeout(() => {
          initialLoadDone.current = true;
        }, 0);
      } catch (err) {
        if (!cancelled) {
          setErrors({
            submit: err instanceof Error ? err.message : "Failed to load standing order",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [standingOrderId]);

  // ── Customer selection ──────────────────────────────────────
  const handleCustomerChange = useCallback(
    async (c: Customer) => {
      setCustomer(c);
      setErrors({});
      markDirty();
      try {
        const resp = await api.get<CustomerPricingData>(
          `/api/v1/customers/${c.id}/pricing`
        );
        setCustomerPricing(
          resp.items.map((item) => ({
            sales_item_id: item.sales_item_id,
            sales_item_name: item.sales_item_name,
            stems_per_order: item.stems_per_order,
            customer_price: item.effective_price,
            retail_price: item.retail_price,
            is_custom: item.source !== "retail",
          }))
        );
      } catch {
        setCustomerPricing([]);
      }
    },
    [markDirty]
  );

  // ── Add product from picker ─────────────────────────────────
  const handleAddProduct = useCallback(
    (pricing: CustomerPricing) => {
      const price = parseFloat(pricing.customer_price);
      const newLine: LineState = {
        localId: crypto.randomUUID(),
        serverId: null,
        sales_item_id: pricing.sales_item_id,
        salesItemName: pricing.sales_item_name,
        color_variety: "",
        stems: 0,
        price_per_stem: isNaN(price) ? 0 : price,
        item_fee_pct: 0,
        item_fee_dollar: 0,
        notes: "",
      };
      setLines((prev) => [...prev, newLine]);
      markDirty();
    },
    [markDirty]
  );

  // ── Fee handler ─────────────────────────────────────────────
  const handleFeeChange = useCallback(
    (field: string, value: number | boolean) => {
      switch (field) {
        case "boxCharge":
          setBoxCharge(value as number);
          break;
        case "holidayChargePct":
          setHolidayChargePct(value as number);
          break;
        case "specialCharge":
          setSpecialCharge(value as number);
          break;
        case "freightCharge":
          setFreightCharge(value as number);
          break;
        case "freightChargeIncluded":
          setFreightChargeIncluded(value as boolean);
          break;
      }
      markDirty();
    },
    [markDirty]
  );

  // ── Line helpers ────────────────────────────────────────────
  const updateLine = useCallback(
    (localId: string, updates: Partial<LineState>) => {
      setLines((prev) =>
        prev.map((l) => (l.localId === localId ? { ...l, ...updates } : l))
      );
      markDirty();
    },
    [markDirty]
  );

  const removeLine = useCallback(
    (localId: string) => {
      setLines((prev) => prev.filter((l) => l.localId !== localId));
      markDirty();
    },
    [markDirty]
  );

  // ── Totals ──────────────────────────────────────────────────
  const totalStems = useMemo(() => lines.reduce((s, l) => s + l.stems, 0), [lines]);
  const totalDollars = useMemo(
    () => lines.reduce((s, l) => s + l.stems * l.price_per_stem, 0),
    [lines]
  );

  // ── Build request lines ─────────────────────────────────────
  const buildLineRequests = (): StandingOrderLineRequest[] =>
    lines.map((l) => ({
      id: l.serverId,
      sales_item_id: l.sales_item_id,
      stems: l.stems,
      price_per_stem: l.price_per_stem,
      item_fee_pct: l.item_fee_pct || undefined,
      item_fee_dollar: l.item_fee_dollar || undefined,
      color_variety: l.color_variety || undefined,
      notes: l.notes || undefined,
    }));

  // ── Submit ──────────────────────────────────────────────────
  const doSave = useCallback(
    async (reason?: string, applyFuture?: boolean) => {
      const newErrors: Record<string, string> = {};
      if (!customer) newErrors.customer = "Customer is required";
      if (daysOfWeek.length === 0) newErrors.cadence = "At least one day is required";
      if (!referenceDate) newErrors.referenceDate = "Start date is required";
      if (lines.length === 0) newErrors.lines = "At least one line item is required";

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setErrors({});
      setSubmitting(true);

      try {
        if (isEditMode && standingOrderId) {
          const payload: StandingOrderUpdateRequest = {
            frequency_weeks: frequencyWeeks,
            days_of_week: daysOfWeek,
            reference_date: referenceDate,
            ship_via: shipVia || undefined,
            salesperson_email: salespersonEmail || undefined,
            box_charge: boxCharge || undefined,
            holiday_charge_pct: holidayChargePct || undefined,
            special_charge: specialCharge || undefined,
            freight_charge: freightCharge || undefined,
            freight_charge_included: freightChargeIncluded,
            notes: notes || undefined,
            reason: reason ?? "",
            apply_to_future_orders: applyFuture ?? false,
            lines: buildLineRequests(),
          };

          await api.put(`/api/v1/standing-orders/${standingOrderId}`, payload);
          setSuccessMessage("Standing order updated");
          setIsDirty(false);
          setAuditRefreshKey((k) => k + 1);
          setTimeout(() => setSuccessMessage(""), 3000);
        } else {
          const payload: StandingOrderCreateRequest = {
            customer_id: customer!.id,
            frequency_weeks: frequencyWeeks,
            days_of_week: daysOfWeek,
            reference_date: referenceDate,
            ship_via: shipVia || undefined,
            salesperson_email: salespersonEmail || undefined,
            box_charge: boxCharge || undefined,
            holiday_charge_pct: holidayChargePct || undefined,
            special_charge: specialCharge || undefined,
            freight_charge: freightCharge || undefined,
            freight_charge_included: freightChargeIncluded,
            notes: notes || undefined,
            lines: buildLineRequests(),
          };

          await api.post("/api/v1/standing-orders", payload);
          setIsDirty(false);
          navigate("/standing-orders");
        }
      } catch (err) {
        setErrors({
          submit: err instanceof Error ? err.message : "Save failed",
        });
      } finally {
        setSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      customer,
      standingOrderId,
      isEditMode,
      frequencyWeeks,
      daysOfWeek,
      referenceDate,
      shipVia,
      salespersonEmail,
      boxCharge,
      holidayChargePct,
      specialCharge,
      freightCharge,
      freightChargeIncluded,
      notes,
      lines,
      navigate,
    ]
  );

  const handleSave = () => {
    if (isEditMode) {
      setReasonText("");
      setApplyToFuture(false);
      setReasonDialog({
        open: true,
        title: "Save Changes",
        description: "Provide a reason for this update.",
        showApplyFuture: true,
        onConfirm: (reason, applyFuture) => doSave(reason, applyFuture),
      });
    } else {
      doSave();
    }
  };

  // ── Status actions ──────────────────────────────────────────
  const doStatusChange = useCallback(
    async (action: "pause" | "resume" | "cancel", reason?: string) => {
      if (!standingOrderId) return;
      setSubmitting(true);
      try {
        const body: StatusChangeRequest = { reason: reason ?? undefined };
        await api.post(
          `/api/v1/standing-orders/${standingOrderId}/${action}`,
          body
        );
        // Refresh status
        const so = await api.get<StandingOrderDetail>(
          `/api/v1/standing-orders/${standingOrderId}`
        );
        setStatus(so.status);
        setAuditRefreshKey((k) => k + 1);
        setSuccessMessage(
          `Standing order ${action === "pause" ? "paused" : action === "resume" ? "resumed" : "cancelled"}`
        );
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (err) {
        setErrors({
          submit: err instanceof Error ? err.message : `${action} failed`,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [standingOrderId]
  );

  const handlePause = () => {
    setReasonText("");
    setReasonDialog({
      open: true,
      title: "Pause Standing Order",
      description: "Provide a reason for pausing this standing order.",
      showApplyFuture: false,
      onConfirm: (reason) => doStatusChange("pause", reason),
    });
  };

  const handleResume = () => {
    doStatusChange("resume");
  };

  const handleCancel = () => {
    setReasonText("");
    setReasonDialog({
      open: true,
      title: "Cancel Standing Order",
      description: "This will stop all future order generation. Provide a reason.",
      showApplyFuture: false,
      onConfirm: (reason) => doStatusChange("cancel", reason),
    });
  };

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto py-12 text-center text-sm text-muted-foreground">
        Loading standing order...
      </div>
    );
  }

  const statusBadge = STATUS_BADGES[status];

  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      {/* Success toast */}
      {successMessage && (
        <div className="rounded-lg bg-green-100 border border-green-300 text-green-800 px-4 py-2 text-sm font-medium">
          {successMessage}
        </div>
      )}

      {/* Submit-level error */}
      {errors.submit && (
        <div className="rounded-lg bg-red-100 border border-red-300 text-red-800 px-4 py-2 text-sm font-medium">
          {errors.submit}
        </div>
      )}

      {/* ── Header bar ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/standing-orders")}
            className="p-1 rounded hover:bg-accent/50 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-heading" />
          </button>
          <h1 className="text-xl font-extrabold text-slate-heading">
            {isEditMode ? "Edit Standing Order" : "New Standing Order"}
          </h1>
          {isEditMode && statusBadge && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                statusBadge.bg,
                statusBadge.text
              )}
            >
              {statusBadge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditMode && status === "active" && (
            <Button
              variant="outline"
              className="border-amber-400 text-amber-700 hover:bg-amber-50"
              onClick={handlePause}
              disabled={submitting}
            >
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </Button>
          )}
          {isEditMode && status === "paused" && (
            <Button
              variant="outline"
              className="border-green-400 text-green-700 hover:bg-green-50"
              onClick={handleResume}
              disabled={submitting}
            >
              <Play className="h-4 w-4 mr-1" />
              Resume
            </Button>
          )}
          {isEditMode && (status === "active" || status === "paused") && (
            <Button
              variant="outline"
              className="border-rose-300 text-rose-600 hover:bg-rose-50"
              onClick={handleCancel}
              disabled={submitting}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancel Order
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setProductPickerOpen(true)}
            disabled={!customer}
            title={!customer ? "Select a customer first" : undefined}
          >
            Browse Sales Items
          </Button>
          <Button
            className="bg-rose-500 hover:bg-rose-600 text-white"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? "Saving..." : isEditMode ? "Save Changes" : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Customer section ─────────────────────────────────── */}
      <div className="bg-white border border-border rounded-lg p-4">
        <h3 className="text-xs font-bold text-rose-action uppercase tracking-wider mb-3">
          Customer
        </h3>
        <div className="flex flex-wrap items-start gap-2.5">
          <div className="flex-[2] min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-heading mb-1 h-5 leading-5">
              Customer
            </label>
            {isEditMode && customer ? (
              <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/50 px-2.5 py-1 text-sm h-8 w-full cursor-not-allowed">
                <span className="flex-1 truncate">{customer.name}</span>
              </div>
            ) : (
              <CustomerSelector value={customer} onSelect={handleCustomerChange} />
            )}
          </div>

          <div className="flex-[1] min-w-[140px]">
            <label className="block text-xs font-semibold text-slate-heading mb-1 h-5 leading-5">
              Ship Via
            </label>
            <ShipViaSelector
              value={shipVia}
              onChange={(v) => {
                setShipVia(v);
                markDirty();
              }}
              customerDefault={customer?.default_ship_via}
            />
          </div>

          <div className="flex-[1] min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-heading mb-1 h-5 leading-5">
              Salesperson Email
            </label>
            <Input
              type="email"
              placeholder="jane@oregonflowers.com"
              value={salespersonEmail}
              onChange={(e) => {
                setSalespersonEmail(e.target.value);
                markDirty();
              }}
            />
          </div>
        </div>
        {errors.customer && (
          <p className="text-xs text-red-600 mt-1">{errors.customer}</p>
        )}
      </div>

      {/* ── Cadence section ──────────────────────────────────── */}
      <div className="bg-white border border-border rounded-lg p-4">
        <h3 className="text-xs font-bold text-rose-action uppercase tracking-wider mb-3">
          Cadence
        </h3>
        <CadencePicker
          frequencyWeeks={frequencyWeeks}
          daysOfWeek={daysOfWeek}
          referenceDate={referenceDate}
          onFrequencyChange={(v) => {
            setFrequencyWeeks(v);
            markDirty();
          }}
          onDaysChange={(v) => {
            setDaysOfWeek(v);
            markDirty();
          }}
          onReferenceDateChange={(v) => {
            setReferenceDate(v);
            markDirty();
          }}
        />
        {errors.cadence && (
          <p className="text-xs text-red-600 mt-1">{errors.cadence}</p>
        )}
        {errors.referenceDate && (
          <p className="text-xs text-red-600 mt-1">{errors.referenceDate}</p>
        )}
      </div>

      {/* ── Line items section ───────────────────────────────── */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-xs font-bold text-rose-action uppercase tracking-wider">
            Line Items
          </h3>
          <div className="flex items-center gap-3 text-xs text-text-body">
            <span>
              {lines.length} item{lines.length !== 1 ? "s" : ""}
            </span>
            <span className="font-medium">{totalStems.toLocaleString()} stems</span>
            <span className="font-medium">${totalDollars.toFixed(2)}</span>
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-heading text-white text-xs">
              <th className="w-[40px] text-center px-2 py-2 font-medium">#</th>
              <th className="text-left px-2 py-2 font-medium">Sales Item</th>
              <th className="w-[18%] text-center px-2 py-2 font-medium">
                Color / Variety
              </th>
              <th className="w-[10%] text-center px-2 py-2 font-medium">Stems</th>
              <th className="w-[12%] text-center px-2 py-2 font-medium">$/Stem</th>
              <th className="w-[10%] text-right px-2 py-2 font-medium">Line $</th>
              <th className="w-[40px] px-1">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const lineTotal = line.stems * line.price_per_stem;
              return (
                <Fragment key={line.localId}>
                  <tr className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="text-center px-2 py-1.5 text-xs text-text-muted">
                      {idx + 1}
                    </td>
                    <td className="px-2 py-1.5">{line.salesItemName}</td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="text"
                        value={line.color_variety}
                        onChange={(e) =>
                          updateLine(line.localId, { color_variety: e.target.value })
                        }
                        placeholder="e.g. Red"
                        className="h-7 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={line.stems || ""}
                        onChange={(e) => {
                          const val = Math.max(
                            0,
                            parseInt(e.target.value.replace(/\D/g, ""), 10) || 0
                          );
                          updateLine(line.localId, { stems: val });
                        }}
                        className="h-7 text-xs text-right [appearance:textfield]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={line.price_per_stem || ""}
                          onChange={(e) => {
                            const val =
                              parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0;
                            updateLine(line.localId, { price_per_stem: val });
                          }}
                          className="h-7 text-xs text-right pl-5"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-xs">
                      ${lineTotal.toFixed(2)}
                    </td>
                    <td className="px-1">
                      <button
                        type="button"
                        onClick={() => removeLine(line.localId)}
                        className="p-0.5 text-muted-foreground hover:text-destructive rounded transition-colors"
                      >
                        <span className="text-sm">&times;</span>
                      </button>
                    </td>
                  </tr>
                </Fragment>
              );
            })}

            {/* Add line item row */}
            <tr className="border-t border-border/30">
              <td colSpan={7} className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => setProductPickerOpen(true)}
                  disabled={!customer}
                  className="text-xs text-rose-action hover:underline disabled:text-text-muted disabled:no-underline"
                >
                  + Add Line Item
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {errors.lines && (
        <p className="text-xs text-red-600">{errors.lines}</p>
      )}

      {/* ── Fees + Details ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4">
        <OrderFeesCard
          boxCharge={boxCharge}
          holidayChargePct={holidayChargePct}
          specialCharge={specialCharge}
          freightCharge={freightCharge}
          freightChargeIncluded={freightChargeIncluded}
          onChange={handleFeeChange}
        />
        <div className="bg-white border border-border rounded-lg p-4 flex-1 min-w-[260px]">
          <h3 className="text-sm font-bold text-slate-heading mb-3">Details</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-heading mb-1">
              Notes
            </label>
            <textarea
              placeholder="Additional notes for this standing order..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                markDirty();
              }}
              className="w-full min-h-[80px] rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
            />
          </div>
        </div>
      </div>

      {/* ── Audit trail (edit mode only) ─────────────────────── */}
      {isEditMode && standingOrderId && (
        <StandingOrderAuditLog
          key={auditRefreshKey}
          standingOrderId={standingOrderId}
        />
      )}

      {/* ── Product picker panel ─────────────────────────────── */}
      <ProductPickerPanel
        open={productPickerOpen}
        onOpenChange={setProductPickerOpen}
        onAddProduct={handleAddProduct}
        customerPricing={customerPricing}
      />

      {/* ── Reason dialog ────────────────────────────────────── */}
      <Dialog
        open={reasonDialog.open}
        onOpenChange={(open) => {
          if (!open) setReasonDialog((prev) => ({ ...prev, open: false }));
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonDialog.title}</DialogTitle>
            <DialogDescription>{reasonDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="block text-xs font-semibold text-slate-heading mb-1">
                Reason
              </label>
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Enter reason..."
                className="w-full min-h-[60px] rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
              />
            </div>
            {reasonDialog.showApplyFuture && (
              <label className="flex items-center gap-2 text-sm text-text-body">
                <input
                  type="checkbox"
                  checked={applyToFuture}
                  onChange={(e) => setApplyToFuture(e.target.checked)}
                  className="rounded border-input"
                />
                Apply changes to future generated orders
              </label>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReasonDialog((prev) => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button
              className="bg-rose-500 hover:bg-rose-600 text-white"
              disabled={!reasonText.trim()}
              onClick={() => {
                setReasonDialog((prev) => ({ ...prev, open: false }));
                reasonDialog.onConfirm(reasonText.trim(), applyToFuture);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
