import { useQuery } from "@tanstack/react-query";
import { CalorieProgressBar } from "./CalorieProgressBar";
import { WaterCups } from "./WaterCups";
import type {
  StreakData,
  DashboardData,
  WaterData,
  ApiResponse,
  MealLogEntry,
} from "@/types/apiTypes";
import api from "@/lib/api";

interface StreakPanelProps {
  streakData: StreakData | undefined;
  dashData: DashboardData | undefined;
  waterData: WaterData | undefined;
}

/*
  Right panel: fire streak card + water streak card.
  Fire icon: shows flame emoji if streak active, dimmed circle if not.
  Status badge: "Not started" (no bg), "On-going" (moringa-faded filled), "Ended" (rose-500).
  Calorie progress bar with segmented meal types.
  Water cups display (desktop only).
*/

const StatusBadge = ({
  status,
}: {
  status: "not_started" | "ongoing" | "ended";
}) => {
  if (status === "not_started") {
    return (
      <span className="text-[10px] font-medium text-cocoa-faded">
        Not started
      </span>
    );
  }
  if (status === "ongoing") {
    return (
      <span
        className="text-[10px] font-semibold text-surface
        bg-moringa-faded px-2 py-0.5 rounded-full flex items-center gap-1"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-surface" />
        On-going
      </span>
    );
  }
  return (
    <span
      className="text-[10px] font-semibold text-surface
      bg-rose-500 px-2 py-0.5 rounded-full"
    >
      Ended
    </span>
  );
};

const getGoalStatus = (streak: StreakData | undefined) => {
  if (!streak) return "not_started";
  if (streak.goal_streak > 0) return "ongoing";
  if (streak.goal_streak_best > 0) return "ended";
  return "not_started";
};

const getWaterStatus = (streak: StreakData | undefined) => {
  if (!streak) return "not_started";
  if (streak.water_streak > 0) return "ongoing";
  if (streak.water_streak_best > 0) return "ended";
  return "not_started";
};

export const StreakPanel = ({
  streakData,
  dashData,
  waterData,
}: StreakPanelProps) => {
  const { data: logs } = useQuery({
    queryKey: ["meal-logs", "today"],
    queryFn: async () => {
      const { data } =
        await api.get<ApiResponse<{ logs: MealLogEntry[]; date: string }>>(
          "/api/meal-logs",
        );
      return data.data.logs;
    },
    staleTime: 30 * 1000,
  });

  const goalStatus = getGoalStatus(streakData);
  const waterStatus = getWaterStatus(streakData);

  return (
    <div className="flex flex-col gap-4">
      {/* Today's intake label — desktop right panel */}
      <p className="text-xs text-cocoa-faded">
        Today's intake{" "}
        <span className="text-[10px]">
          (80% progress will activate streak for the day)
        </span>
      </p>

      {/* Fire streak card */}
      <div className="bg-surface dark:bg-black-surface rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Fire icon or dimmed circle */}
            <div
              className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30
              flex items-center justify-center"
            >
              {goalStatus === "ongoing" ? (
                <span className="text-xl">🔥</span>
              ) : (
                <span className="text-xl grayscale opacity-40">🔥</span>
              )}
            </div>
            <div>
              <p className="text-xs text-cocoa-faded">Streaks</p>
              <p className="font-heading font-bold text-lg text-cocoa dark:text-dark-white">
                {goalStatus !== "not_started"
                  ? `${(() => {
                      const n = streakData?.goal_streak ?? 0;
                      return `${n} ${n === 1 ? "day" : "days"}`;
                    })()}`
                  : "No streak"}
              </p>
            </div>
          </div>
          <StatusBadge status={goalStatus} />
        </div>

        <CalorieProgressBar
          logs={logs ?? []}
          calorieTarget={dashData?.calorie_target ?? 0}
          calorieTotal={dashData?.daily_totals.calories ?? 0}
        />
      </div>

      {/* Water streak card */}
      <div className="bg-surface dark:bg-black-surface rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30
              flex items-center justify-center"
            >
              {waterStatus === "ongoing" ? (
                <span className="text-xl">💧</span>
              ) : (
                <span className="text-xl grayscale opacity-40">💧</span>
              )}
            </div>
            <div>
              <p className="text-xs text-cocoa-faded">Water</p>
              <p className="font-heading font-bold text-lg text-cocoa dark:text-dark-white">
                {waterStatus !== "not_started"
                  ? `${(() => {
                      const n = streakData?.water_streak ?? 0;
                      return `${n} ${n === 1 ? "day" : "days"}`;
                    })()}`
                  : "No streak"}
              </p>
            </div>
          </div>
          <StatusBadge status={waterStatus} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-cocoa dark:text-dark-white">
              Hydration level
            </span>
            <span className="text-xs font-semibold text-cocoa dark:text-dark-white">
              {waterData?.daily_total ?? 0}
              <span className="text-cocoa-faded font-normal">
                /{waterData?.target_ml ?? 0}ml
              </span>
            </span>
          </div>

          {/* Water cups */}
          <WaterCups
            entries={waterData?.logs ?? []}
            targetMl={waterData?.target_ml ?? 0}
            dailyTotal={waterData?.daily_total ?? 0}
          />
        </div>
      </div>
    </div>
  );
};
