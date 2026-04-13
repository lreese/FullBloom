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
          <tr style={{ borderBottom: "1px solid #e0ddd8" }}>
            <th className="text-left py-2 px-3 font-medium" style={{ color: "#1e3a5f" }}>
              Area
            </th>
            {roles.map((r) => (
              <th key={r} className="text-center py-2 px-3 font-medium" style={{ color: "#1e3a5f" }}>
                {ROLE_LABELS[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => (
            <tr key={area} style={{ borderBottom: "1px solid #e0ddd8" }}>
              <td className="py-2 px-3" style={{ color: "#334155" }}>
                {AREA_LABELS[area]}
              </td>
              {roles.map((r) => {
                const access = PERMISSIONS[r]?.[area];
                return (
                  <td key={r} className="text-center py-2 px-3">
                    {access === "rw" && (
                      <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs">
                        <Check className="w-3 h-3" /> Full
                      </span>
                    )}
                    {access === "r" && (
                      <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
                        <Eye className="w-3 h-3" /> View
                      </span>
                    )}
                    {!access && (
                      <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                        <X className="w-3 h-3" /> None
                      </span>
                    )}
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
