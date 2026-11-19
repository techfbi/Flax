/*
  Client copy of server/src/shared/calculations.ts, used by the public
  calorie calculator so it gives exactly the numbers the app assigns at
  onboarding. If the server formulas change, change these to match.
*/

export type BiologicalSex = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extremely_active";

export type HealthGoal =
  | "weight_loss"
  | "muscle_gain"
  | "weight_gain"
  | "maintenance"
  | "general_health";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

export const GOAL_ADJUSTMENTS: Record<HealthGoal, number> = {
  weight_loss: -500,
  muscle_gain: +300,
  weight_gain: +500,
  maintenance: 0,
  general_health: 0,
};

export const WATER_BASE_ML: Record<BiologicalSex, number> = { male: 3000, female: 2200 };

export const WATER_ACTIVITY_ADDITIONS: Record<ActivityLevel, number> = {
  sedentary: 0,
  lightly_active: 300,
  moderately_active: 500,
  very_active: 700,
  extremely_active: 1000,
};

// Same labels and descriptions the onboarding flow shows.
export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: "sedentary", label: "Sedentary", description: "Sit a lot, move a little" },
  { value: "lightly_active", label: "Lightly active", description: "Desk job, but I walk" },
  { value: "moderately_active", label: "Moderately active", description: "I exercise + stay busy" },
  { value: "very_active", label: "Very active", description: "Physical job and I train hard" },
  { value: "extremely_active", label: "Extremely active", description: "Move all day, train 2x/day" },
];

export const GOAL_OPTIONS: { value: HealthGoal; label: string }[] = [
  { value: "weight_loss", label: "Lose weight" },
  { value: "muscle_gain", label: "Gain muscle" },
  { value: "weight_gain", label: "Gain weight" },
  { value: "maintenance", label: "Stay the same" },
  { value: "general_health", label: "Eat better generally" },
];

/** Mifflin-St Jeor basal metabolic rate, kcal per day. */
export const calculateBmr = (
  sex: BiologicalSex,
  weightKg: number,
  heightCm: number,
  age: number,
): number =>
  sex === "male"
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

/** Identical to the server's calculateCaloricTarget for an exact age. */
export const calculateCaloricTarget = (
  sex: BiologicalSex,
  weightKg: number,
  heightCm: number,
  age: number,
  activity: ActivityLevel,
  goal: HealthGoal,
): number => {
  const tdee = calculateBmr(sex, weightKg, heightCm, age) * ACTIVITY_MULTIPLIERS[activity];
  return Math.round((tdee + GOAL_ADJUSTMENTS[goal]) / 50) * 50;
};

export const calculateMaintenance = (
  sex: BiologicalSex,
  weightKg: number,
  heightCm: number,
  age: number,
  activity: ActivityLevel,
): number =>
  Math.round((calculateBmr(sex, weightKg, heightCm, age) * ACTIVITY_MULTIPLIERS[activity]) / 50) * 50;

/** Identical to the server's calculateWaterTarget. */
export const calculateWaterTarget = (sex: BiologicalSex, activity: ActivityLevel): number =>
  WATER_BASE_ML[sex] + WATER_ACTIVITY_ADDITIONS[activity];
