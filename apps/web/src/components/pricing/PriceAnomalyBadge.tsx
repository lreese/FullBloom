import { cn } from "@/lib/utils";

interface PriceAnomalyBadgeProps {
  listPrice: string;
  overridePrice: string;
  className?: string;
}

export function PriceAnomalyBadge({
  listPrice,
  overridePrice,
  className,
}: PriceAnomalyBadgeProps) {
  const list = Number(listPrice);
  const override = Number(overridePrice);
  if (!list || !override || list === 0) return null;

  const pctDiff = ((override - list) / list) * 100;
  const ANOMALY_THRESHOLD = 20;

  if (Math.abs(pctDiff) <= ANOMALY_THRESHOLD) return null;

  const sign = pctDiff > 0 ? "+" : "";
  const label = `${sign}${pctDiff.toFixed(0)}%`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded border",
        "border-rose-action text-rose-action bg-white",
        className
      )}
      title={`${label} from list price ($${list.toFixed(2)})`}
    >
      &#9888; {label}
    </span>
  );
}
