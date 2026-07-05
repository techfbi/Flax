import { useState, useEffect, useRef, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useSessionState } from "@/hooks/useSessionState";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  /*
  Scroll rules:
  Mobile (<md): entire page scrolls. Mobile top nav is sticky at top.
  Tablet (md): entire page scrolls. Sidebar icon strip is fixed on left.
  Desktop (lg+): no full page scroll. Content sections scroll internally.
    Sidebar is fixed on left. Content area manages its own overflow.
*/
  const [collapsed, setCollapsed] = useSessionState<boolean>(
    "sidebar-collapsed",
    false,
  );
  const [mdOverlayOpen, setMdOverlayOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w >= 1024) {
        /* Desktop: always expanded by default */
        setCollapsed(false);
        setMdOverlayOpen(false);
      } else if (w >= 768) {
        /* Tablet: always collapsed icon strip */
        setCollapsed(true);
        setMdOverlayOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // setCollapsed from useSessionState is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Click outside overlay to close on tablet */
  useEffect(() => {
    if (!mdOverlayOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(e.target as Node)
      ) {
        setMdOverlayOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mdOverlayOpen]);

  const handleDesktopToggle = () => {
    if (window.innerWidth >= 1024) {
      setCollapsed(!collapsed);
    }
  };

  return (
    <div className="flex bg-off-white dark:bg-dark-bg min-h-screen lg:h-screen lg:overflow-hidden">
      {/* Desktop sidebar — pushes content, toggle collapses/expands */}
      <div className="hidden lg:flex shrink- sticky top-0 h-screen">
        <Sidebar collapsed={collapsed} onToggle={handleDesktopToggle} />
      </div>

      {/* Tablet: collapsed icon strip always visible */}
      <div className="hidden md:flex lg:hidden shrink-0">
        {/* Fixed icon strip */}
        <div className="sticky top-0 h-screen">
          <Sidebar collapsed={true} onToggle={() => setMdOverlayOpen(true)} />
        </div>

        {/* Overlay when expanded on tablet */}
        {mdOverlayOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50" />
            <div
              ref={overlayRef}
              className="fixed left-0 top-0 bottom-0 h-screen z-50"
            >
              <Sidebar
                collapsed={false}
                onToggle={() => setMdOverlayOpen(false)}
              />
            </div>
          </>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/*
          Mobile + tablet: no overflow constraint. Content grows naturally.
          Browser handles the scroll bar. This is "whole page scrolls" behavior.

          Desktop (lg): overflow-hidden. Content sections manage their own
          internal scrolling. The page itself never scrolls.
        */}
        <main className="flex-1 lg:overflow-hidden lg:min-h-0">{children}</main>
      </div>
    </div>
  );
};
