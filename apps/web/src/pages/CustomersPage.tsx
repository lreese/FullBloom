import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { CustomerDrawer } from "@/components/customer/CustomerDrawer";
import { CustomerArchiveDialog } from "@/components/customer/CustomerArchiveDialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Settings2 } from "lucide-react";
import { useTableState } from "@/hooks/useTableState";
import type { ColumnDef } from "@/hooks/useTableState";
import { ColumnFilter } from "@/components/common/ColumnFilter";
import { cn } from "@/lib/utils";
import type {
  Customer,
  CustomerCreateRequest,
  CustomerUpdateRequest,
  DropdownOptions,
} from "@/types";

const ALL_COLUMNS: ColumnDef[] = [
  { key: "customer_number", label: "#", filterable: true, sortable: true, defaultVisible: true },
  { key: "name", label: "Name", filterable: true, sortable: true, defaultVisible: true },
  { key: "salesperson", label: "Sales", filterable: true, sortable: true, defaultVisible: true },
  { key: "contact_name", label: "Contact", filterable: true, sortable: true, defaultVisible: true },
  { key: "default_ship_via", label: "Ship Via", filterable: true, sortable: true, defaultVisible: true },
  { key: "phone", label: "Phone", filterable: false, sortable: true, defaultVisible: false },
  { key: "location", label: "Location", filterable: true, sortable: true, defaultVisible: true },
  { key: "payment_terms", label: "Terms", filterable: true, sortable: true, defaultVisible: true },
  { key: "email", label: "Email", filterable: false, sortable: true, defaultVisible: false },
  { key: "price_list_name", label: "Price List", filterable: true, sortable: true, defaultVisible: true },
  { key: "is_active", label: "Active", filterable: true, sortable: true, defaultVisible: false },
];

const SEARCHABLE_FIELDS = [
  "name",
  "contact_name",
  "location",
  "email",
  "phone",
  "salesperson",
];

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions>({
    salesperson: [],
    default_ship_via: [],
    payment_terms: [],
  });
  const [activeView, setActiveView] = useState<"active" | "archived">("active");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "add">("edit");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);

  // ── Table state (sorting, filtering, column prefs) ────────
  const tableState = useTableState<Customer>({
    data: customers,
    columns: ALL_COLUMNS,
    searchableFields: SEARCHABLE_FIELDS,
    storageKey: "fullbloom-customers-columns",
    defaultSort: { key: "name", direction: "asc" },
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

  // ── Data fetching ─────────────────────────────────────────
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

  // ── Handlers ──────────────────────────────────────────────
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

  const handleViewChange = (view: "active" | "archived") => {
    clearAllFilters();
    setActiveView(view);
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
  const renderCell = (col: ColumnDef, item: Customer) => {
    switch (col.key) {
      case "customer_number":
        return (
          <span className="text-text-muted font-mono text-xs">
            {item.customer_number}
          </span>
        );
      case "name":
        return (
          <span className="font-medium" style={{ color: "var(--color-text-body)" }}>
            {item.name}
          </span>
        );
      case "salesperson":
        return (
          <span style={{ color: "var(--color-slate-500)" }}>
            {item.salesperson ?? "\u2014"}
          </span>
        );
      case "contact_name":
        return (
          <span style={{ color: "var(--color-text-body)" }}>
            {item.contact_name ?? "\u2014"}
          </span>
        );
      case "default_ship_via":
        return (
          <span style={{ color: "var(--color-slate-500)" }}>
            {item.default_ship_via ?? "\u2014"}
          </span>
        );
      case "phone":
        return (
          <span style={{ color: "var(--color-slate-500)" }}>
            {item.phone ?? "\u2014"}
          </span>
        );
      case "location":
        return (
          <span style={{ color: "var(--color-slate-500)" }}>
            {item.location ?? "\u2014"}
          </span>
        );
      case "payment_terms":
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "var(--color-box-green-bg)", color: "var(--color-sidebar-hover)" }}
          >
            {item.payment_terms ?? "\u2014"}
          </span>
        );
      case "email":
        return (
          <span style={{ color: "var(--color-slate-500)" }}>
            {item.email ?? "\u2014"}
          </span>
        );
      case "price_list_name":
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "var(--color-box-blue-bg)", color: "var(--color-box-blue-text)" }}
          >
            {item.price_list_name ?? "Default"}
          </span>
        );
      case "is_active":
        return item.is_active ? (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "var(--color-box-green-bg)", color: "var(--color-sidebar-hover)" }}
          >
            Active
          </span>
        ) : (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: "var(--color-slate-100)", color: "var(--color-text-muted)" }}
          >
            Archived
          </span>
        );
      default: {
        const val = item[col.key as keyof Customer];
        if (val == null) return "\u2014";
        return String(val);
      }
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-cream)" }}>
      <div className="max-w-[1400px] mx-auto px-4 py-6 sm:px-6">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-slate-heading">Customers</h1>
            {hasActiveFilters && (
              <button
                className="text-xs text-text-muted hover:text-text-body border border-border-warm rounded px-2 py-1"
                onClick={clearAllFilters}
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
              onClick={handleAddClick}
              className="gap-1.5"
              style={{ backgroundColor: "var(--color-rose-action)", color: "white" }}
            >
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
          </div>
        </div>

        {/* ── Filters bar: view toggle + search ───────────── */}
        <div
          className="rounded-lg border p-3 mb-4 flex items-center gap-3 flex-wrap"
          style={{ backgroundColor: "white", borderColor: "var(--color-border-warm)" }}
        >
          <div className="flex gap-1">
            {(["active", "archived"] as const).map((view) => (
              <button
                key={view}
                onClick={() => handleViewChange(view)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize"
                style={
                  activeView === view
                    ? { backgroundColor: "var(--color-slate-heading)", color: "white" }
                    : { backgroundColor: "transparent", color: "var(--color-slate-500)" }
                }
              >
                {view}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[140px] max-w-[280px] relative">
            <input
              type="text"
              placeholder="Search customers..."
              value={tableState.searchTerm}
              onChange={(e) => tableState.setSearchTerm(e.target.value)}
              className="w-full h-9 rounded-lg border border-border-warm bg-white pl-3 pr-3 text-sm text-text-body placeholder:text-text-muted focus:ring-2 focus:ring-rose-action focus:outline-none"
            />
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────── */}
        <div className="rounded-lg border border-border-warm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border-warm bg-cream-warm">
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
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeColumns.length}
                      className="text-center py-12"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      No customers found.
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
                  filteredData.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-border-warm hover:bg-cream-warm transition-colors cursor-pointer"
                      onClick={() => handleRowClick(customer)}
                    >
                      {activeColumns.map((col) => (
                        <td key={col.key} className="px-3 py-2.5 text-text-body">
                          {renderCell(col, customer)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="px-3 py-2 text-xs text-text-muted bg-cream-warm border-t border-border-warm">
            {filteredData.length} {activeView} customer{filteredData.length !== 1 ? "s" : ""}
            {hasActiveFilters ? " (filtered)" : ""}
          </div>
        </div>
      </div>

      {/* ── Drawers & Dialogs ──────────────────────────── */}
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
    </div>
  );
}
