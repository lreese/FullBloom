import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { api } from "@/services/api";
import { ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role, User } from "@/types/user";

export function ProfilePage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const initials = (user.display_name || user.email)
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await api.put<User>("/api/v1/profile", { display_name: displayName, phone });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: "#1e3a5f" }}>
        Profile
      </h1>
      <div className="flex items-center gap-4">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-full" />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-medium"
            style={{ background: "#c27890" }}
          >
            {initials}
          </div>
        )}
        <div>
          <p className="font-medium" style={{ color: "#334155" }}>
            {user.display_name || user.email}
          </p>
          <p className="text-sm" style={{ color: "#94a3b8" }}>
            {ROLE_LABELS[user.role as Role]}
          </p>
        </div>
      </div>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="text-sm font-medium" style={{ color: "#334155" }}>
            Email
          </label>
          <Input value={user.email} disabled className="bg-[#f4f1ec]" />
        </div>
        <div>
          <label className="text-sm font-medium" style={{ color: "#334155" }}>
            Display Name
          </label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium" style={{ color: "#334155" }}>
            Phone
          </label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium" style={{ color: "#334155" }}>
            Role
          </label>
          <Input
            value={ROLE_LABELS[user.role as Role]}
            disabled
            className="bg-[#f4f1ec]"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          {saved && <span className="text-sm text-green-600">Saved</span>}
        </div>
      </form>
    </div>
  );
}
