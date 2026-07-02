import { useEffect, useRef } from "react";

interface NotificationDropdownProps {
  onClose: () => void;
}

/*
  Notification dropdown (desktop only).
  Positioned pointing toward the bell icon (top-right of the panel).
  Shows web push notifications or "No notifications" if empty.
  For now, web push notifications are not yet wired to a list endpoint.
  The dropdown shows a placeholder until the service worker is set up.

  TRACK: wire to real web push notification history when service worker is implemented.
*/
export const NotificationDropdown = ({
  onClose,
}: NotificationDropdownProps) => {
  const ref = useRef<HTMLDivElement>(null);

  /* Close when clicking outside */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-8 z-50 w-72">
      {/* Arrow pointing up toward bell */}
      <div className="flex justify-end pr-3">
        <div
          className="w-3 h-3 rotate-45 bg-surface dark:bg-black-surface
          border-l border-t border-cocoa/10 dark:border-dark-white/10"
        />
      </div>

      {/* Dropdown card */}
      <div
        className="bg-surface dark:bg-black-surface rounded-2xl shadow-xl
        border border-cocoa/10 dark:border-dark-white/10 overflow-hidden -mt-1.5"
      >
        <div className="px-4 py-3 border-b border-cocoa/5 dark:border-dark-white/5">
          <p className="text-sm font-semibold text-cocoa dark:text-dark-white">
            Notifications
          </p>
        </div>

        <div className="px-4 py-6 text-center">
          <p className="text-sm text-cocoa-faded">No notifications</p>
        </div>
      </div>
    </div>
  );
};
