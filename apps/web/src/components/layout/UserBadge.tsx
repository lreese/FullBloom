import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { LogOut, UserCircle } from "lucide-react";
import { useAuth } from "@/auth/useAuth";

interface UserBadgeProps {
  expanded: boolean;
}

export function UserBadge({ expanded }: UserBadgeProps) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = (user.display_name || user.email)
    .split(/[\s@]/).filter(Boolean).slice(0, 2)
    .map((s) => s[0].toUpperCase()).join("");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded transition-colors border-transparent text-white hover:bg-sidebar-hover"
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full flex-shrink-0 ring-1 ring-white/20" />
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-rose-action ring-1 ring-white/20">
            {initials}
          </div>
        )}
        {expanded && (
          <span className="text-sm font-medium truncate flex-1 text-left">{user.display_name || user.email}</span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-48 bg-white rounded-lg shadow-xl py-1 z-50 border border-border-warm overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <Link
            to="/settings/profile"
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-body hover:bg-cream transition-colors border-transparent"
            onClick={() => setOpen(false)}
          >
            <UserCircle className="w-4 h-4 text-text-muted" /> Profile
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-body hover:bg-cream transition-colors border-transparent"
          >
            <LogOut className="w-4 h-4 text-text-muted" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
