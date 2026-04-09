import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/services/api";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { PlusIcon } from "lucide-react";

interface ColorVarietyComboboxProps {
  varietyId: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorVarietyCombobox({
  varietyId,
  value,
  onChange,
}: ColorVarietyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchColors = useCallback(async () => {
    if (!varietyId) return;
    setLoading(true);
    try {
      const res = await api.get<string[]>(
        `/api/v1/varieties/${varietyId}/colors`
      );
      setColors(res);
    } catch {
      setColors([]);
    } finally {
      setLoading(false);
    }
  }, [varietyId]);

  useEffect(() => {
    if (open) fetchColors();
  }, [open, fetchColors]);

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

  const filtered = colors.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  const showAddNew =
    search.trim() !== "" &&
    !colors.some((c) => c.toLowerCase() === search.toLowerCase());

  async function handleAddNew() {
    if (!search.trim()) return;
    try {
      await api.post(`/api/v1/varieties/${varietyId}/colors`, {
        color: search.trim(),
      });
      onChange(search.trim());
      setSearch("");
      setOpen(false);
    } catch {
      // silently fail — user can retry
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm h-8 w-full text-left hover:bg-accent/50 transition-colors"
        >
          <span className={value ? "" : "text-muted-foreground"}>
            {value || "Select color..."}
          </span>
        </button>
      ) : (
        <Command shouldFilter={false} className="rounded-lg border border-input">
          <CommandInput
            placeholder="Search or type color..."
            value={search}
            onValueChange={setSearch}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length === 0 && search.trim()) {
                // Freeform text entry
                onChange(search.trim());
                setSearch("");
                setOpen(false);
              }
            }}
            autoFocus
          />
          <CommandList>
            {loading && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            )}
            {!loading && filtered.length === 0 && !showAddNew && (
              <CommandEmpty>No colors found.</CommandEmpty>
            )}
            {!loading &&
              filtered.map((color) => (
                <CommandItem
                  key={color}
                  value={color}
                  data-checked={color === value || undefined}
                  onSelect={() => {
                    onChange(color);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  {color}
                </CommandItem>
              ))}
            {!loading && showAddNew && (
              <CommandItem
                value={`__add_${search}`}
                onSelect={handleAddNew}
                className="text-muted-foreground"
              >
                <PlusIcon className="size-4" />
                <span>
                  Add &ldquo;{search.trim()}&rdquo;
                </span>
              </CommandItem>
            )}
          </CommandList>
        </Command>
      )}
    </div>
  );
}
