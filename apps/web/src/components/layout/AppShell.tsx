import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  return (
    <div className="flex h-screen">
      <Sidebar expanded={sidebarExpanded} onExpandedChange={setSidebarExpanded} />

      {/* Main content area — margin tracks sidebar width on desktop, top bar offset on mobile */}
      <main
        className={`flex-1 bg-cream overflow-y-auto mt-12 md:mt-0 transition-[margin-left] duration-200 ml-0 ${
          sidebarExpanded ? "md:ml-[200px]" : "md:ml-[52px]"
        }`}
      >
        <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
