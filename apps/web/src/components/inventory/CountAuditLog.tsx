import { useState } from "react";
import { Info, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { api } from "@/services/api";
import type { CountAuditEntry } from "@/types/inventory";
import { cn } from "@/lib/utils";

interface CountAuditLogProps {
  varietyId: string;
  countDate: string;
  fetchUrl?: string;
}

const actionConfig = {
  set: { label: "Set", color: "text-text-body", bg: "bg-cream" },
  add: { label: "Added", color: "text-sidebar-hover", bg: "bg-sidebar-hover/10" },
  remove: { label: "Removed", color: "text-rose-action", bg: "bg-rose-action/10" },
} as const;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CountAuditLog({ varietyId, countDate, fetchUrl }: CountAuditLogProps) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<CountAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const url = fetchUrl ?? `/api/v1/counts/${varietyId}/audit-log?count_date=${countDate}`;
      const data = await api.get<CountAuditEntry[]>(url);
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded) {
      // Always refetch on expand so data is fresh after saves
      await fetchEntries();
    }
    setExpanded(!expanded);
  };

  return (
    <div className="inline-flex items-center">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1 text-text-muted hover:text-text-body transition-colors p-1 min-h-[44px] min-w-[44px] justify-center"
        aria-label={expanded ? "Hide audit log" : "Show audit log"}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Info className="h-4 w-4" />
        )}
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {expanded && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-border-warm bg-white shadow-md p-2 space-y-1">
          <p className="text-xs font-medium text-text-muted px-1 mb-1">
            Recent activity
          </p>
          {entries.length === 0 ? (
            <p className="text-xs text-text-muted px-1">No activity yet</p>
          ) : (
            entries.slice(0, 10).map((entry) => {
              const config = actionConfig[entry.action];
              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded px-2 py-1 text-xs",
                    config.bg
                  )}
                >
                  <span className="text-text-muted shrink-0">
                    {formatTime(entry.created_at)}
                  </span>
                  <span className={cn("font-medium", config.color)}>
                    {config.label} {entry.amount}
                  </span>
                  <span className="text-text-body">
                    &rarr; {entry.resulting_total}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
