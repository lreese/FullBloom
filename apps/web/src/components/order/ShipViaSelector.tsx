import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { PlusIcon } from "lucide-react";

const DEFAULT_SHIP_VIA = "Pick Up - Tues";

const INITIAL_OPTIONS = [
  "Pick Up - Tues",
  "Pick Up - Fri",
  "FedEx",
  "UPS",
  "Local Delivery",
];

interface ShipViaSelectorProps {
  value: string;
  onChange: (value: string) => void;
  customerDefault?: string | null;
}

export function ShipViaSelector({ value, onChange, customerDefault }: ShipViaSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<string[]>(INITIAL_OPTIONS);
  const containerRef = useRef<HTMLDivElement>(null);

  // Apply customer default when it changes, fall back to DEFAULT_SHIP_VIA
  useEffect(() => {
    if (customerDefault) {
      setOptions((prev) =>
        prev.some((o) => o.toLowerCase() === customerDefault.toLowerCase())
          ? prev
          : [...prev, customerDefault]
      );
      onChange(customerDefault);
    } else if (!value) {
      onChange(DEFAULT_SHIP_VIA);
    }
  }, [customerDefault]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = search.trim()
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const canAddNew =
    search.trim() !== "" &&
    !options.some((o) => o.toLowerCase() === search.trim().toLowerCase());

  function handleAddNew() {
    const newOption = search.trim();
    setOptions((prev) => [...prev, newOption]);
    onChange(newOption);
    setSearch("");
    setOpen(false);
  }

  if (value && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm h-8 w-full text-left hover:bg-accent/50 transition-colors"
      >
        <span className="flex-1 truncate">{value}</span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <Command shouldFilter={false} className="rounded-lg border border-input">
        <CommandInput
          placeholder="Search or add..."
          value={search}
          onValueChange={(val) => {
            setSearch(val);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {open && (
          <CommandList>
            {filtered.length === 0 && !canAddNew && (
              <CommandEmpty>No options found.</CommandEmpty>
            )}
            {filtered.map((option) => (
              <CommandItem
                key={option}
                value={option}
                onSelect={() => {
                  onChange(option);
                  setSearch("");
                  setOpen(false);
                }}
                className={cn(option === value && "font-medium")}
              >
                {option}
              </CommandItem>
            ))}
            {canAddNew && (
              <CommandItem onSelect={handleAddNew}>
                <PlusIcon className="size-3.5 mr-1.5 text-rose-action" />
                <span>
                  Add "<span className="font-medium">{search.trim()}</span>"
                </span>
              </CommandItem>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
