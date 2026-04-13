import { useContext } from "react";
import { AuthContext } from "@/auth/AuthProvider";
import { canAccess } from "@/lib/permissions";
import type { Role } from "@/types/user";

export function useAuth() {
  const context = useContext(AuthContext);
  return {
    ...context,
    role: context.user?.role ?? null,
    canAccess: (area: string, action: "read" | "write") => {
      if (!context.user) return false;
      return canAccess(context.user.role as Role, area, action);
    },
  };
}
