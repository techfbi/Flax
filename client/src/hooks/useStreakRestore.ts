import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getLocalDateStr } from "@/lib/date";
import api from "@/lib/api";

// Shared by StreakPanel and HomePage's mobile streak cards, both show
// a "Restore?" tag and both need to do the exact same thing when it's
// tapped, one hook so there is only one version of this to maintain.
export const useStreakRestore = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (type: "goal" | "water") => {
      await api.post("/api/streaks/restore", { type, date: getLocalDateStr() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["streaks"] });
      toast.success("Streak restored");
    },
    onError: () => toast.error("Could not restore. Try again."),
  });
};