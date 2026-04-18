import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name ?? "");
      setPhone(user.phone ?? "");
    }
  }, [user]);

  if (!user) return null;

  const initials = (user.display_name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("") || (user.email?.[0]?.toUpperCase() ?? "");

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
    <div className="max-w-xl space-y-8">
      <div className="flex items-center gap-6">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover ring-2 ring-cream" />
        ) : (
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold bg-rose-action ring-2 ring-cream">
            {initials}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold text-slate-heading">
            {user.display_name || "Anonymous User"}
          </h1>
          <p className="text-text-muted mt-1">{ROLE_LABELS[user.role as Role]}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-body">
                Display Name
              </label>
              <Input 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-white border-border-warm"
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-body">
                Phone Number
              </label>
              <Input 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                className="bg-white border-border-warm"
                placeholder="e.g. (555) 000-0000"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={saving} size="lg" className="min-w-[140px] bg-sidebar">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            {saved && (
              <div className="flex items-center gap-2 text-green-600 animate-in fade-in slide-in-from-left-2">
                <span className="text-sm font-medium">Changes saved successfully</span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-8 border-t border-border-warm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-heading">Account Info</h2>
            <p className="text-sm text-text-muted mt-1">
              These details are managed by your administrator and cannot be changed here.
            </p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-body">
                Email Address
              </label>
              <Input 
                value={user.email} 
                disabled 
                className="bg-cream-warm border-border-warm text-text-muted cursor-not-allowed opacity-80" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-body">
                Account Role
              </label>
              <Input
                value={ROLE_LABELS[user.role as Role]}
                disabled
                className="bg-cream-warm border-border-warm text-text-muted cursor-not-allowed opacity-80"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
