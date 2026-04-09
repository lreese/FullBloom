import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomerColumnFilterProps {
  values: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function CustomerColumnFilter({
  values,
  selected,
  onChange,
}: CustomerColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const isActive = selected.length > 0 && selected.length < values.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "ml-1 inline-flex items-center text-[10px]",
            isActive ? "text-[#c27890]" : "text-[#94a3b8] hover:text-[#334155]"
          )}
          aria-label="Filter column"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex items-center justify-between mb-2 px-1">
          <button
            className="text-xs text-[#c27890] hover:underline"
            onClick={() => onChange([...values])}
          >
            Select All
          </button>
          <button
            className="text-xs text-[#94a3b8] hover:underline"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {values.map((value) => (
            <label
              key={value}
              className="flex items-center gap-2 px-1 py-0.5 text-sm rounded hover:bg-[#f4f1ec] cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selected, value]);
                  } else {
                    onChange(selected.filter((v) => v !== value));
                  }
                }}
              />
              <span className="truncate text-[#334155]">{value || "\u2014"}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-[#e0ddd8]">
          <Button
            size="sm"
            className="w-full bg-[#c27890] hover:bg-[#a8607a] text-white text-xs"
            onClick={() => setOpen(false)}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
