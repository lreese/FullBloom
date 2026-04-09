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
import type { Customer, CustomerCreateRequest, CustomerUpdateRequest, DropdownOptions } from "@/types";

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
    price_type: "Retail",
    contact_name: "",
    default_ship_via: "",
    phone: "",
    location: "",
    payment_terms: "",
    email: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isArchived = customer ? !customer.is_active : false;
  const isReadOnly = mode === "edit" && isArchived;

  useEffect(() => {
    if (mode === "edit" && customer) {
      setForm({
        customer_number: customer.customer_number,
        name: customer.name,
        salesperson: customer.salesperson ?? "",
        price_type: customer.price_type ?? "Retail",
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
        price_type: "Retail",
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
          price_type: form.price_type || "Retail",
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
          price_type: form.price_type || "Retail",
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
      <Label className="text-xs font-semibold text-[#1e3a5f]">{label}</Label>
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
        <SheetHeader className="px-5 py-4 border-b border-[#e0ddd8]">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-[#1e3a5f]">
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
              Identity
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-[#1e3a5f]">
                  Customer Number
                </Label>
                {mode === "edit" ? (
                  <div className="mt-1 px-3 py-1.5 bg-[#f4f1ec] border border-[#e0ddd8] rounded-md text-sm text-[#94a3b8]">
                    {form.customer_number}
                  </div>
                ) : (
                  <Input
                    type="number"
                    className="mt-1 h-8 text-sm"
                    value={form.customer_number}
                    onChange={(e) =>
                      setField("customer_number", e.target.value)
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
              {renderSelect(
                "price_type",
                "Price Type",
                dropdownOptions.price_type,
                form.price_type
              )}
            </div>
            <div className="mt-3">
              <Label className="text-xs font-semibold text-[#1e3a5f]">
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
              Contact
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-[#1e3a5f]">
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
                <Label className="text-xs font-semibold text-[#1e3a5f]">
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
              <Label className="text-xs font-semibold text-[#1e3a5f]">
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
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
              <Label className="text-xs font-semibold text-[#1e3a5f]">
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
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
          <div className="flex gap-2 px-5 py-3 border-t border-[#e0ddd8] bg-[#faf8f5]">
            {mode === "edit" && customer && !isArchived && (
              <Button
                variant="outline"
                size="sm"
                className="text-[#c27890] border-[#fce7f3] hover:bg-[#fce7f3] text-xs mr-auto"
                onClick={() => onArchive(customer.id)}
              >
                Archive
              </Button>
            )}
            {mode === "edit" && customer && isArchived && (
              <Button
                variant="outline"
                size="sm"
                className="text-[#2d4a2d] border-[#e8f0e8] hover:bg-[#e8f0e8] text-xs mr-auto"
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
              className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs"
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
