import { PERMISSIONS, ROLE_LABELS, AREA_LABELS } from "@/lib/permissions";
import type { Role } from "@/types/user";
import { Check, Eye, X } from "lucide-react";

export function PermissionsMatrix() {
  const roles = Object.keys(ROLE_LABELS) as Role[];
  const areas = Object.keys(AREA_LABELS);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-warm">
            <th className="text-left py-3 px-4 font-semibold text-slate-heading">
              Area
            </th>
            {roles.map((r) => (
              <th key={r} className="text-center py-3 px-4 font-semibold text-slate-heading">
                {ROLE_LABELS[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => (
            <tr key={area} className="border-b border-border-warm hover:bg-cream/50 transition-colors">
              <td className="py-3 px-4 font-medium text-text-body">
                {AREA_LABELS[area]}
              </td>
              {roles.map((r) => {
                const access = PERMISSIONS[r]?.[area];
                return (
                  <td key={r} className="text-center py-3 px-4">
                    <div className="flex justify-center">
                      {access === "rw" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-box-green-bg text-box-green-text border border-green-200/50">
                          <Check className="w-3 h-3 stroke-[3]" /> Edit
                        </span>
                      )}
                      {access === "r" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-box-blue-bg text-box-blue-text border border-blue-200/50">
                          <Eye className="w-3 h-3 stroke-[3]" /> View
                        </span>
                      )}
                      {!access && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-text-muted opacity-60">
                          <X className="w-3 h-3" /> None
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
