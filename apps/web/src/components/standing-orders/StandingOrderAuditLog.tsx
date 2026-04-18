import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";
import type { StandingOrderAuditLogEntry } from "@/types/standing-order";

interface StandingOrderAuditLogProps {
  standingOrderId: string;
}

const actionConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  created: { label: "Created", color: "text-sidebar-hover", bg: "bg-sidebar-hover/10" },
  updated: { label: "Updated", color: "text-box-blue-text", bg: "bg-box-blue-text/10" },
  paused: { label: "Paused", color: "text-box-amber-text", bg: "bg-box-amber-text/10" },
  resumed: { label: "Resumed", color: "text-sidebar-hover", bg: "bg-sidebar-hover/10" },
  cancelled: {
    label: "Cancelled",
    color: "text-rose-action",
    bg: "bg-rose-action/10",
  },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatChange(change: {
  field: string;
  old_value: unknown;
  new_value: unknown;
}): string {
  const field = change.field.replace(/_/g, " ");
  if (change.old_value == null && change.new_value != null) {
    return `set ${field} to "${change.new_value}"`;
  }
  if (change.old_value != null && change.new_value == null) {
    return `cleared ${field}`;
  }
  return `${field}: "${change.old_value}" -> "${change.new_value}"`;
}

export function StandingOrderAuditLog({
  standingOrderId,
}: StandingOrderAuditLogProps) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<StandingOrderAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const data = await api.get<StandingOrderAuditLogEntry[]>(
        `/api/v1/standing-orders/${standingOrderId}/audit-log`
      );
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!expanded) {
      await fetchEntries();
    }
    setExpanded(!expanded);
  };

  return (
    <div className="rounded-lg border border-border-warm bg-white">
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-heading hover:bg-accent/50 transition-colors rounded-lg"
      >
        <span>
          Audit Log{entries.length > 0 ? ` (${entries.length})` : ""}
        </span>
        <span className="flex items-center gap-1">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border-warm px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-xs text-text-muted">No activity recorded</p>
          ) : (
            entries.map((entry) => {
              const config = actionConfig[entry.action] ?? {
                label: entry.action,
                color: "text-text-body",
                bg: "bg-cream",
              };
              return (
                <div
                  key={entry.id}
                  className={cn("rounded px-3 py-2 text-xs", config.bg)}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className={cn("font-medium", config.color)}>
                      {config.label}
                    </span>
                    <span className="text-text-muted shrink-0">
                      {formatTime(entry.created_at)}
                    </span>
                  </div>
                  {entry.entered_by && (
                    <p className="text-slate-500 mb-1">
                      by {entry.entered_by}
                    </p>
                  )}
                  {entry.reason && (
                    <p className="text-text-body italic mb-1">
                      {entry.reason}
                    </p>
                  )}
                  {entry.changes && entry.changes.length > 0 && (
                    <ul className="text-text-body space-y-0.5">
                      {entry.changes.map((change, i) => (
                        <li key={i}>{formatChange(change)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
