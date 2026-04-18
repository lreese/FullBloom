import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Settings, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PullDayScheduleResponse } from "@/types/inventory";

interface PullDayConfigPopoverProps {
  weekStart: string;
  onSave: () => void;
}

const DAY_LABELS = [
  { num: 1, label: "Mon" },
  { num: 2, label: "Tue" },
  { num: 3, label: "Wed" },
  { num: 4, label: "Thu" },
  { num: 5, label: "Fri" },
  { num: 6, label: "Sat" },
];

export function PullDayConfigPopover({
  weekStart,
  onSave,
}: PullDayConfigPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);
  const [isDefault, setIsDefault] = useState(true);
  const [mode, setMode] = useState<"this_week" | "update_default">("this_week");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<PullDayScheduleResponse>(
        `/api/v1/pull-day-schedules?week_start=${weekStart}`
      );
      setSelectedDays(data.pull_days);
      setIsDefault(data.is_default);
    } catch (err) {
      console.error("Failed to fetch pull day schedule:", err);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    if (open) {
      fetchSchedule();
      setMode("this_week");
    }
  }, [open, fetchSchedule]);

  const toggleDay = (dayNum: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayNum)
        ? prev.filter((d) => d !== dayNum)
        : [...prev, dayNum].sort()
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/api/v1/pull-day-schedules", {
        week_start: mode === "update_default" ? null : weekStart,
        pull_days: selectedDays,
      });
      onSave();
      setOpen(false);
    } catch (err) {
      console.error("Failed to save pull day schedule:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="text-text-muted border-border-warm min-w-[44px] min-h-[44px]"
            title="Configure pull days"
          />
        }
      >
        <Settings className="h-4 w-4" />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-heading">
              Pull Day Schedule
            </h4>
            <p className="text-xs text-text-muted mt-0.5">
              {isDefault ? "Using default schedule" : "Custom schedule for this week"}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4 text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : (
            <>
              {/* Day checkboxes */}
              <div className="grid grid-cols-3 gap-2">
                {DAY_LABELS.map(({ num, label }) => (
                  <label
                    key={num}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors",
                      selectedDays.includes(num)
                        ? "border-rose-action bg-rose-action/5"
                        : "border-border-warm hover:bg-cream"
                    )}
                  >
                    <Checkbox
                      checked={selectedDays.includes(num)}
                      onCheckedChange={() => toggleDay(num)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-text-body">{label}</span>
                  </label>
                ))}
              </div>

              {/* Mode toggle */}
              <div className="flex rounded-lg border border-border-warm bg-white p-0.5">
                <button
                  onClick={() => setMode("this_week")}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    mode === "this_week"
                      ? "bg-rose-action text-white"
                      : "text-text-body hover:bg-cream"
                  )}
                >
                  This week only
                </button>
                <button
                  onClick={() => setMode("update_default")}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    mode === "update_default"
                      ? "bg-rose-action text-white"
                      : "text-text-body hover:bg-cream"
                  )}
                >
                  Update default
                </button>
              </div>

              {/* Save button */}
              <Button
                onClick={handleSave}
                disabled={saving || selectedDays.length === 0}
                className="w-full bg-rose-action hover:bg-rose-action/90 text-white disabled:bg-border-warm disabled:text-text-muted"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
