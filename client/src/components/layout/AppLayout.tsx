import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileTopNav } from "./MobileTopNav";

interface AppLayoutProps {
  children: ReactNode;
}

/*
  AppLayout wraps all authenticated pages.
  Desktop: fixed sidebar left + scrollable content right.
  Mobile: fixed top nav + content below.
  The homepage itself is not scrollable (overflow hidden on the content area).
*/
export const AppLayout = ({ children }: AppLayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-off-white dark:bg-dark-bg">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top nav */}
        <div className="md:hidden">
          <MobileTopNav />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
};
