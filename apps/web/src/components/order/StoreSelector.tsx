import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Store } from "@/types";

interface StoreSelectorProps {
  stores: Store[];
  value: string;
  onChange: (storeName: string) => void;
}

export function StoreSelector({ stores, value, onChange }: StoreSelectorProps) {
  const disabled = stores.length === 0;

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select store..." />
      </SelectTrigger>
      <SelectContent>
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.name}>
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
