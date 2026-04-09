import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import type { Customer } from "@/types";

interface CustomerSelectorProps {
  value: Customer | null;
  onSelect: (customer: Customer) => void;
}

export function CustomerSelector({ value, onSelect }: CustomerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchCustomers = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const params = term ? `?search=${encodeURIComponent(term)}` : "";
      const res = await api.get<Customer[]>(
        `/api/v1/customers${params}`
      );
      setCustomers(res);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCustomers(search), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, open, fetchCustomers]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (value && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm h-8 w-full text-left hover:bg-accent/50 transition-colors"
      >
        <span className="flex-1 truncate">{value.name}</span>
        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
          ID: {value.customer_id}
        </span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <Command shouldFilter={false} className="rounded-lg border border-input overflow-visible p-0">
        <CommandInput
          placeholder="Search customers..."
          className="h-8"
          value={search}
          onValueChange={(val) => {
            setSearch(val);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {open && (
          <CommandList className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-input bg-white shadow-lg max-h-64">
            {loading && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}
            {!loading && customers.length === 0 && (
              <CommandEmpty>No customers found.</CommandEmpty>
            )}
            {!loading &&
              customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={String(customer.id)}
                  onSelect={() => {
                    onSelect(customer);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <span className="flex-1 truncate">{customer.name}</span>
                  <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                    ID: {customer.customer_id}
                  </span>
                </CommandItem>
              ))}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
