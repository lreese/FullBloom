import { cn } from "@/lib/utils";
import { BADGE_COLORS } from "@/components/order/BoxReferenceBadge";

interface BoxGroupingsLegendProps {
  lines: { salesItemName: string; box_reference: string | null }[];
}

export function BoxGroupingsLegend({ lines }: BoxGroupingsLegendProps) {
  // Build map: letter -> list of product names
  const letterMap = new Map<string, Set<string>>();

  for (const line of lines) {
    if (!line.box_reference || line.box_reference.trim() === "") continue;
    const letters = line.box_reference
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const letter of letters) {
      if (!letterMap.has(letter)) {
        letterMap.set(letter, new Set());
      }
      letterMap.get(letter)!.add(line.salesItemName);
    }
  }

  if (letterMap.size === 0) return null;

  // Build consistent color map
  const sortedLetters = Array.from(letterMap.keys()).sort();
  const colorMap: Record<string, number> = {};
  sortedLetters.forEach((letter, i) => {
    colorMap[letter] = i;
  });

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-2 px-1">
      <span className="font-medium">Box groupings:</span>
      {sortedLetters.map((letter) => {
        const idx = colorMap[letter];
        const color = BADGE_COLORS[idx % BADGE_COLORS.length];
        const products = Array.from(letterMap.get(letter)!);
        return (
          <span key={letter} className="inline-flex items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold leading-none",
                color.bg,
                color.text
              )}
            >
              {letter}
            </span>
            <span>{products.join(" + ")}</span>
          </span>
        );
      })}
    </div>
  );
}
