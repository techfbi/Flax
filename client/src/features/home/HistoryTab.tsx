import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { WaterLogList } from "./WaterLogList";
import api from "@/lib/api";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import type { ApiResponse, MealLogEntry, WaterData } from "@/types/apiTypes";

/*
  History tab. Meals and water logs, not bounded to 2 days, that limit
  belongs to spin history only. Left and right arrows step one day at
  a time, clicking the date label itself opens the native date picker
  so the user can jump straight to any day. Only the future is off
  limits.
*/

const toDateStr = (d: Date) => d.toISOString().split("T")[0];

const formatLabel = (dateStr: string) => {
  const today = toDateStr(new Date());
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
  const dateInputRef = useRef<HTMLInputElement>(null);

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

  // Clicking the date label opens the browser's native date picker,
  // which sits invisibly on top of the label. Picking a date there
  // updates selectedDate directly, no custom calendar UI to maintain.
  const openPicker = () => {
    if (dateInputRef.current?.showPicker) {
      dateInputRef.current.showPicker();
    } else {
      dateInputRef.current?.click();
    }
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
          <button
            onClick={openPicker}
            className="text-sm font-bold text-cocoa dark:text-dark-white
              underline decoration-dotted underline-offset-4"
          >
            {formatLabel(selectedDate)}
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value);
            }}
            className="absolute inset-0 opacity-0 pointer-events-none"
            tabIndex={-1}
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
          {logs?.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between px-4 py-3
                rounded-xl bg-cocoa/5 dark:bg-dark-white/5
                border border-cocoa/5 dark:border-dark-white/5"
            >
              <div>
                <p className="text-sm font-medium text-cocoa dark:text-dark-white">
                  {log.food_name ?? log.custom_name}
                </p>
                <p className="text-[11px] text-cocoa-faded capitalize">
                  {log.meal_type} · {log.quantity_grams}g ·{" "}
                  {Math.round(log.calories)} kcal
                </p>
              </div>
            </div>
          ))}
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
                <WaterLogList logs={water.logs} />
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
