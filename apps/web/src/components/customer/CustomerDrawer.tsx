import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/services/api";
import type { Customer, CustomerCreateRequest, CustomerUpdateRequest, DropdownOptions, PriceList } from "@/types";

interface CustomerDrawerProps {
  open: boolean;
  onClose: () => void;
  mode: "edit" | "add";
  customer: Customer | null;
  dropdownOptions: DropdownOptions;
  nextNumber: number | null;
  onSave: (data: CustomerCreateRequest | CustomerUpdateRequest) => Promise<void>;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
}

export function CustomerDrawer({
  open,
  onClose,
  mode,
  customer,
  dropdownOptions,
  nextNumber,
  onSave,
  onArchive,
  onRestore,
}: CustomerDrawerProps) {
  const [form, setForm] = useState({
    customer_number: 0,
    name: "",
    salesperson: "",
    price_list_id: "" as string,
    contact_name: "",
    default_ship_via: "",
    phone: "",
    location: "",
    payment_terms: "",
    email: "",
    notes: "",
  });
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch price lists for the dropdown
  useEffect(() => {
    api.get<PriceList[]>("/api/v1/price-lists?active=true").then(setPriceLists);
  }, []);

  const isArchived = customer ? !customer.is_active : false;
  const isReadOnly = mode === "edit" && isArchived;

  useEffect(() => {
    if (mode === "edit" && customer) {
      setForm({
        customer_number: customer.customer_number,
        name: customer.name,
        salesperson: customer.salesperson ?? "",
        price_list_id: customer.price_list_id ?? "",
        contact_name: customer.contact_name ?? "",
        default_ship_via: customer.default_ship_via ?? "",
        phone: customer.phone ?? "",
        location: customer.location ?? "",
        payment_terms: customer.payment_terms ?? "",
        email: customer.email ?? "",
        notes: customer.notes ?? "",
      });
    } else if (mode === "add") {
      setForm({
        customer_number: nextNumber ?? 0,
        name: "",
        salesperson: "",
        price_list_id: "",
        contact_name: "",
        default_ship_via: "",
        phone: "",
        location: "",
        payment_terms: "",
        email: "",
        notes: "",
      });
    }
    setError(null);
  }, [mode, customer, nextNumber, open]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Name cannot be empty");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (mode === "add") {
        const data: CustomerCreateRequest = {
          customer_number: form.customer_number,
          name: form.name.trim(),
          salesperson: form.salesperson || null,
          price_list_id: form.price_list_id || null,
          contact_name: form.contact_name || null,
          default_ship_via: form.default_ship_via || null,
          phone: form.phone || null,
          location: form.location || null,
          payment_terms: form.payment_terms || null,
          email: form.email || null,
          notes: form.notes || null,
        };
        await onSave(data);
      } else {
        const data: CustomerUpdateRequest = {
          name: form.name.trim(),
          salesperson: form.salesperson || null,
          price_list_id: form.price_list_id || null,
          contact_name: form.contact_name || null,
          default_ship_via: form.default_ship_via || null,
          phone: form.phone || null,
          location: form.location || null,
          payment_terms: form.payment_terms || null,
          email: form.email || null,
          notes: form.notes || null,
        };
        await onSave(data);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const renderSelect = (
    field: string,
    label: string,
    options: string[],
    value: string
  ) => (
    <div>
      <Label className="text-xs font-semibold text-slate-heading">{label}</Label>
      <Select
        value={value || "__none__"}
        onValueChange={(v) => setField(field, v === "__none__" ? "" : v)}
        disabled={isReadOnly}
      >
        <SelectTrigger className="mt-1 h-8 text-sm">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[520px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border-warm">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-slate-heading">
                {mode === "add" ? "New Customer" : "Edit Customer"}
              </SheetTitle>
              {mode === "edit" && customer && (
                <SheetDescription className="text-xs mt-0.5">
                  #{customer.customer_number} &middot; {customer.name}
                </SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Identity */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
              Identity
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-heading">
                  Customer Number
                </Label>
                {mode === "edit" ? (
                  <div className="mt-1 px-3 py-1.5 bg-cream border border-border-warm rounded-md text-sm text-text-muted">
                    {form.customer_number}
                  </div>
                ) : (
                  <Input
                    type="number"
                    className="mt-1 h-8 text-sm"
                    value={form.customer_number}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, customer_number: parseInt(e.target.value, 10) || 0 }))
                    }
                  />
                )}
              </div>
              {renderSelect(
                "salesperson",
                "Salesperson (Initials)",
                dropdownOptions.salesperson,
                form.salesperson
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <Label className="text-xs font-semibold text-slate-heading">Price List</Label>
                <Select
                  value={form.price_list_id || "__none__"}
                  onValueChange={(v) => setField("price_list_id", v === "__none__" ? "" : v)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue placeholder="Select price list" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (Retail)</SelectItem>
                    {priceLists.map((pl) => (
                      <SelectItem key={pl.id} value={pl.id}>
                        {pl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3">
              <Label className="text-xs font-semibold text-slate-heading">
                Name *
              </Label>
              <Input
                className="mt-1 h-8 text-sm"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                disabled={isReadOnly}
              />
              {error && error.toLowerCase().includes("name") && (
                <p className="text-xs text-red-500 mt-1">{error}</p>
              )}
            </div>
          </div>

          {/* Contact */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
              Contact
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-heading">
                  Contact Name
                </Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={form.contact_name}
                  onChange={(e) => setField("contact_name", e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-heading">
                  Phone
                </Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>
            <div className="mt-3">
              <Label className="text-xs font-semibold text-slate-heading">
                Email
              </Label>
              <Input
                className="mt-1 h-8 text-sm"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          {/* Shipping & Billing */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
              Shipping &amp; Billing
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {renderSelect(
                "default_ship_via",
                "Ship Via",
                dropdownOptions.default_ship_via,
                form.default_ship_via
              )}
              {renderSelect(
                "payment_terms",
                "Terms",
                dropdownOptions.payment_terms,
                form.payment_terms
              )}
            </div>
            <div className="mt-3">
              <Label className="text-xs font-semibold text-slate-heading">
                Location
              </Label>
              <Input
                className="mt-1 h-8 text-sm"
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
              Notes
            </div>
            <Textarea
              className="text-sm resize-y min-h-[60px]"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              disabled={isReadOnly}
            />
          </div>

          {/* General error */}
          {error && !error.toLowerCase().includes("name") && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        {!isReadOnly && (
          <div className="flex gap-2 px-5 py-3 border-t border-border-warm bg-cream-warm">
            {mode === "edit" && customer && !isArchived && (
              <Button
                variant="outline"
                size="sm"
                className="text-rose-action border-box-pink-bg hover:bg-box-pink-bg text-xs mr-auto"
                onClick={() => onArchive(customer.id)}
              >
                Archive
              </Button>
            )}
            {mode === "edit" && customer && isArchived && (
              <Button
                variant="outline"
                size="sm"
                className="text-sidebar-hover border-box-green-bg hover:bg-box-green-bg text-xs mr-auto"
                onClick={() => onRestore(customer.id)}
              >
                Restore
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-rose-action hover:bg-rose-action/90 text-white text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : mode === "add"
                  ? "Create Customer"
                  : "Save Changes"}
            </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
