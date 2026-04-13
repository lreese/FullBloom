import type { AccessLevel, Role } from "@/types/user";

export const PERMISSIONS: Record<Role, Record<string, AccessLevel>> = {
  admin: {
    users: "rw", orders: "rw", standing_orders: "rw", customers: "rw",
    inventory_counts: "rw", inventory_estimates: "rw", inventory_harvest: "rw",
    inventory_availability: "rw", products: "rw", pricing: "rw", import: "rw",
  },
  salesperson: {
    orders: "rw", standing_orders: "rw", customers: "rw",
    inventory_counts: "r", inventory_estimates: "r", inventory_harvest: "rw",
    inventory_availability: "r", products: "r", pricing: "rw",
  },
  data_manager: {
    orders: "r", standing_orders: "r", customers: "rw",
    inventory_counts: "r", inventory_estimates: "r", inventory_harvest: "rw",
    inventory_availability: "r", products: "rw", pricing: "rw", import: "rw",
  },
  field_worker: {
    orders: "r", standing_orders: "r", customers: "r",
    inventory_counts: "rw", inventory_estimates: "rw", inventory_harvest: "rw",
    inventory_availability: "r", products: "r",
  },
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin", salesperson: "Salesperson",
  data_manager: "Data Manager", field_worker: "Field Worker",
};

export const AREA_LABELS: Record<string, string> = {
  users: "User Management", orders: "Orders & Standing Orders",
  customers: "Customers", inventory_counts: "Inventory (Counts, Estimates)",
  inventory_harvest: "Inventory (Harvest Status)",
  inventory_availability: "Inventory (Availability, Comparison)",
  products: "Products", pricing: "Pricing", import: "Import",
};

export function canAccess(role: Role, area: string, action: "read" | "write"): boolean {
  const access = PERMISSIONS[role]?.[area];
  if (!access) return false;
  if (action === "read") return access === "r" || access === "rw";
  if (action === "write") return access === "rw";
  return false;
}
