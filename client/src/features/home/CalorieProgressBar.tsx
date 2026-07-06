import type { MealLogEntry } from "@/types/apiTypes";
import { useMemo } from "react";

interface CalorieProgressBarProps {
  logs: MealLogEntry[];
  calorieTarget: number;
}

const MEAL_ORDER: Record<string, number> = {
  breakfast: 0,
  brunch: 1,
  lunch: 2,
  dinner: 3,
  snack: 4,
};

const MEAL_COLORS: Record<string, string> = {
  breakfast: "#E8623C",
  brunch: "#2F5D4B",
  lunch: "#D4522E",
  dinner: "#7FB096",
  snack: "#F59E0B",
};

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  brunch: "Brunch",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const CalorieProgressBar = ({
  logs,
  calorieTarget,
}: CalorieProgressBarProps) => {
  const { segments, totalPct, hasData } = useMemo(() => {
    // DEBUG: Log what we received
    // console.log("=== CalorieProgressBar useMemo ===");
    // console.log("logs received:", logs);
    // console.log("logs length:", logs?.length);
    // console.log("calorieTarget:", calorieTarget);

    // Guard: no target
    if (!calorieTarget || calorieTarget <= 0) {
      //console.log("Guard: no valid target");
      return { segments: [], totalPct: 0, hasData: false };
    }

    // Guard: no logs (safely handle null/undefined)
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      //console.log("Guard: no logs");
      return { segments: [], totalPct: 0, hasData: false };
    }

    // 1. Compute calorieTotal from logs
    //    DEFENSIVE: ensure calories are numbers
    let calorieTotal = 0;
    const validLogs: MealLogEntry[] = [];

    logs.forEach((log) => {
      const cal = Number(log.calories);
      if (!isNaN(cal) && cal > 0 && log.meal_type) {
        calorieTotal += cal;
        validLogs.push(log);
      } else {
        console.warn("Invalid log entry:", log);
      }
    });

    // console.log("validLogs count:", validLogs.length);
    // console.log("calorieTotal:", calorieTotal);

    if (calorieTotal === 0) {
      //console.log("Guard: calorieTotal is 0");
      return { segments: [], totalPct: 0, hasData: false };
    }

    // 2. Group calories by meal type
    const mealCalories: Record<string, number> = {};
    validLogs.forEach((log) => {
      const type = log.meal_type;
      if (MEAL_ORDER[type] !== undefined) {
        mealCalories[type] = (mealCalories[type] ?? 0) + Number(log.calories);
      }
    });

    //console.log("mealCalories:", mealCalories);

    // 3. Get all meal types with calories > 0
    const mealTypes = Object.keys(mealCalories).filter(
      (type) => mealCalories[type] > 0,
    );

    //console.log("mealTypes:", mealTypes);

    if (mealTypes.length === 0) {
      //console.log("Guard: no meal types");
      return { segments: [], totalPct: 0, hasData: false };
    }

    // 4. Sort by natural meal order
    mealTypes.sort((a, b) => (MEAL_ORDER[a] ?? 99) - (MEAL_ORDER[b] ?? 99));

    // 5. Calculate total percentage (capped at 100%)
    const totalPct = Math.min(100, (calorieTotal / calorieTarget) * 100);
    //console.log("totalPct:", totalPct);

    // 6. Calculate each segment's width
    //    Each segment = (mealCal / calorieTotal) * totalPct
    const segments = mealTypes.map((mealType) => {
      const cal = mealCalories[mealType] ?? 0;
      const widthPct = (cal / calorieTotal) * totalPct;
      return {
        mealType,
        widthPct: Math.max(0.5, widthPct),
        color: MEAL_COLORS[mealType] ?? "#CCCCCC",
        label: MEAL_LABELS[mealType] ?? mealType,
        calories: cal,
      };
    });

    // console.log(
    //   "segments:",
    //   segments.map((s) => `${s.mealType}: ${s.widthPct.toFixed(2)}%`),
    // );

    // 7. Fix floating-point drift
    let sum = segments.reduce((s, seg) => s + seg.widthPct, 0);
    if (Math.abs(sum - totalPct) > 0.001 && segments.length > 0) {
      const diff = totalPct - sum;
      const last = segments[segments.length - 1];
      last.widthPct = Math.max(0.5, last.widthPct + diff);
    }

    return {
      segments,
      totalPct,
      hasData: true,
    };
  }, [logs, calorieTarget]);

  // ----- RENDER -----
  if (!hasData) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs md:font-medium lg:font-semibold text-cocoa dark:text-dark-white">
            Calorie progress
          </span>
          <span className="text-xs font-bold text-cocoa dark:text-dark-white">
            0%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-cocoa/10 dark:bg-dark-white/10" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs lg:text-base md:font-medium lg:font-semibold text-cocoa dark:text-dark-white">
          Calorie progress
        </span>
        <span className="text-xs font-bold text-cocoa dark:text-dark-white">
          {Math.round(totalPct)}%
        </span>
      </div>

      <div className="relative h-2 w-full rounded-full overflow-hidden bg-cocoa/10 dark:bg-dark-white/10">
        <div className="flex h-full w-full">
          {segments.map((seg) => (
            <div
              key={seg.mealType}
              style={{
                width: `${seg.widthPct}%`,
                backgroundColor: seg.color,
                transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
              className="h-full shrink-0"
              title={`${seg.label}: ${Math.round(seg.calories)} kcal`}
            />
          ))}
          <div className="flex-1 h-full" />
        </div>
      </div>

      <div className="flex mt-1 w-full">
        {segments.map((seg) => (
          <div
            key={seg.mealType}
            style={{
              width: `${seg.widthPct}%`,
              minWidth: "12px",
            }}
            className="text-[9px] text-cocoa/60 dark:text-dark-white/50 truncate shrink-0 px-0.5 text-center"
          >
            {seg.label}
          </div>
        ))}
        <div className="flex-1" />
      </div>
    </div>
  );
};
