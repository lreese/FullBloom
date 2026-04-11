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
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

const navItems: NavItem[] = [
  { label: "Orders", icon: ClipboardList, href: "/orders" },
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
  { label: "Import", icon: Upload, href: "/import" },
  { label: "Settings", icon: Settings, href: "/settings" },
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

  const isExpanded = expanded || mobileOpen;

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
                  "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-white/80 hover:bg-sidebar-hover hover:text-white transition-colors w-full text-left",
                  childActive && "bg-sidebar-hover text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="start"
              className="w-44 p-1"
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
                      "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm text-[#334155] hover:bg-[#f4f1ec] transition-colors",
                      active && "bg-[#f4f1ec] font-medium"
                    )}
                  >
                    <ChildIcon className="h-4 w-4 shrink-0 text-[#94a3b8]" />
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
              "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-white/80 hover:bg-sidebar-hover hover:text-white transition-colors w-full text-left",
              childActive && "bg-sidebar-hover text-white"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap flex-1">{label}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                isDropdownOpen && "rotate-180"
              )}
            />
          </button>
          {isDropdownOpen && (
            <div className="ml-4 mt-0.5 space-y-0.5">
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
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-white/70 hover:bg-sidebar-hover hover:text-white transition-colors w-full text-left",
                      active && "bg-sidebar-hover text-white"
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
          "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-white/80 hover:bg-sidebar-hover hover:text-white transition-colors w-full text-left",
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
          "hidden md:flex",
          expanded ? "w-[200px]" : "w-[52px]",
          mobileOpen && "!flex w-[200px]"
        )}
      >
        <div className="flex items-center justify-between h-14 px-3">
          <span className="text-white font-bold text-xl tracking-tight select-none">
            {isExpanded ? "FullBloom" : "FB"}
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

        <nav className="flex-1 flex flex-col gap-1 px-2 mt-2">
          {navItems.map(renderNavItem)}
        </nav>

        <div className="hidden md:flex px-2 py-3">
          <button
            onClick={() => onExpandedChange(!expanded)}
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
