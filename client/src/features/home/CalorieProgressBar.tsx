import type { MealLogEntry } from "@/types/apiTypes";

interface CalorieProgressBarProps {
  logs: MealLogEntry[];
  calorieTarget: number;
  calorieTotal: number;
}

/*
  Segmented calorie progress bar.
  Each meal type that has been logged gets a segment.
  Segments are sized proportionally to their calorie contribution.
  They appear in the order the meal types were first logged.
  A visual gap separates each segment.
  Meal type label shown below each segment.
  Percentage shown top right.

  Logic:
  1. Group logs by meal_type in order of first occurrence.
  2. Sum calories per meal_type.
  3. Each segment width = (mealTypeCalories / calorieTarget) * 100%.
  4. Cap total at 100%.
*/
const SEGMENT_COLORS = [
  "#E8623C", // pawpaw
  "#D4522E", // black-pawpaw
  "#2F5D4B", // moringa
  "#7FB096", // moringa-faded
  "#F59E0B", // amber
];

export const CalorieProgressBar = ({
  logs,
  calorieTarget,
  calorieTotal,
}: CalorieProgressBarProps) => {
  if (!calorieTarget) return null;

  /* Group by meal type, preserving order of first occurrence */
  const ordered: string[] = [];
  const grouped: Record<string, number> = {};

  logs.forEach((log) => {
    if (!grouped[log.meal_type]) {
      ordered.push(log.meal_type);
      grouped[log.meal_type] = 0;
    }
    grouped[log.meal_type] += log.calories;
  });

  const pct = Math.min(100, Math.round((calorieTotal / calorieTarget) * 100));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-cocoa dark:text-dark-white">
          Calorie progress
        </span>
        <span className="text-xs font-bold text-cocoa dark:text-dark-white">
          {pct}%
        </span>
      </div>

      {/* Segmented bar */}
      <div
        className="flex gap-0.5 h-2 rounded-full overflow-hidden
        bg-cocoa/10 dark:bg-dark-white/10"
      >
        {ordered.map((mealType, i) => {
          const segPct = Math.min(
            100,
            ((grouped[mealType] ?? 0) / calorieTarget) * 100,
          );
          return (
            <div
              key={mealType}
              style={{
                width: `${segPct}%`,
                backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
              }}
              className="h-full transition-all duration-500"
            />
          );
        })}
      </div>

      {/* Labels below */}
      <div className="flex gap-0.5 mt-1">
        {ordered.map((mealType) => {
          const segPct = Math.min(
            100,
            ((grouped[mealType] ?? 0) / calorieTarget) * 100,
          );
          return (
            <div
              key={mealType}
              style={{ width: `${segPct}%` }}
              className="text-[9px] text-cocoa-faded truncate"
            >
              {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
