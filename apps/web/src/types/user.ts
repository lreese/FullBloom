export type Role = "admin" | "salesperson" | "data_manager" | "field_worker";
export type UserStatus = "pending" | "active" | "deactivated";
export type AccessLevel = "rw" | "r";

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  status: UserStatus;
  permissions: Record<string, AccessLevel>;
}

export interface UserListItem {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
  status: UserStatus;
  avatar_url: string | null;
  created_at: string;
}
