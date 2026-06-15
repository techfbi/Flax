// ---------------------------------------------------------------------------
// Mifflin-St Jeor BMR(Basal Metabolic Rate) equation. current gold standard for estimating
// basal metabolic rate. More accurate than Harris-Benedict for most adults.
// ---------------------------------------------------------------------------

export type BiologicalSex = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extremely_active";

// Activity multipliers from the Mifflin-St Jeor TDEE model.
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary:          1.2,
  lightly_active:     1.375,
  moderately_active:  1.55,
  very_active:        1.725,
  extremely_active:   1.9,
};

// Calorie adjustments per health goal applied on top of TDEE(Total Daily Energy Expenditure).
// weight_loss targets approximately 0.5kg per week deficit.
// muscle_gain uses a conservative lean bulk surplus.
// maintenance and general_health use TDEE as is.
const GOAL_ADJUSTMENTS: Record<string, number> = {
  weight_loss: -500,
  muscle_gain: +300,
  weight_gain: +500,
  maintenance: 0,
  general_health: 0,
};

// ---------------------------------------------------------------------------
// calculateCaloricTarget
// Returns the recommended daily calorie intake in kcal.
// All inputs are required for calculation. if any are missing the caller
// should not call this function and leave calorie_target as null.
// ---------------------------------------------------------------------------
export const calculateCaloricTarget = (
  biologicalSex: BiologicalSex,
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: ActivityLevel,
  healthGoal: string | null
): number => {
  const bmr =
    biologicalSex === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];
  const goalAdjustment = GOAL_ADJUSTMENTS[healthGoal ?? ""] ?? 0;

  // Round to nearest 50 kcal for a clean display value.
  return Math.round((tdee + goalAdjustment) / 50) * 50;
};

// ---------------------------------------------------------------------------
// calculateWaterTarget Returns recommended daily water intake in millilitres.
// Based on National Academies of Sciences guidance:
//   male adults:   3000ml drinking target
//   female adults: 2200ml drinking target
// Adjusted upward for activity level since sweat increases fluid needs.
// Users can override this at the UI. this is the scientifically backed default.
// ---------------------------------------------------------------------------
const WATER_ACTIVITY_ADDITIONS: Record<ActivityLevel, number> = {
  sedentary:         0,
  lightly_active:  300,
  moderately_active: 500,
  very_active:     700,
  extremely_active: 1000,
};

export const calculateWaterTarget = (
  biologicalSex: BiologicalSex,
  activityLevel: ActivityLevel
): number => {
  const base = biologicalSex === "male" ? 3000 : 2200;
  return base + WATER_ACTIVITY_ADDITIONS[activityLevel];
};