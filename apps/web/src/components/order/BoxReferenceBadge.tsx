import { cn } from "@/lib/utils";

const BADGE_COLORS = [
  { bg: "bg-[#dbeafe]", text: "text-[#1e3a5f]" },
  { bg: "bg-[#fce7f3]", text: "text-[#831843]" },
  { bg: "bg-[#e8f0e8]", text: "text-[#2d4a2d]" },
  { bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
  { bg: "bg-[#ede9fe]", text: "text-[#5b21b6]" },
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
