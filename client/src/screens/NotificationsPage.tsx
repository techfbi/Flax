import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileTopNav } from "@/components/layout/MobileTopNav";
import { useScreenTier } from "@/hooks/useMediaQuery";
import { useTheme } from "@/context/ThemeContext";
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

/*
  Notifications page, mobile only. Tablet and desktop already have the
  bell dropdown in the header for this, a whole page there would be
  redundant, so this redirects home if it's ever opened above mobile
  width. Same notifications query and mark read behavior as the bell
  dropdown, both read the same cache key so they never disagree.
*/
export const NotificationsPage = () => {
  const tier = useScreenTier();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (tier !== "mobile") navigate("/", { replace: true });
  }, [tier, navigate]);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } =
        await api.get<
          ApiResponse<{
            notifications: NotificationItem[];
            unreadCount: number;
          }>
        >("/api/notifications");
      return data.data;
    },
    staleTime: 30 * 1000,
    enabled: tier === "mobile",
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

  if (tier !== "mobile") return null;

  return (
    <AppLayout>
      <div
        className="min-h-screen"
        style={{
          background:
            resolvedTheme === "dark"
              ? "linear-gradient(180deg, #3E4E42 -10%, #2D342C 4%, #2D342C 10%, #171410 45%)"
              : "linear-gradient(170deg, #9DAFA1 15%, #EAE8DE 45%, #EAE8DE 30%, #F6F1E7 100%)",
        }}
      >
        <MobileTopNav />
        <div className="pt-20 px-4 pb-8">
          <h1 className="font-heading font-bold text-base text-cocoa dark:text-dark-white mb-6">
            Notifications
          </h1>

          {!data || data.notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm text-cocoa-faded">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.notifications.map((n) => (
                <div
                  key={n.id}
                  className="px-4 py-3 rounded-xl bg-surface-two dark:bg-black-surface"
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
      </div>
    </AppLayout>
  );
};

export default NotificationsPage;
