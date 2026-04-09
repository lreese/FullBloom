import { useState } from "react";
import {
  ClipboardList,
  Users,
  Flower2,
  DollarSign,
  Upload,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Orders", icon: ClipboardList, href: "/orders" },
  { label: "Customers", icon: Users, href: "/customers" },
  { label: "Products", icon: Flower2, href: "/products" },
  { label: "Pricing", icon: DollarSign, href: "/pricing" },
  { label: "Import", icon: Upload, href: "/import" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activePath] = useState("/orders");

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-12 px-3 bg-sidebar">
        <span className="text-white font-bold text-lg tracking-tight">FullBloom</span>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white p-1"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* ── Mobile backdrop ────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex flex-col h-full bg-sidebar transition-all duration-200",
          // Desktop
          "hidden md:flex",
          expanded ? "w-[200px]" : "w-[52px]",
          // Mobile override
          mobileOpen && "!flex w-[200px]"
        )}
      >
        {/* Monogram + close on mobile */}
        <div className="flex items-center justify-between h-14 px-3">
          <span className="text-white font-bold text-xl tracking-tight select-none">
            {expanded || mobileOpen ? "FullBloom" : "FB"}
          </span>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden text-white p-1"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1 px-2 mt-2">
          {navItems.map(({ label, icon: Icon, href }) => {
            const active = activePath === href;
            return (
              <a
                key={href}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  setMobileOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-white/80 hover:bg-sidebar-hover hover:text-white transition-colors",
                  active && "bg-sidebar-hover text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {(expanded || mobileOpen) && (
                  <span className="whitespace-nowrap">{label}</span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Desktop expand/collapse toggle */}
        <div className="hidden md:flex px-2 py-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors px-2 py-1 rounded-md w-full"
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {expanded ? (
              <>
                <PanelLeftClose className="h-5 w-5 shrink-0" />
                <span className="text-xs whitespace-nowrap">Collapse</span>
              </>
            ) : (
              <PanelLeftOpen className="h-5 w-5 shrink-0" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
