import { useState, useCallback } from "react";
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
import type {
  Customer,
  CustomerPricing,
  SalesItem,
  Variety,
  OrderCreateRequest,
  OrderCreateResponse,
} from "@/types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OrderForm() {
  // ── Customer & context ──────────────────────────────────────
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerPricing, setCustomerPricing] = useState<CustomerPricing[]>([]);
  const [orderLabel, setOrderLabel] = useState("");
  const [orderDate, setOrderDate] = useState(todayISO);
  const [shipVia, setShipVia] = useState("");

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
  const [duplicateDialog, setDuplicateDialog] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: "" });

  // ── Customer selection handler ──────────────────────────────
  const handleCustomerChange = useCallback(async (c: Customer) => {
    setCustomer(c);
    setOrderLabel("");
    setErrors({});

    try {
      const pricing = await api.get<CustomerPricing[]>(
        `/api/v1/customers/${c.id}/pricing`
      );
      setCustomerPricing(pricing);
    } catch {
      setCustomerPricing([]);
    }
  }, []);

  // ── Add product from picker ─────────────────────────────────
  const handleAddProduct = useCallback(
    (salesItem: SalesItem, variety: Variety) => {
      const cp = customerPricing.find(
        (p) => p.sales_item_id === salesItem.id
      );
      const price = cp
        ? parseFloat(cp.customer_price)
        : parseFloat(salesItem.retail_price);

      const newLine: OrderLineState = {
        id: crypto.randomUUID(),
        sales_item_id: salesItem.id,
        stems: 0,
        price_per_stem: price,
        varietyId: variety.id,
        salesItemName: salesItem.name,
        listPrice: price,
        expanded: false,
        color_variety: "",
        box_reference: null,
        item_fee_pct: 0,
        item_fee_dollar: 0,
        box_quantity: 0,
        bunches_per_box: 0,
        stems_per_bunch: 0,
        is_special: false,
        sleeve: "",
        upc: "",
        notes: "",
      };
      setLines((prev) => [...prev, newLine]);
    },
    [customerPricing]
  );

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
    },
    []
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
    },
    []
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

      try {
        const result = await api.post<OrderCreateResponse>(
          "/api/v1/orders",
          payload
        );
        setSuccessMessage(
          `Order ${result.order_number} created successfully`
        );
        setTimeout(() => {
          setSuccessMessage("");
          clearForm();
        }, 2000);
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
        <h1 className="text-xl font-extrabold text-[#1e3a5f]">New Order</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setProductPickerOpen(true)}
          >
            Browse Products
          </Button>
          <Button
            className="bg-rose-500 hover:bg-rose-600 text-white"
            onClick={() => submitOrder(false)}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Order"}
          </Button>
        </div>
      </div>

      {/* 2. Order context row */}
      <OrderContextRow
        customer={customer}
        onCustomerChange={handleCustomerChange}
        orderLabel={orderLabel}
        onOrderLabelChange={setOrderLabel}
        orderDate={orderDate}
        onOrderDateChange={setOrderDate}
        shipVia={shipVia}
        onShipViaChange={setShipVia}
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
          onLinesChange={setLines}
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
