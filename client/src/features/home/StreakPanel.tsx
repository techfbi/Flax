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
        bg-moringa-faded px-2 py-0.5 rounded-md flex items-center gap-1"
      >
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
    <div className="flex flex-col gap-2">
      {/* Today's intake label, desktop right panel */}
      <p className="font-heading md:text-[12px] lg:text-[14px] pl-2 text-cocoa-faded">
        80% progress will activate streak for the day
      </p>

      {/* Fire streak card */}
      <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Fire icon */}

            {goalStatus === "ongoing" ? (
              <span className="text-xl">
                <img
                  src="/images/fire.png"
                  alt="fire"
                  className="object-contain w-[30px] flex"
                />
              </span>
            ) : (
              <span className="text-xl grayscale opacity-30">🔥</span>
            )}

            <div>
              <p className="font-heading md:font-medium lg:font-semibold text-xs text-cocoa-faded">
                Streaks
              </p>
              <p className="font-heading font-bold md:text-[0.9rem] lg:text-lg text-cocoa dark:text-dark-white">
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
          //calorieTotal={dashData?.daily_totals.calories ?? 0}
        />
      </div>

      {/* Water streak card */}
      <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {waterStatus === "ongoing" ? (
              <span className="text-[1.3rem]">💧</span>
            ) : (
              <span className="text-xl grayscale opacity-30">💧</span>
            )}

            <div>
              <p className="font-heading md:font-medium lg:font-semibold  text-xs text-cocoa-faded">
                Water
              </p>
              <p className="font-heading font-bold md:text-[0.9rem] lg:text-lg text-cocoa dark:text-dark-white">
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
          <div className="flex items-center justify-between ">
            <span className="text-xs lg:text-sm md:font-medium lg:font-semibold text-cocoa dark:text-dark-white">
              Hydration level
            </span>
            <span className="text-xs font-semibold text-cocoa dark:text-dark-white">
              {waterData?.daily_total ?? 0}{" "}
              <span className="text-cocoa-faded text-xs font-normal">
                / {waterData?.target_ml ?? 0}ml
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
