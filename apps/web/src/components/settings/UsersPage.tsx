import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionsMatrix } from "@/components/settings/PermissionsMatrix";
import type { Role, UserListItem } from "@/types/user";

const ROLE_OPTIONS: Role[] = ["admin", "salesperson", "data_manager", "field_worker"];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    active: { bg: "#dcfce7", color: "#15803d" },
    pending: { bg: "#fef9c3", color: "#a16207" },
    deactivated: { bg: "#fce7f3", color: "#9f1239" },
  };
  const s = styles[status] ?? styles.deactivated;
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium capitalize"
      style={{ background: s.bg, color: s.color }}
    >
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

  async function handleRoleChange(userId: string, role: Role) {
    await api.put(`/api/v1/users/${userId}/role`, { role });
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
  }

  async function handleDeactivate(userId: string) {
    await api.post(`/api/v1/users/${userId}/deactivate`, {});
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: "deactivated" } : u))
    );
  }

  async function handleReactivate(userId: string) {
    await api.post(`/api/v1/users/${userId}/reactivate`, {});
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: "active" } : u))
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: "#1e3a5f" }}>
          Users
        </h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowMatrix(!showMatrix)}
            className="text-sm"
          >
            {showMatrix ? "Hide Permissions" : "Show Permissions"}
          </Button>
          <Button
            onClick={() => setShowInvite(!showInvite)}
            style={{ background: "#c27890", color: "white" }}
            className="text-sm"
          >
            Invite User
          </Button>
        </div>
      </div>

      {/* Permissions Matrix */}
      {showMatrix && (
        <div
          className="rounded-lg p-4"
          style={{ background: "white", border: "1px solid #e0ddd8" }}
        >
          <h2 className="text-base font-semibold mb-3" style={{ color: "#1e3a5f" }}>
            Role Permissions
          </h2>
          <PermissionsMatrix />
        </div>
      )}

      {/* Invite Form */}
      {showInvite && (
        <div
          className="rounded-lg p-4"
          style={{ background: "white", border: "1px solid #e0ddd8" }}
        >
          <h2 className="text-base font-semibold mb-3" style={{ color: "#1e3a5f" }}>
            Invite New User
          </h2>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "#334155" }}>
                Email
              </label>
              <Input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-64"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "#334155" }}>
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="h-9 rounded-md border px-3 text-sm"
                style={{ borderColor: "#e0ddd8", color: "#334155" }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              disabled={inviting}
              style={{ background: "#c27890", color: "white" }}
            >
              {inviting ? "Sending..." : "Send Invite"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowInvite(false)}
            >
              Cancel
            </Button>
            {inviteError && (
              <p className="text-sm text-red-600 w-full">{inviteError}</p>
            )}
          </form>
        </div>
      )}

      {/* Users Table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: "white", border: "1px solid #e0ddd8" }}
      >
        {loading ? (
          <p className="px-4 py-6 text-sm text-center" style={{ color: "#94a3b8" }}>
            Loading users…
          </p>
        ) : users.length === 0 ? (
          <p className="px-4 py-6 text-sm text-center" style={{ color: "#94a3b8" }}>
            No users found.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #e0ddd8", background: "#f4f1ec" }}>
                <th className="text-left py-3 px-4 font-medium" style={{ color: "#1e3a5f" }}>
                  User
                </th>
                <th className="text-left py-3 px-4 font-medium" style={{ color: "#1e3a5f" }}>
                  Role
                </th>
                <th className="text-left py-3 px-4 font-medium" style={{ color: "#1e3a5f" }}>
                  Status
                </th>
                <th className="text-left py-3 px-4 font-medium" style={{ color: "#1e3a5f" }}>
                  Joined
                </th>
                <th className="text-right py-3 px-4 font-medium" style={{ color: "#1e3a5f" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: "1px solid #e0ddd8" }}
                  className="hover:bg-[#f4f1ec]/50"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt=""
                          className="w-7 h-7 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                          style={{ background: "#c27890" }}
                        >
                          {(u.display_name || u.email)
                            .split(/[\s@]/)
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((s) => s[0].toUpperCase())
                            .join("")}
                        </div>
                      )}
                      <div>
                        {u.display_name && (
                          <p className="font-medium" style={{ color: "#334155" }}>
                            {u.display_name}
                          </p>
                        )}
                        <p className="text-xs" style={{ color: "#94a3b8" }}>
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      className="h-8 rounded border px-2 text-xs"
                      style={{ borderColor: "#e0ddd8", color: "#334155" }}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="py-3 px-4 text-xs" style={{ color: "#94a3b8" }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {u.status !== "deactivated" ? (
                      <button
                        onClick={() => handleDeactivate(u.id)}
                        className="text-xs px-2 py-1 rounded border hover:bg-[#f4f1ec] transition-colors"
                        style={{ color: "#9f1239", borderColor: "#fce7f3" }}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(u.id)}
                        className="text-xs px-2 py-1 rounded border hover:bg-[#f4f1ec] transition-colors"
                        style={{ color: "#15803d", borderColor: "#dcfce7" }}
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* About Roles */}
      <div>
        <h2 className="text-base font-semibold mb-3" style={{ color: "#1e3a5f" }}>
          About Roles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              role: "Admin",
              color: "#c27890",
              description:
                "Full access to all areas, manages users and settings. For owners and office managers.",
            },
            {
              role: "Salesperson",
              color: "#3b82f6",
              description:
                "Full access to orders, customers, and pricing. Views inventory and products. No user management or import.",
            },
            {
              role: "Data Manager",
              color: "#8b5cf6",
              description:
                "Manages products, customers, pricing, and imports. Views orders. For office staff.",
            },
            {
              role: "Field Worker",
              color: "#22c55e",
              description:
                "Manages inventory counts, estimates, and harvest status. Views orders, customers, and products. No pricing or import access.",
            },
          ].map(({ role, color, description }) => (
            <div
              key={role}
              className="rounded-lg p-4"
              style={{
                background: "white",
                border: "1px solid #e0ddd8",
                borderLeft: `4px solid ${color}`,
              }}
            >
              <p className="font-semibold text-sm mb-1" style={{ color: "#1e3a5f" }}>
                {role}
              </p>
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
