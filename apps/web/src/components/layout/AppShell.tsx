import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen">
      <Sidebar />

      {/* Main content area — offset for sidebar width on desktop, top bar on mobile */}
      <main className="flex-1 bg-cream overflow-y-auto md:ml-[52px] mt-12 md:mt-0">
        <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
