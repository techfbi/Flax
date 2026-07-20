import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { WaterLogList } from "./WaterLogList";
import api from "@/lib/api";
import { toThumbnail } from "@/lib/images";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import type {
  ApiResponse,
  MealLogEntry,
  WaterData,
  MealType,
} from "@/types/apiTypes";
import { getLocalDateStr } from "@/lib/date";

/*
  History tab. Meals and water logs, not bounded to 2 days, that limit
  belongs to spin history only. Left and right arrows step one day at
  a time, clicking the date label itself opens the native date picker
  so the user can jump straight to any day. Only the future is off
  limits.
*/

const toDateStr = (d: Date) => d.toISOString().split("T")[0];

const formatLabel = (dateStr: string) => {
  const today = getLocalDateStr();
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

type View = "meals" | "water";

export const HistoryTab = () => {
  const today = toDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<View>("meals");
  const MEAL_TYPE_ORDER: MealType[] = [
    "breakfast",
    "brunch",
    "lunch",
    "dinner",
    "snack",
  ];

  const shiftDate = (days: number) => {
    const next = toDateStr(
      new Date(new Date(selectedDate).getTime() + days * 86400000),
    );
    if (next > today) {
      toast.message("You cannot view history from the future");
      return;
    }
    setSelectedDate(next);
  };

  const { data: logs, isLoading: mealsLoading } = useQuery({
    queryKey: ["meal-logs", selectedDate],
    queryFn: async () => {
      const { data } = await api.get<
        ApiResponse<{ logs: MealLogEntry[]; date: string }>
      >(`/api/meal-logs?date=${selectedDate}`);
      return data.data.logs;
    },
    staleTime: 30 * 1000,
  });

  const { data: water, isLoading: waterLoading } = useQuery({
    queryKey: ["water", selectedDate],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<WaterData>>(
        `/api/water?date=${selectedDate}`,
      );
      return data.data;
    },
    staleTime: 30 * 1000,
  });

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => shiftDate(-1)}
          aria-label="Previous day"
          className="w-8 h-8 rounded-full flex items-center justify-center
            text-cocoa dark:text-dark-white hover:bg-cocoa/5 dark:hover:bg-dark-white/5"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="relative">
          <span
            className="text-sm font-bold text-cocoa dark:text-dark-white
              underline decoration-dotted underline-offset-4 pointer-events-none"
          >
            {formatLabel(selectedDate)}
          </span>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value);
            }}
            aria-label="Choose date"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <button
          onClick={() => shiftDate(1)}
          aria-label="Next day"
          disabled={selectedDate === today}
          className="w-8 h-8 rounded-full flex items-center justify-center
            text-cocoa dark:text-dark-white hover:bg-cocoa/5 dark:hover:bg-dark-white/5
            disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mb-4">
        <SlidingTabs
          tabs={[
            { key: "meals" as const, label: "Meals" },
            { key: "water" as const, label: "Water" },
          ]}
          active={view}
          onChange={setView}
          fitWidth
        />
      </div>

      {view === "meals" ? (
        <div className="space-y-2">
          {mealsLoading && (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-cocoa/10 dark:bg-dark-white/10 animate-pulse"
                />
              ))}
            </div>
          )}
          {!mealsLoading && (!logs || logs.length === 0) && (
            <p className="text-sm text-cocoa-faded text-center py-8">
              No meals logged on this day
            </p>
          )}
          {MEAL_TYPE_ORDER.map((type) => {
            const entries = (logs ?? []).filter((l) => l.meal_type === type);
            if (entries.length === 0) return null;

            return (
              <div key={type} className="mb-4 last:mb-0">
                <p className="text-xs font-semibold text-cocoa/70 dark:text-dark-white/60 uppercase tracking-wide mb-2">
                  {type}
                </p>
                <div className="space-y-2">
                  {entries.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 px-4 py-3
    rounded-xl bg-cocoa/5 dark:bg-dark-white/5
    border border-cocoa/5 dark:border-dark-white/5"
                    >
                      <div className="w-[50px] h-[50px] lg:w-[70px] lg:h-[70px] rounded-lg overflow-hidden shrink-0 bg-cocoa/8 dark:bg-dark-white/8 flex items-center justify-center">
                        {log.image_url ? (
                          <img
                            src={toThumbnail(log.image_url)}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UtensilsCrossed
                            size={30}
                            className="text-cocoa-faded mx-2"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-cocoa dark:text-dark-white truncate">
                          {log.food_name ?? log.custom_name}
                        </p>
                        <p className="text-[11px] text-cocoa-faded">
                          {log.quantity_grams}g · {Math.round(log.calories)}{" "}
                          kcal
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          {waterLoading && (
            <div className="h-14 rounded-xl bg-cocoa/10 dark:bg-dark-white/10 animate-pulse" />
          )}
          {!waterLoading && (
            <>
              <p className="text-xs text-cocoa-faded mb-2">
                {water?.daily_total ?? 0}ml logged
                {water?.target_ml ? ` of ${water.target_ml}ml target` : ""}
              </p>
              {water && water.logs.length > 0 ? (
                <WaterLogList
                  logs={water.logs}
                  editable={selectedDate === today}
                />
              ) : (
                <p className="text-sm text-cocoa-faded text-center py-8">
                  No water logged on this day
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
