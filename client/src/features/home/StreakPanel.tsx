import { useQuery } from "@tanstack/react-query";
import { CalorieProgressBar } from "./CalorieProgressBar";
import { WaterCups } from "./WaterCups";
import { getGoalStatus, getWaterStatus } from "@/lib/streakStatus";
import { useStreakRestore } from "@/hooks/useStreakRestore";
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
  Status badge: "Not started" (no bg), "On-going" (moringa-faded
  filled), "Ended" (rose-500), "Restore?" (clickable, replaces Ended
  for the 24 hour window a broken streak can still be brought back).
*/

const StatusBadge = ({
  status,
  onRestore,
  isRestoring,
}: {
  status: "not_started" | "ongoing" | "restorable" | "ended";
  onRestore?: () => void;
  isRestoring?: boolean;
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
      <span className="text-[10px] font-semibold text-surface bg-moringa-faded px-2 py-0.5 rounded-md flex items-center gap-1">
        On-going
      </span>
    );
  }
  if (status === "restorable") {
    return (
      <button
        onClick={onRestore}
        disabled={isRestoring}
        className="text-[10px] font-semibold text-rose-500 underline decoration-dotted disabled:opacity-50"
      >
        {isRestoring ? "Restoring..." : "Restore?"}
      </button>
    );
  }
  return (
    <span className="text-[10px] font-semibold text-surface bg-rose-500 px-2 py-0.5 rounded-full">
      Ended
    </span>
  );
};

export const StreakPanel = ({
  streakData,
  dashData,
  waterData,
}: StreakPanelProps) => {
  const restoreMutation = useStreakRestore();

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
      <p className="font-heading md:text-[12px] lg:text-[14px] pl-2 text-cocoa-faded">
        80% progress will activate streak for the day
      </p>

      {/* Fire streak card */}
      <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
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
                {goalStatus === "ongoing"
                  ? `${streakData?.goal_streak ?? 0} ${streakData?.goal_streak === 1 ? "day" : "days"}`
                  : "No streak"}
              </p>
            </div>
          </div>
          <StatusBadge
            status={goalStatus}
            onRestore={() => restoreMutation.mutate("goal")}
            isRestoring={
              restoreMutation.isPending && restoreMutation.variables === "goal"
            }
          />
        </div>

        <CalorieProgressBar
          logs={logs ?? []}
          calorieTarget={dashData?.calorie_target ?? 0}
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
              <p className="font-heading md:font-medium lg:font-semibold text-xs text-cocoa-faded">
                Water
              </p>
              <p className="font-heading font-bold md:text-[0.9rem] lg:text-lg text-cocoa dark:text-dark-white">
                {waterStatus === "ongoing"
                  ? `${streakData?.water_streak ?? 0} ${streakData?.water_streak === 1 ? "day" : "days"}`
                  : "No streak"}
              </p>
            </div>
          </div>
          <StatusBadge
            status={waterStatus}
            onRestore={() => restoreMutation.mutate("water")}
            isRestoring={
              restoreMutation.isPending && restoreMutation.variables === "water"
            }
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs lg:text-base md:font-medium lg:font-semibold text-cocoa dark:text-dark-white">
              Hydration level
            </span>
            <span className="text-xs font-semibold text-cocoa dark:text-dark-white">
              {waterData?.daily_total ?? 0}{" "}
              <span className="text-cocoa-faded text-xs font-normal">
                / {waterData?.target_ml ?? 0}ml
              </span>
            </span>
          </div>
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
