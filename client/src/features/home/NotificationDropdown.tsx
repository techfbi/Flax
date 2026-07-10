import { useEffect } from "react";
import { X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/apiTypes";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationDropdownProps {
  onClose: () => void;
}
/*
  Notification dropdown (desktop only).
  Positioned pointing toward the bell icon (top-right of the panel).
  Shows web push notifications or "No notifications" if empty.
  For now, web push notifications are not yet wired to a list endpoint.
  The dropdown shows a placeholder until the service worker is set up.

*/
/*
  Bell dropdown. Backdrop closes it on outside click, X closes it
  explicitly, both call the same onClose the parent passed in so the
  parent's open/closed state is the single source of truth.
*/
export const NotificationDropdown = ({
  onClose,
}: NotificationDropdownProps) => {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await api.get<
        ApiResponse<{
          notifications: NotificationItem[];
          unreadCount: number;
        }>
      >("/api/notifications");
      return data.data;
    },
    staleTime: 30 * 1000,
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      await api.post("/api/notifications/mark-read");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    if (data && data.unreadCount > 0) markReadMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.unreadCount]);

  return (
    <>
      {/* Backdrop, click anywhere outside the panel to close */}
      <div className="fixed inset-0 z-20" onClick={onClose} />

      <div
        className="absolute right-0 top-full mt-2 w-80 bg-surface-two dark:bg-black-surface
        rounded-2xl shadow-lg border border-cocoa/10 dark:border-dark-white/10 z-30 max-h-96 overflow-y-auto"
      >
        <div className="flex items-center justify-between p-4 border-b border-cocoa/10 dark:border-dark-white/10">
          <h3 className="font-heading font-bold text-sm text-cocoa dark:text-dark-white">
            Notifications
          </h3>
          <button
            onClick={onClose}
            aria-label="Close notifications"
            className="text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white"
          >
            <X size={16} />
          </button>
        </div>

        {!data || data.notifications.length === 0 ? (
          <p className="text-sm text-cocoa-faded text-center py-10">
            No notifications yet
          </p>
        ) : (
          <div>
            {data.notifications.map((n) => (
              <div
                key={n.id}
                className="px-4 py-3 border-b border-cocoa/5 dark:border-dark-white/5 last:border-0"
              >
                <p className="text-sm font-medium text-cocoa dark:text-dark-white">
                  {n.title}
                </p>
                <p className="text-xs text-cocoa-faded mt-0.5">{n.body}</p>
                <p className="text-[10px] text-cocoa-faded mt-1">
                  {new Date(n.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
