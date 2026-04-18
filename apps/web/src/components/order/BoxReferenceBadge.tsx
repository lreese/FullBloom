import { cn } from "@/lib/utils";

const BADGE_COLORS = [
  { bg: "bg-box-blue-bg", text: "text-slate-heading" },
  { bg: "bg-box-pink-bg", text: "text-box-pink-text" },
  { bg: "bg-box-green-bg", text: "text-sidebar-hover" },
  { bg: "bg-box-amber-bg", text: "text-box-amber-text" },
  { bg: "bg-box-purple-bg", text: "text-box-purple-text" },
] as const;

interface BoxReferenceBadgeProps {
  references: string | null;
  colorMap: Record<string, number>;
}

export function BoxReferenceBadge({
  references,
  colorMap,
}: BoxReferenceBadgeProps) {
  if (!references || references.trim() === "") {
    return <span className="text-muted-foreground">&mdash;</span>;
  }

  const letters = references
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <span className="inline-flex items-center gap-1">
      {letters.map((letter) => {
        const idx = colorMap[letter] ?? 0;
        const color = BADGE_COLORS[idx % BADGE_COLORS.length];
        return (
          <span
            key={letter}
            className={cn(
              "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold leading-none",
              color.bg,
              color.text
            )}
          >
            {letter}
          </span>
        );
      })}
    </span>
  );
}

export { BADGE_COLORS };
