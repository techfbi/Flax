import { useQuery } from "@tanstack/react-query";
import { CalorieChart } from "./CalorieChart";
import { HydrationSection } from "./HydrationSection";
import api from "@/lib/api";
import type {
  ApiResponse,
  MealLogEntry,
  DashboardData,
  WaterData,
} from "@/types/apiTypes";
import { useTheme } from "@/context/ThemeContext";

interface GoalTabProps {
  dashData: DashboardData | undefined;
  dashLoading: boolean;
  waterData: WaterData | undefined;
  onRefetchWater: () => void;
  onLogMealClick: () => void;
}

/*
  Goal tab content.
  Shows today's calorie overview, the multi-line area chart, and hydration section.
  "Log meal" button navigates to the log meal tab.
*/
export const GoalTab = ({
  dashData,
  dashLoading,
  waterData,
  onRefetchWater,
  onLogMealClick,
}: GoalTabProps) => {
  const { resolvedTheme } = useTheme();
  const COLORS = {
    Calorie: "#7FB096",
    Protein: "#F43F5E",
    Carbs: resolvedTheme === "dark" ? "#FFF176" : "#949494",
    Fat: "#F59E0B",
  };

  const legend = [
    { label: "Calorie", color: COLORS.Calorie },
    { label: "Carbs", color: COLORS.Carbs },
    { label: "Fat", color: COLORS.Fat },
    { label: "Protein", color: COLORS.Protein },
  ];

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

  const calTarget = dashData?.calorie_target ?? 0;
  const calTotal = dashData?.daily_totals.calories ?? 0;
  const remaining = Math.max(0, calTarget - calTotal);
  const excess =
    calTotal > calTarget && calTarget > 0
      ? Number((calTotal - calTarget).toFixed(2))
      : 0;

  return (
    <div className="p-5 space-y-1 lg:space-y-6">
      {/* TODAY label */}
      <p
        className="text-xs lg:text-sm font-semibold uppercase tracking-wide
        text-cocoa/50 dark:text-dark-white/40"
      >
        Today
      </p>

      {/* Calorie header */}
      <div>
        <div className="flex items-center justify-between mb-2 lg:justify-start lg:gap-10">
          <h2 className="font-heading text-[16px] md:text-[1rem] lg:text-xl font-bold text-cocoa dark:text-dark-white">
            Calorie
          </h2>
          <button
            onClick={onLogMealClick}
            className="px-2 py-0.5 rounded-md bg-moringa dark:bg-moringa-faded
              text-surface text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Log meal
          </button>
        </div>

        <div className="space-y-1 md:flex md:flex-wrap md:items-center md:justify-between md:gap-[2px] lg:justify-start lg:gap-7 lg:flex-nowrap lg:shrink-1">
          <p className=" w-fit shrink-0 font-heading text-xs lg:text-sm text-cocoa/60 dark:text-dark-white/60">
            Daily Target:{" "}
            {dashLoading && !dashData ? (
              <span className="inline-block w-14 h-3.5 rounded bg-cocoa/10 dark:bg-dark-white/10 animate-pulse align-middle" />
            ) : (
              <span className="font-body font-bold text-pawpaw dark:text-black-pawpaw/80 text-[0.9rem] md:text-[1rem] ">
                {calTarget.toLocaleString()} kcal
              </span>
            )}
          </p>

          <p className=" w-fit flex gap-1 shrink-1 font-heading text-xs lg:text-sm text-cocoa/60 dark:text-dark-white/60">
            Remaining:{" "}
            <span className="font-body font-semibold text-cocoa dark:text-dark-white">
              {remaining.toLocaleString()} kcal
            </span>
          </p>
          {excess > 0 && (
            <span
              className=" w-fit shrink-0 font-heading inline-block mt-1 text-xs font-medium text-rose-500
            bg-rose-500/10 px-2 py-0.5 rounded-md"
            >
              Excess: {excess} kcal
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <CalorieChart logs={logs ?? []} />

      <div className="flex items-center justify-center gap-3 text-[10px]">
        {legend.map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-cocoa/60 dark:text-dark-white/60">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Hydration */}
      <HydrationSection waterData={waterData} onRefetch={onRefetchWater} />
    </div>
  );
};
