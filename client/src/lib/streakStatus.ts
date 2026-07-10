import type { StreakData } from "@/types/apiTypes";

export type SimpleStreakStatus = "not_started" | "ongoing" | "restorable" | "ended";

export const getGoalStatus = (streak: StreakData | undefined): SimpleStreakStatus => {
  if (!streak) return "not_started";
  if (streak.goal_streak_status === "restorable") return "restorable";
  if (streak.goal_streak > 0) return "ongoing";
  if (streak.goal_streak_best > 0) return "ended";
  return "not_started";
};

export const getWaterStatus = (streak: StreakData | undefined): SimpleStreakStatus => {
  if (!streak) return "not_started";
  if (streak.water_streak_status === "restorable") return "restorable";
  if (streak.water_streak > 0) return "ongoing";
  if (streak.water_streak_best > 0) return "ended";
  return "not_started";
};

