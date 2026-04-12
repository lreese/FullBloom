import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// API uses 0=Mon, 6=Sun
const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6];

const FREQUENCY_OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 4, label: "4" },
];

interface CadencePickerProps {
  frequencyWeeks: number;
  daysOfWeek: number[];
  referenceDate: string;
  onFrequencyChange: (weeks: number) => void;
  onDaysChange: (days: number[]) => void;
  onReferenceDateChange: (date: string) => void;
}

function buildCadenceSummary(
  frequencyWeeks: number,
  daysOfWeek: number[],
  referenceDate: string
): string {
  if (daysOfWeek.length === 0) return "";

  const freq =
    frequencyWeeks === 1
      ? "Every week"
      : `Every ${frequencyWeeks} weeks`;

  const dayNames = daysOfWeek
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d]);

  const datePart = referenceDate
    ? new Date(referenceDate + "T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return `${freq} on ${dayNames.join(", ")}${datePart ? ` · starting ${datePart}` : ""}`;
}

export function CadencePicker({
  frequencyWeeks,
  daysOfWeek,
  referenceDate,
  onFrequencyChange,
  onDaysChange,
  onReferenceDateChange,
}: CadencePickerProps) {
  const toggleDay = (day: number) => {
    if (daysOfWeek.includes(day)) {
      onDaysChange(daysOfWeek.filter((d) => d !== day));
    } else {
      onDaysChange([...daysOfWeek, day].sort((a, b) => a - b));
    }
  };

  const summary = buildCadenceSummary(frequencyWeeks, daysOfWeek, referenceDate);

  return (
    <div className="space-y-3">
      {/* Frequency + days + date row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Frequency */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-[#334155]">Every</span>
          <select
            value={frequencyWeeks}
            onChange={(e) => onFrequencyChange(Number(e.target.value))}
            className="flex h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-sm text-[#334155]">
            week{frequencyWeeks > 1 ? "s" : ""} on
          </span>
        </div>

        {/* Day chips */}
        <div className="flex items-center gap-1">
          {DAY_INDICES.map((dayIdx) => {
            const selected = daysOfWeek.includes(dayIdx);
            return (
              <button
                key={dayIdx}
                type="button"
                onClick={() => toggleDay(dayIdx)}
                className={cn(
                  "w-[40px] h-[36px] rounded-md text-xs font-medium transition-colors border",
                  selected
                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                    : "bg-white text-[#94a3b8] border-[#e0ddd8] hover:border-[#94a3b8]"
                )}
              >
                {DAY_LABELS[dayIdx]}
              </button>
            );
          })}
        </div>

        {/* Reference date */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-[#334155]">starting from</span>
          <Input
            type="date"
            value={referenceDate}
            onChange={(e) => onReferenceDateChange(e.target.value)}
            className="w-[160px]"
          />
        </div>
      </div>

      {/* Live summary */}
      {summary && (
        <p className="text-sm text-[#64748b]">
          <span className="mr-1">&rarr;</span>
          {summary}
        </p>
      )}
    </div>
  );
}
