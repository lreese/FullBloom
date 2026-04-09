import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { CustomerTable } from "@/components/customer/CustomerTable";
import { CustomerDrawer } from "@/components/customer/CustomerDrawer";
import { CustomerArchiveDialog } from "@/components/customer/CustomerArchiveDialog";
import type {
  Customer,
  CustomerCreateRequest,
  CustomerUpdateRequest,
  DropdownOptions,
} from "@/types";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions>({
    salesperson: [],
    default_ship_via: [],
    payment_terms: [],
    price_type: [],
  });
  const [activeView, setActiveView] = useState<"active" | "archived">("active");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "add">("edit");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(async () => {
    const data = await api.get<Customer[]>(
      `/api/v1/customers?active=${activeView === "active"}`
    );
    setCustomers(data);
  }, [activeView]);

  const fetchDropdownOptions = useCallback(async () => {
    const data = await api.get<DropdownOptions>(
      "/api/v1/customers/dropdown-options"
    );
    setDropdownOptions(data);
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchDropdownOptions();
  }, [fetchDropdownOptions]);

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const handleAddClick = async () => {
    const data = await api.get<{ next_number: number }>(
      "/api/v1/customers/next-number"
    );
    setNextNumber(data.next_number);
    setSelectedCustomer(null);
    setDrawerMode("add");
    setDrawerOpen(true);
  };

  const handleSave = async (
    data: CustomerCreateRequest | CustomerUpdateRequest
  ) => {
    if (drawerMode === "add") {
      await api.post("/api/v1/customers", data);
    } else if (selectedCustomer) {
      await api.patch(
        `/api/v1/customers/${selectedCustomer.id}`,
        data
      );
    }
    await fetchCustomers();
    await fetchDropdownOptions();
  };

  const handleArchiveRequest = (id: string) => {
    const customer = customers.find((c) => c.id === id);
    if (customer) setArchiveTarget(customer);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    await api.post(`/api/v1/customers/${archiveTarget.id}/archive`, {});
    setArchiveTarget(null);
    setDrawerOpen(false);
    await fetchCustomers();
  };

  const handleRestore = async (id: string) => {
    await api.post(`/api/v1/customers/${id}/restore`, {});
    setDrawerOpen(false);
    await fetchCustomers();
  };

  return (
    <>
      <CustomerTable
        customers={customers}
        activeView={activeView}
        onViewChange={setActiveView}
        onRowClick={handleRowClick}
        onAddClick={handleAddClick}
      />

      <CustomerDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        customer={selectedCustomer}
        dropdownOptions={dropdownOptions}
        nextNumber={nextNumber}
        onSave={handleSave}
        onArchive={handleArchiveRequest}
        onRestore={handleRestore}
      />

      <CustomerArchiveDialog
        open={archiveTarget !== null}
        customerName={archiveTarget?.name ?? ""}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}
