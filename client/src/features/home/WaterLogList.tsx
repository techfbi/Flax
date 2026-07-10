import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import type { WaterLogEntry } from "@/types/apiTypes";
import { useTheme } from "@/context/ThemeContext";
import { useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface WaterLogListProps {
  logs: WaterLogEntry[];
  editable?: boolean;
}

/*
  One row per water log, same shape regardless of how much was logged,
  no small cup or big cup sizing logic. This is distinct from
  WaterCups, which stays as the compact glanceable grid used in the
  streak panel, this component is for the detailed list in Log intake
  and History.
*/
export const WaterLogList = ({ logs, editable = true }: WaterLogListProps) => {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/water/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["water"] });
      queryClient.invalidateQueries({ queryKey: ["streaks"] });
      toast.success("Water log removed");
    },
    onError: () => toast.error("Could not remove this log. Try again."),
  });

  const sorted = [...logs].sort(
    (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime(),
  );

  return (
    <div className="space-y-2">
      {sorted.map((log) => (
        <div
          key={log.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl
            bg-cocoa/5 dark:bg-dark-white/5
            border border-cocoa/5 dark:border-dark-white/5"
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0
            bg-off-white dark:bg-dark-bg text-cocoa dark:text-dark-white"
          >
            <img
              src={
                resolvedTheme === "dark"
                  ? "/images/cupDark.svg"
                  : "/images/cupWhite.svg"
              }
              alt="waterCup"
              className="object-contain w-[15px] flex"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-cocoa dark:text-dark-white">
              {log.amount_ml}ml
            </p>
            <p className="text-[11px] text-cocoa-faded">
              {new Date(log.logged_at).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>

          {editable && (
            <button
              onClick={() => setDeleteTargetId(log.id)}
              aria-label="Delete water log"
              className="text-cocoa/30 dark:text-dark-white/30 hover:text-rose-500 transition-colors shrink-0"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <ConfirmModal
        open={deleteTargetId !== null}
        title="Remove this water log?"
        message="This removes it from today's total. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTargetId) deleteLog.mutate(deleteTargetId);
          setDeleteTargetId(null);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
