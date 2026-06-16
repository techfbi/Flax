// ---------------------------------------------------------------------------
// Mifflin-St Jeor BMR(Basal Metabolic Rate) equation. current gold standard for estimating
// basal metabolic rate. More accurate than Harris-Benedict for most adults.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Age range to midpoint mapping. Used during onboarding to avoid asking users for exact age.
// ---------------------------------------------------------------------------
export type AgeRange =
  | "18-24"
  | "25-34"
  | "35-44"
  | "45-54"
  | "55-64"
  | "65+";

// Midpoints are representative values for the Mifflin-St Jeor formula.
const AGE_RANGE_MIDPOINTS: Record<AgeRange, number> = {
  "18-24": 21,
  "25-34": 29,
  "35-44": 39,
  "45-54": 49,
  "55-64": 59,
  "65+":   70,
};

export type BiologicalSex = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extremely_active";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary:            1.2,
  lightly_active:       1.375,
  moderately_active:    1.55,
  very_active:          1.725,
  extremely_active:     1.9,
};

const GOAL_ADJUSTMENTS: Record<string, number> = {
  weight_loss:    -500,
  muscle_gain:    +300,
  weight_gain:    +500,
  maintenance:      0,
  general_health:   0,
};

// ---------------------------------------------------------------------------
// calculateCaloricTarget
// Accepts either an exact age (number) or an age range string.
// During onboarding, age range is used. in profile settings, exact age
// can be provided for improved accuracy.
// ---------------------------------------------------------------------------
export const calculateCaloricTarget = (
  biologicalSex:  BiologicalSex,
  weightKg:       number,
  heightCm:       number,
  ageOrRange:     number | AgeRange,
  activityLevel:  ActivityLevel,
  healthGoal:     string | null
): number => {
  const age = typeof ageOrRange === "number"
    ? ageOrRange
    : AGE_RANGE_MIDPOINTS[ageOrRange];

  const bmr =
    biologicalSex === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const tdee           = bmr * ACTIVITY_MULTIPLIERS[activityLevel];
  const goalAdjustment = GOAL_ADJUSTMENTS[healthGoal ?? ""] ?? 0;

  return Math.round((tdee + goalAdjustment) / 50) * 50;
};

const WATER_ACTIVITY_ADDITIONS: Record<ActivityLevel, number> = {
  sedentary:          0,
  lightly_active:   300,
  moderately_active: 500,
  very_active:       700,
  extremely_active: 1000,
};

export const calculateWaterTarget = (
  biologicalSex: BiologicalSex,
  activityLevel: ActivityLevel
): number => {
  const base = biologicalSex === "male" ? 3000 : 2200;
  return base + WATER_ACTIVITY_ADDITIONS[activityLevel];
};