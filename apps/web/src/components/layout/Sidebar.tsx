import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  ChevronDown,
  Leaf,
  FolderTree,
  Palette,
  Boxes,
  Tag,
  LayoutGrid,
  BarChart3,
  ClipboardCheck,
  TrendingUp,
  Eye,
  Sprout,
  List,
  PlusCircle,
  RefreshCw,
  UserCircle,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/useAuth";
import { UserBadge } from "@/components/layout/UserBadge";

interface NavChild {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  children?: NavChild[];
}

// Map nav labels to permission area keys
const NAV_AREA_MAP: Record<string, string> = {
  Orders: "orders",
  Customers: "customers",
  Products: "products",
  Pricing: "pricing",
  Inventory: "inventory_counts",
  Import: "import",
};

const baseNavItems: NavItem[] = [
  {
    label: "Orders",
    icon: ClipboardList,
    href: "/orders",
    children: [
      { label: "All Orders", icon: List, href: "/orders" },
      { label: "New Order", icon: PlusCircle, href: "/orders/new" },
      { label: "Standing Orders", icon: RefreshCw, href: "/standing-orders" },
    ],
  },
  { label: "Customers", icon: Users, href: "/customers" },
  {
    label: "Products",
    icon: Flower2,
    href: "/products",
    children: [
      { label: "Varieties", icon: Leaf, href: "/products/varieties" },
      { label: "Product Lines", icon: FolderTree, href: "/products/product-lines" },
      { label: "Colors", icon: Palette, href: "/products/colors" },
      { label: "Product Types", icon: Boxes, href: "/products/product-types" },
    ],
  },
  {
    label: "Pricing",
    icon: DollarSign,
    href: "/pricing",
    children: [
      { label: "Sales Items", icon: Tag, href: "/pricing/sales-items" },
      { label: "Price Lists", icon: LayoutGrid, href: "/pricing/price-lists" },
      { label: "Customer Prices", icon: Users, href: "/pricing/customer-prices" },
    ],
  },
  {
    label: "Inventory",
    icon: BarChart3,
    href: "/inventory",
    children: [
      { label: "Counts", icon: ClipboardCheck, href: "/inventory/counts" },
      { label: "Estimates", icon: TrendingUp, href: "/inventory/estimates" },
      { label: "Availability", icon: Eye, href: "/inventory/availability" },
      { label: "Harvest Status", icon: Sprout, href: "/inventory/harvest-status" },
    ],
  },
  { label: "Import", icon: Upload, href: "/import" },
];

interface SidebarProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function Sidebar({ expanded, onExpandedChange }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const activePath = location.pathname;
  const { canAccess, role } = useAuth();

  const isExpanded = expanded || mobileOpen;

  // Build settings children based on role
  const settingsChildren: NavChild[] = [
    { label: "Profile", icon: UserCircle, href: "/settings/profile" },
    ...(role === "admin" ? [{ label: "Users", icon: Users, href: "/settings/users" }] : []),
  ];

  const settingsItem: NavItem = {
    label: "Settings",
    icon: Settings,
    href: "/settings",
    children: settingsChildren,
  };

  // Filter nav items based on permissions
  const navItems: NavItem[] = [
    ...baseNavItems.filter((item) => {
      const area = NAV_AREA_MAP[item.label];
      if (!area) return true; // items not in the map are always shown
      return canAccess(area, "read");
    }),
    settingsItem,
  ];

  const isChildActive = (children: NavChild[]) =>
    children.some((c) => activePath.startsWith(c.href));

  const renderNavItem = (item: NavItem) => {
    const { label, icon: Icon, href, children } = item;

    // Items with children: expandable dropdown (expanded mode) or popover (collapsed mode)
    if (children) {
      const childActive = isChildActive(children);

      // Collapsed mode: popover flyout
      if (!isExpanded) {
        return (
          <Popover key={href}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-white/80 hover:bg-sidebar-hover hover:text-white transition-colors w-full text-left border-transparent",
                  childActive && "bg-sidebar-hover text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="start"
              className="w-44 p-1 bg-white"
              sideOffset={8}
            >
              {children.map((child) => {
                const ChildIcon = child.icon;
                const active = activePath.startsWith(child.href);
                return (
                  <button
                    key={child.href}
                    onClick={() => navigate(child.href)}
                    className={cn(
                      "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm text-text-body hover:bg-cream transition-colors border-transparent",
                      active && "bg-cream font-medium text-slate-heading"
                    )}
                  >
                    <ChildIcon className="h-4 w-4 shrink-0 text-text-muted" />
                    <span>{child.label}</span>
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        );
      }

      // Expanded mode: toggle dropdown
      const isDropdownOpen = openDropdowns.has(href);
      return (
        <div key={href}>
          <button
            onClick={() =>
              setOpenDropdowns((prev) => {
                const next = new Set(prev);
                if (next.has(href)) next.delete(href);
                else next.add(href);
                return next;
              })
            }
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-white/80 hover:bg-sidebar-hover hover:text-white transition-colors w-full text-left border-transparent",
              childActive && !isDropdownOpen && "bg-sidebar-hover text-white"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap flex-1">{label}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform opacity-60",
                isDropdownOpen && "rotate-180 opacity-100"
              )}
            />
          </button>
          {isDropdownOpen && (
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-muted/30 pl-2">
              {children.map((child) => {
                const ChildIcon = child.icon;
                const active = activePath.startsWith(child.href);
                return (
                  <button
                    key={child.href}
                    onClick={() => {
                      navigate(child.href);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-white/70 hover:bg-sidebar-hover hover:text-white transition-colors w-full text-left border-transparent",
                      active && "bg-sidebar-hover text-white font-semibold"
                    )}
                  >
                    <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{child.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Simple nav item (no children)
    const active = activePath === href;
    return (
      <button
        key={href}
        onClick={() => {
          navigate(href);
          setMobileOpen(false);
        }}
        className={cn(
          "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-white/80 hover:bg-sidebar-hover hover:text-white transition-colors w-full text-left border-transparent",
          active && "bg-sidebar-hover text-white"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {isExpanded && (
          <span className="whitespace-nowrap">{label}</span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-12 px-3 bg-sidebar">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="Logo" className="h-6 w-6 rounded-sm" />
          <span className="text-white font-bold text-lg tracking-tight">FullBloom</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white p-1 border-transparent"
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
          "fixed top-0 left-0 z-50 flex flex-col h-full bg-sidebar transition-all duration-200 shadow-xl",
          "hidden md:flex",
          expanded ? "w-[200px]" : "w-[52px]",
          mobileOpen && "!flex w-[200px]"
        )}
      >
        <div className="flex items-center justify-between h-14 px-3">
          <div className="flex items-center gap-2">
            <img src="/icon-192.png" alt="Logo" className="h-7 w-7 rounded-sm shadow-sm" />
            {isExpanded && (
              <span className="text-white font-bold text-xl tracking-tight select-none">
                FullBloom
              </span>
            )}
          </div>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden text-white p-1 border-transparent"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-2 mt-2">
          {navItems.map(renderNavItem)}
        </nav>

        <div className="hidden md:flex flex-col px-2 py-3 gap-2 border-t border-sidebar-muted/30">
          <UserBadge expanded={expanded} />
          <button
            onClick={() => onExpandedChange(!expanded)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors px-2 py-1 rounded-md w-full border-transparent"
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
