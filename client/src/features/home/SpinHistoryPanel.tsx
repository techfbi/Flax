import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import { goToLogMeal } from "@/lib/prefillNavigation";
import { toast } from "sonner";
import api from "@/lib/api";
import type {
  ApiResponse,
  SpinHistoryEntry,
  FlaggedMeal,
} from "@/types/apiTypes";

/*
  Right column panel on the Spin page. Toggles between spin history
  and flagged meals with a sliding underline, not a colored pill.
  History is grouped into Today and Yesterday, each group collapses
  on its own. Each entry: name and Log button on one line, faded
  truncated description under it, filters applied and timestamp on
  the last line. Thin faded divider between entries, no boxed cards.
*/

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

const isToday = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
};

const formatFilters = (filters: Record<string, unknown>): string => {
  const mealType =
    typeof filters.meal_type === "string" ? filters.meal_type : null;
  const tags = Array.isArray(filters.tags) ? (filters.tags as string[]) : [];

  const parts: string[] = [];
  if (mealType)
    parts.push(mealType.charAt(0).toUpperCase() + mealType.slice(1));
  if (tags.length) parts.push(tags.join(", "));

  return parts.length > 0 ? parts.join(" · ") : "No filters applied";
};

type View = "history" | "flagged";

export const SpinHistoryPanel = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("history");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const queryClient = useQueryClient();
  const unflagMutation = useMutation({
    mutationFn: async (flagId: string) => {
      await api.delete(`/api/spin/flag/${flagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spin-flagged"] });
      toast.success("Unflagged");
    },
    onError: () => toast.error("Could not unflag. Try again."),
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["spin-history", 2],
    queryFn: async () => {
      const { data } = await api.get<
        ApiResponse<{ history: SpinHistoryEntry[]; days: number }>
      >("/api/spin/history?days=2");
      return data.data.history;
    },
    staleTime: 60 * 1000,
  });

  const { data: flagged, isLoading: flaggedLoading } = useQuery({
    queryKey: ["spin-flagged"],
    queryFn: async () => {
      const { data } =
        await api.get<ApiResponse<{ flagged_meals: FlaggedMeal[] }>>(
          "/api/spin/flagged",
        );
      return data.data.flagged_meals;
    },
    staleTime: 60 * 1000,
  });

  const flaggedRefs = new Set((flagged ?? []).map((f) => f.food_ref));

  const handleLog = (entry: SpinHistoryEntry) => {
    if (!entry.food_ref) return;
    goToLogMeal(navigate, {
      food_ref: entry.food_ref,
      food_name: entry.result_name,
    });
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const todayEntries = (history ?? []).filter((e) => isToday(e.spun_at));
  const yesterdayEntries = (history ?? []).filter((e) => !isToday(e.spun_at));

  const renderEntry = (entry: SpinHistoryEntry) => {
    const isExpanded = expandedId === entry.id;
    const isFlagged = flaggedRefs.has(entry.food_ref);

    return (
      <div
        key={entry.id}
        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
        className="py-3 border-b border-cocoa/15 dark:border-dark-sec/20 last:border-0 cursor-pointer"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isFlagged && <img src="./images/redFlag.svg" />}
            <p className="text-xs lg:text-sm font-bold text-cocoa dark:text-dark-white truncate">
              {entry.result_name}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLog(entry);
            }}
            className="text-[9px] lg:text-[11px] font-normal px-3 lg:px-2 py-1 rounded-lg
             dark:border-dark-sec/50 dark:hover:border-dark-sec/90 border-cocoa/50 hover:border-cocoa/90 border-[1px] text-cocoa dark:text-surface shrink-0"
          >
            Log
          </button>
        </div>

        {entry.result_description && (
          <p
            className={`text-xs text-cocoa-faded font-semibold mt-1 ${
              isExpanded ? "" : "truncate"
            }`}
          >
            {isExpanded
              ? entry.result_description
              : `${entry.result_description.slice(0, 60)}...`}
          </p>
        )}

        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[11px] font-light text-cocoa-faded">
            {formatFilters(entry.filters_applied)}
          </p>
          <p className="text-[11px] font-light text-cocoa-faded">
            {formatTime(entry.spun_at)}
          </p>
        </div>
      </div>
    );
  };

  const renderGroup = (label: string, entries: SpinHistoryEntry[]) => {
    if (entries.length === 0) return null;
    const collapsed = collapsedGroups.has(label);

    return (
      <div key={label} className="mb-2">
        <button
          onClick={() => toggleGroup(label)}
          className="flex items-center justify-between w-full py-1.5"
        >
          <span className="text-xs font-semibold text-cocoa/70 dark:text-dark-white/60 uppercase tracking-wide pb-5 md:pb-2 lg:pb-0">
            {label}
          </span>
          <ChevronDown
            size={14}
            className={`text-cocoa-faded transition-transform ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
        </button>
        {!collapsed && <div>{entries.map(renderEntry)}</div>}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 mb-2 w-[200px] md:w-auto">
        <SlidingTabs
          tabs={[
            { key: "history" as const, label: "Spin history" },
            { key: "flagged" as const, label: "Flagged" },
          ]}
          active={view}
          onChange={setView}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {view === "history" ? (
          <>
            {historyLoading && (
              <div className="space-y-2 pt-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl bg-cocoa/10 dark:bg-dark-white/10 animate-pulse"
                  />
                ))}
              </div>
            )}
            {!historyLoading && (!history || history.length === 0) && (
              <p className="text-xs text-cocoa-faded py-4 text-center">
                No spins in the last 2 days
              </p>
            )}
            {!historyLoading && renderGroup("Today", todayEntries)}
            {!historyLoading && renderGroup("Yesterday", yesterdayEntries)}
          </>
        ) : (
          <div>
            {flaggedLoading && (
              <div className="h-16 rounded-xl bg-cocoa/10 dark:bg-dark-white/10 animate-pulse mt-2" />
            )}
            {!flaggedLoading && (!flagged || flagged.length === 0) && (
              <p className="text-xs text-cocoa-faded py-4 text-center">
                No flagged meals
              </p>
            )}
            {flagged?.map((meal) => (
              <button
                key={meal.id}
                onClick={() => unflagMutation.mutate(meal.id)}
                disabled={unflagMutation.isPending}
                className="flex items-center justify-between w-full py-3 text-left
                border-b border-cocoa/15 dark:border-dark-sec/20 last:border-0
                hover:opacity-60 transition-opacity disabled:opacity-40"
              >
                <p className="text-sm font-medium text-cocoa dark:text-dark-white">
                  {meal.food_name}
                </p>
                <span className="text-[11px] text-cocoa-faded">
                  Tap to unflag · {formatTime(meal.created_at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
