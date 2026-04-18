import { Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonConfig {
  label: string;
  enabled: boolean;
  disabledReason?: string;
  onCopy: () => Promise<void>;
}

interface CopyButtonsProps {
  buttons: CopyButtonConfig[];
}

export function CopyButtons({ buttons }: CopyButtonsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {buttons.map((btn) => (
        <CopyButton key={btn.label} config={btn} />
      ))}
    </div>
  );
}

function CopyButton({ config }: { config: CopyButtonConfig }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await config.onCopy();
    } catch (err) {
      console.error("Copy failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!config.enabled || loading}
      onClick={handleClick}
      title={!config.enabled ? config.disabledReason : config.label}
      className={cn(
        "border-border-warm text-text-body min-h-[36px] text-xs gap-1.5",
        !config.enabled && "text-text-muted cursor-not-allowed"
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {config.label}
    </Button>
  );
}
