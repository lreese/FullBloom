import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { DuplicateError } from "@/services/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { OrderContextRow } from "@/components/order/OrderContextRow";
import { LineItemTable, type OrderLineState } from "@/components/order/LineItemTable";
import { ProductPickerPanel } from "@/components/order/ProductPickerPanel";
import { BoxGroupingsLegend } from "@/components/order/BoxGroupingsLegend";
import { OrderFeesCard } from "@/components/order/OrderFeesCard";
import { OrderDetailsCard } from "@/components/order/OrderDetailsCard";
import { OrderAuditLog } from "@/components/order/OrderAuditLog";
import type {
  Customer,
  CustomerPricing,
  CustomerPricingData,
  OrderCreateRequest,
  OrderCreateResponse,
  OrderDetailResponse,
  OrderUpdateRequest,
  OrderLineUpdateRequest,
} from "@/types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OrderForm() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(orderId);

  // ── Customer & context ──────────────────────────────────────
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerPricing, setCustomerPricing] = useState<CustomerPricing[]>([]);
  const [orderLabel, setOrderLabel] = useState("");
  const [orderDate, setOrderDate] = useState(todayISO);
  const [shipVia, setShipVia] = useState("");
  const [orderNumber, setOrderNumber] = useState("");

  // ── Line items ──────────────────────────────────────────────
  const [lines, setLines] = useState<OrderLineState[]>([]);

  // ── Order fees ──────────────────────────────────────────────
  const [boxCharge, setBoxCharge] = useState(0);
  const [holidayChargePct, setHolidayChargePct] = useState(0);
  const [specialCharge, setSpecialCharge] = useState(0);
  const [freightCharge, setFreightCharge] = useState(0);
  const [freightChargeIncluded, setFreightChargeIncluded] = useState(false);

  // ── Order details ───────────────────────────────────────────
  const [poNumber, setPoNumber] = useState("");
  const [salespersonEmail, setSalespersonEmail] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // ── UI state ────────────────────────────────────────────────
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: "" });

  // ── Dirty tracking for unsaved changes warning ──────────────
  const [isDirty, setIsDirty] = useState(false);
  const initialLoadDone = useRef(false);

  // Mark form dirty on any state change after initial load
  const markDirty = useCallback(() => {
    if (initialLoadDone.current) {
      setIsDirty(true);
    }
  }, []);

  // Warn on page unload if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Fetch existing order in edit mode ───────────────────────
  useEffect(() => {
    if (!orderId) {
      initialLoadDone.current = true;
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const order = await api.get<OrderDetailResponse>(
          `/api/v1/orders/${orderId}`
        );

        if (cancelled) return;

        // Set customer (partial — enough for display and locking)
        setCustomer({
          id: order.customer.id,
          customer_number: order.customer.customer_number,
          name: order.customer.name,
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

        // Fetch customer pricing for the product picker
        try {
          const resp = await api.get<CustomerPricingData>(
            `/api/v1/customers/${order.customer.id}/pricing`
          );
          if (!cancelled) {
            const mapped: CustomerPricing[] = resp.items.map((item) => ({
              sales_item_id: item.sales_item_id,
              sales_item_name: item.sales_item_name,
              stems_per_order: item.stems_per_order,
              customer_price: item.effective_price,
              retail_price: item.retail_price,
              is_custom: item.source !== "retail",
            }));
            setCustomerPricing(mapped);
          }
        } catch {
          if (!cancelled) setCustomerPricing([]);
        }

        setOrderNumber(order.order_number);
        setOrderDate(order.order_date);
        setShipVia(order.ship_via ?? "");
        setOrderLabel(order.order_label ?? "");
        setBoxCharge(order.box_charge ? parseFloat(order.box_charge) : 0);
        setHolidayChargePct(order.holiday_charge_pct ? parseFloat(order.holiday_charge_pct) : 0);
        setSpecialCharge(order.special_charge ? parseFloat(order.special_charge) : 0);
        setFreightCharge(order.freight_charge ? parseFloat(order.freight_charge) : 0);
        setFreightChargeIncluded(order.freight_charge_included);
        setPoNumber(order.po_number ?? "");
        setSalespersonEmail(order.salesperson_email ?? "");
        setOrderNotes(order.order_notes ?? "");

        // Convert lines
        const convertedLines: OrderLineState[] = order.lines.map((l) => ({
          id: l.id,
          sales_item_id: l.sales_item.id,
          stems: l.stems,
          price_per_stem: parseFloat(l.price_per_stem),
          varietyId: "",
          salesItemName: l.sales_item.name,
          listPrice: parseFloat(l.list_price_per_stem),
          expanded: false,
          color_variety: l.color_variety ?? "",
          box_reference: l.box_reference,
          item_fee_pct: l.item_fee_pct ? parseFloat(l.item_fee_pct) : 0,
          item_fee_dollar: l.item_fee_dollar ? parseFloat(l.item_fee_dollar) : 0,
          box_quantity: l.box_quantity ?? 0,
          bunches_per_box: l.bunches_per_box ?? 0,
          stems_per_bunch: l.stems_per_bunch ?? 0,
          is_special: l.is_special,
          sleeve: l.sleeve ?? "",
          upc: l.upc ?? "",
          notes: l.notes ?? "",
        }));
        setLines(convertedLines);

        // Allow dirty tracking after initial load settles
        setTimeout(() => {
          initialLoadDone.current = true;
        }, 0);
      } catch (err) {
        if (!cancelled) {
          setErrors({ submit: err instanceof Error ? err.message : "Failed to load order" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // ── Customer selection handler ──────────────────────────────
  const handleCustomerChange = useCallback(async (c: Customer) => {
    setCustomer(c);
    setOrderLabel("");
    setErrors({});
    markDirty();

    try {
      const resp = await api.get<CustomerPricingData>(
        `/api/v1/customers/${c.id}/pricing`
      );
      // Map CustomerPricingItem[] to CustomerPricing[] for the product picker
      const mapped: CustomerPricing[] = resp.items.map((item) => ({
        sales_item_id: item.sales_item_id,
        sales_item_name: item.sales_item_name,
        stems_per_order: item.stems_per_order,
        customer_price: item.effective_price,
        retail_price: item.retail_price,
        is_custom: item.source !== "retail",
      }));
      setCustomerPricing(mapped);
    } catch {
      setCustomerPricing([]);
    }
  }, [markDirty]);

  // ── Add product from picker ─────────────────────────────────
  const handleAddProduct = useCallback(
    (pricing: CustomerPricing) => {
      const price = parseFloat(pricing.customer_price);

      const newLine: OrderLineState = {
        id: crypto.randomUUID(),
        isNew: true,
        sales_item_id: pricing.sales_item_id,
        stems: 0,
        price_per_stem: isNaN(price) ? 0 : price,
        varietyId: "",
        salesItemName: pricing.sales_item_name,
        listPrice: isNaN(price) ? 0 : price,
        expanded: false,
        color_variety: "",
        box_reference: null,
        item_fee_pct: 0,
        item_fee_dollar: 0,
        box_quantity: 0,
        bunches_per_box: 0,
        stems_per_bunch: pricing.stems_per_order,
        is_special: false,
        sleeve: "",
        upc: "",
        notes: "",
      };
      setLines((prev) => [...prev, newLine]);
      markDirty();
    },
    [markDirty]
  );

  // ── Wrapped setters that mark dirty ─────────────────────────
  const setLinesWrapped = useCallback((val: OrderLineState[] | ((prev: OrderLineState[]) => OrderLineState[])) => {
    setLines(val);
    markDirty();
  }, [markDirty]);

  // ── Fee field handler ───────────────────────────────────────
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

  // ── Detail field handler ────────────────────────────────────
  const handleDetailChange = useCallback(
    (field: string, value: string) => {
      switch (field) {
        case "poNumber":
          setPoNumber(value);
          break;
        case "salespersonEmail":
          setSalespersonEmail(value);
          break;
        case "orderNotes":
          setOrderNotes(value);
          break;
      }
      markDirty();
    },
    [markDirty]
  );

  // ── Clear form ──────────────────────────────────────────────
  const clearForm = useCallback(() => {
    setCustomer(null);
    setCustomerPricing([]);
    setOrderLabel("");
    setOrderDate(todayISO());
    setShipVia("");
    setLines([]);
    setBoxCharge(0);
    setHolidayChargePct(0);
    setSpecialCharge(0);
    setFreightCharge(0);
    setFreightChargeIncluded(false);
    setPoNumber("");
    setSalespersonEmail("");
    setOrderNotes("");
    setErrors({});
    setIsDirty(false);
  }, []);

  // ── Submit ──────────────────────────────────────────────────
  const submitOrder = useCallback(
    async (forceDuplicate = false) => {
      // Validate
      const newErrors: Record<string, string> = {};
      if (!customer) newErrors.customer = "Customer is required";
      if (!orderDate) newErrors.orderDate = "Date is required";
      if (lines.length === 0) newErrors.lines = "At least one line item is required";

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setErrors({});
      setSubmitting(true);

      try {
        if (isEditMode && orderId) {
          // ── PUT (update) ──
          const payload: OrderUpdateRequest = {
            order_date: orderDate,
            ship_via: shipVia || undefined,
            order_label: orderLabel || undefined,
            freight_charge_included: freightChargeIncluded,
            box_charge: boxCharge || undefined,
            holiday_charge_pct: holidayChargePct || undefined,
            special_charge: specialCharge || undefined,
            freight_charge: freightCharge || undefined,
            order_notes: orderNotes || undefined,
            po_number: poNumber || undefined,
            salesperson_email: salespersonEmail || undefined,
            lines: lines.map((l): OrderLineUpdateRequest => ({
              id: l.isNew ? null : l.id,
              sales_item_id: l.sales_item_id,
              assorted: false,
              color_variety: l.color_variety || null,
              stems: l.stems,
              price_per_stem: l.price_per_stem,
              item_fee_pct: l.item_fee_pct || null,
              item_fee_dollar: l.item_fee_dollar || null,
              notes: l.notes || null,
              box_quantity: l.box_quantity || null,
              bunches_per_box: l.bunches_per_box || null,
              stems_per_bunch: l.stems_per_bunch || null,
              box_reference: l.box_reference || null,
              is_special: l.is_special,
              sleeve: l.sleeve || null,
              upc: l.upc || null,
            })),
          };

          await api.put(`/api/v1/orders/${orderId}`, payload);
          setSuccessMessage("Order updated successfully");
          setIsDirty(false);
          setTimeout(() => setSuccessMessage(""), 3000);
        } else {
          // ── POST (create) ──
          const payload: OrderCreateRequest = {
            customer_id: customer!.id,
            order_date: orderDate,
            ship_via: shipVia || undefined,
            order_label: orderLabel || undefined,
            freight_charge_included: freightChargeIncluded,
            box_charge: boxCharge || undefined,
            holiday_charge_pct: holidayChargePct || undefined,
            special_charge: specialCharge || undefined,
            freight_charge: freightCharge || undefined,
            order_notes: orderNotes || undefined,
            po_number: poNumber || undefined,
            salesperson_email: salespersonEmail || undefined,
            force_duplicate: forceDuplicate,
            lines: lines.map((l) => ({
              sales_item_id: l.sales_item_id,
              stems: l.stems,
              price_per_stem: l.price_per_stem,
              assorted: undefined,
              color_variety: l.color_variety || undefined,
              item_fee_pct: l.item_fee_pct || undefined,
              item_fee_dollar: l.item_fee_dollar || undefined,
              notes: l.notes || undefined,
              box_quantity: l.box_quantity || undefined,
              bunches_per_box: l.bunches_per_box || undefined,
              stems_per_bunch: l.stems_per_bunch || undefined,
              box_reference: l.box_reference || undefined,
              is_special: l.is_special || undefined,
              sleeve: l.sleeve || undefined,
              upc: l.upc || undefined,
            })),
          };

          const result = await api.post<OrderCreateResponse>(
            "/api/v1/orders",
            payload
          );
          setSuccessMessage(
            `Order ${result.order_number} created successfully`
          );
          setIsDirty(false);
          setTimeout(() => {
            setSuccessMessage("");
            clearForm();
          }, 2000);
        }
      } catch (err) {
        if (err instanceof DuplicateError) {
          setDuplicateDialog({ open: true, message: err.message });
        } else if (err instanceof Error) {
          setErrors({ submit: err.message });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [
      customer,
      orderId,
      isEditMode,
      orderDate,
      shipVia,
      orderLabel,
      lines,
      boxCharge,
      holidayChargePct,
      specialCharge,
      freightCharge,
      freightChargeIncluded,
      poNumber,
      salespersonEmail,
      orderNotes,
      clearForm,
    ]
  );

  const hasBoxRefs = lines.some((l) => l.box_reference && l.box_reference.trim() !== "");

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto py-12 text-center text-sm text-muted-foreground">
        Loading order...
      </div>
    );
  }

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

      {/* 1. Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[#1e3a5f]">
          {isEditMode ? `Edit Order: ${orderNumber}` : "New Order"}
        </h1>
        <div className="flex items-center gap-2">
          {isEditMode && (
            <Button
              variant="outline"
              onClick={() => navigate("/orders")}
            >
              Back to Orders
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
            onClick={() => submitOrder(false)}
            disabled={submitting}
          >
            {submitting
              ? "Saving..."
              : isEditMode
                ? "Save Changes"
                : "Submit Order"}
          </Button>
        </div>
      </div>

      {/* 2. Order context row */}
      <OrderContextRow
        customer={customer}
        onCustomerChange={handleCustomerChange}
        orderLabel={orderLabel}
        onOrderLabelChange={(v) => { setOrderLabel(v); markDirty(); }}
        orderDate={orderDate}
        onOrderDateChange={(v) => { setOrderDate(v); markDirty(); }}
        shipVia={shipVia}
        onShipViaChange={(v) => { setShipVia(v); markDirty(); }}
        customerDefaultShipVia={customer?.default_ship_via}
        customerLocked={isEditMode}
      />
      {/* Inline validation errors */}
      {(errors.customer || errors.orderDate) && (
        <div className="flex gap-4 text-xs text-red-600">
          {errors.customer && <span>{errors.customer}</span>}
          {errors.orderDate && <span>{errors.orderDate}</span>}
        </div>
      )}

      {/* 3. Line item table */}
      <div className="overflow-x-auto">
        <LineItemTable
          lines={lines}
          onLinesChange={setLinesWrapped}
          customerPricing={customerPricing}
        />
      </div>
      {errors.lines && (
        <p className="text-xs text-red-600">{errors.lines}</p>
      )}

      {/* 4. Box groupings legend */}
      {hasBoxRefs && <BoxGroupingsLegend lines={lines} />}

      {/* 5. Order fees + details cards */}
      <div className="flex flex-col sm:flex-row gap-4">
        <OrderFeesCard
          boxCharge={boxCharge}
          holidayChargePct={holidayChargePct}
          specialCharge={specialCharge}
          freightCharge={freightCharge}
          freightChargeIncluded={freightChargeIncluded}
          onChange={handleFeeChange}
        />
        <OrderDetailsCard
          poNumber={poNumber}
          salespersonEmail={salespersonEmail}
          orderNotes={orderNotes}
          onChange={handleDetailChange}
        />
      </div>

      {/* 6. Audit log (edit mode only) */}
      {isEditMode && orderId && <OrderAuditLog orderId={orderId} />}

      {/* Product picker panel */}
      <ProductPickerPanel
        open={productPickerOpen}
        onOpenChange={setProductPickerOpen}
        onAddProduct={handleAddProduct}
        customerPricing={customerPricing}
      />

      {/* Duplicate warning dialog */}
      <Dialog
        open={duplicateDialog.open}
        onOpenChange={(open) =>
          setDuplicateDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Possible Duplicate Order</DialogTitle>
            <DialogDescription>{duplicateDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDuplicateDialog({ open: false, message: "" })
              }
            >
              Cancel
            </Button>
            <Button
              className="bg-rose-500 hover:bg-rose-600 text-white"
              onClick={() => {
                setDuplicateDialog({ open: false, message: "" });
                submitOrder(true);
              }}
            >
              Submit Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
