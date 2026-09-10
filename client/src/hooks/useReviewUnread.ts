import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ApiResponse } from "@/types/apiTypes";

// Checks every 2 minutes whether there are unseen admin replies.
// Drives the red dot on the Reviews nav button. Invalidated when the
// reviews panel opens and marks all replies as read.
export const useReviewUnread = () =>
  useQuery({
    queryKey: ["reviews", "unread"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ hasUnread: boolean }>>(
        "/api/reviews/unread",
      );
      return data.data.hasUnread;
    },
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });