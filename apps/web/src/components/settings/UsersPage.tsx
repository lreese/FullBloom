import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionsMatrix } from "@/components/settings/PermissionsMatrix";
import type { Role, UserListItem } from "@/types/user";

const ROLE_OPTIONS: Role[] = ["admin", "salesperson", "data_manager", "field_worker"];

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; text: string }> = {
    active: { bg: "bg-box-green-bg", text: "text-box-green-text" },
    pending: { bg: "bg-box-amber-bg", text: "text-box-amber-text" },
    deactivated: { bg: "bg-box-pink-bg", text: "text-box-pink-text" },
  };
  const config = configs[status] ?? configs.deactivated;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${config.bg} ${config.text}`}>
      {status}
    </span>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMatrix, setShowMatrix] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("salesperson");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await api.get<UserListItem[]>("/api/v1/users");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    try {
      await api.post("/api/v1/users/invite", { email: inviteEmail, role: inviteRole });
      setInviteEmail("");
      setInviteRole("salesperson");
      setShowInvite(false);
      await loadUsers();
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: Role) {
    try {
      await api.put(`/api/v1/users/${userId}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change role");
    }
  }

  async function handleDeactivate(userId: string) {
    try {
      await api.post(`/api/v1/users/${userId}/deactivate`, {});
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: "deactivated" } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function handleReactivate(userId: string) {
    try {
      await api.post(`/api/v1/users/${userId}/reactivate`, {});
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: "active" } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-heading">Users</h1>
          <p className="text-text-muted mt-1">Manage team members and their access permissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowMatrix(!showMatrix)}
            className="bg-white border-border-warm text-text-body hover:bg-cream"
          >
            {showMatrix ? "Hide Permissions" : "Show Permissions"}
          </Button>
          <Button
            onClick={() => setShowInvite(!showInvite)}
            className="bg-rose-action text-white hover:opacity-90"
          >
            Invite User
          </Button>
        </div>
      </div>

      {/* Permissions Matrix */}
      {showMatrix && (
        <div className="rounded-xl p-6 bg-white border border-border-warm shadow-sm animate-in fade-in slide-in-from-top-2">
          <h2 className="text-lg font-bold text-slate-heading mb-4">
            Role Permissions
          </h2>
          <PermissionsMatrix />
        </div>
      )}

      {/* Invite Form */}
      {showInvite && (
        <div className="rounded-xl p-6 bg-white border border-border-warm shadow-sm animate-in fade-in slide-in-from-top-2">
          <h2 className="text-lg font-bold text-slate-heading mb-4">
            Invite New User
          </h2>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-text-body">
                Email Address
              </label>
              <Input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-72 bg-white border-border-warm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-text-body">
                Account Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="h-8 rounded-lg border border-border-warm bg-white px-3 text-sm text-text-body outline-none focus:ring-2 focus:ring-ring/50"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={inviting}
                className="bg-rose-action text-white hover:opacity-90"
              >
                {inviting ? "Sending..." : "Send Invite"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInvite(false)}
                className="border-border-warm text-text-body hover:bg-cream"
              >
                Cancel
              </Button>
            </div>
            {inviteError && (
              <p className="text-sm text-red-600 w-full font-medium">{inviteError}</p>
            )}
          </form>
        </div>
      )}

      {/* Action error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl overflow-hidden bg-white border border-border-warm shadow-sm">
        {loading ? (
          <div className="px-4 py-12 text-center text-text-muted">
            <p className="animate-pulse">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="px-4 py-12 text-center text-text-muted">
            <p>No users found.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-cream border-b border-border-warm">
                <th className="text-left py-3.5 px-6 font-semibold text-slate-heading">
                  User
                </th>
                <th className="text-left py-3.5 px-6 font-semibold text-slate-heading">
                  Role
                </th>
                <th className="text-left py-3.5 px-6 font-semibold text-slate-heading">
                  Status
                </th>
                <th className="text-left py-3.5 px-6 font-semibold text-slate-heading">
                  Joined
                </th>
                <th className="text-right py-3.5 px-6 font-semibold text-slate-heading">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-warm">
              {users.map((u) => {
                const initials = (u.display_name || "")
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((s) => s[0].toUpperCase())
                  .join("") || (u.email?.[0]?.toUpperCase() ?? "");

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-cream/30 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-cream"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold bg-rose-action ring-2 ring-cream">
                            {initials}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-body leading-tight">
                            {u.display_name || "New User"}
                          </span>
                          <span className="text-xs text-text-muted font-medium">
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                        className="h-8 rounded-lg border border-border-warm bg-white px-2.5 text-xs text-text-body font-medium outline-none focus:ring-2 focus:ring-ring/50"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="py-4 px-6 text-xs text-text-muted font-medium tabular-nums">
                      {new Date(u.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {u.status !== "deactivated" ? (
                        <button
                          onClick={() => handleDeactivate(u.id)}
                          className="text-xs font-bold px-3 py-1 rounded-full bg-box-pink-bg text-box-pink-text hover:opacity-80 transition-opacity border-transparent"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(u.id)}
                          className="text-xs font-bold px-3 py-1 rounded-full bg-box-green-bg text-box-green-text hover:opacity-80 transition-opacity border-transparent"
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* About Roles */}
      <div className="pt-4">
        <h2 className="text-xl font-bold text-slate-heading mb-4">
          About Access Roles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              role: "Admin",
              color: "bg-rose-action",
              description:
                "Full access to all areas, manages users and settings. For owners and office managers.",
            },
            {
              role: "Salesperson",
              color: "bg-blue-500",
              description:
                "Full access to orders, customers, and pricing. Views inventory and products.",
            },
            {
              role: "Data Manager",
              color: "bg-purple-500",
              description:
                "Manages products, customers, and pricing. Views orders. For office staff.",
            },
            {
              role: "Field Worker",
              color: "bg-green-600",
              description:
                "Manages inventory counts, estimates, and harvest. Views orders and products.",
            },
          ].map(({ role, color, description }) => (
            <div
              key={role}
              className="rounded-xl p-5 bg-white border border-border-warm shadow-sm border-l-4 overflow-hidden"
              style={{ borderLeftColor: "inherit" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                <span className="font-bold text-sm text-slate-heading">
                  {role}
                </span>
              </div>
              <p className="text-xs text-text-muted font-medium leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
