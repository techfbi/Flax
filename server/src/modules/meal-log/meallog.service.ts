import { pgPool } from "../../config/db.postgres.js";
import { FoodItem } from "../../models/food.model.js";
import { AppError } from "../../shared/errors.js";
import type { CatalogueMealLogInput, CustomMealLogInput } from "./meallog.schema.js";
import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface MealLogEntry {
  id: string;
  food_ref: string | null;
  food_name: string | null;
  custom_name: string | null;
  quantity_grams: number;
  meal_type: string;
  logged_date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: string;
  created_at: string;
}

export interface DashboardData {
  date: string;
  daily_totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  by_meal_type: Record<
    string,
    { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  >;
  calorie_target: number | null;
  weekly_trend: Array<{ date: string; calories: number }>;
  log_count: number;
}

// ---------------------------------------------------------------------------
// createCatalogueMealLog
// Looks up the food in MongoDB to get accurate per-100g nutrition values,
// calculates actual nutrition for the quantity eaten, and stores the result. The user cannot supply or override nutrition values on this path.
// ---------------------------------------------------------------------------
export const createCatalogueMealLog = async (
  userId: string,
  input: CatalogueMealLogInput
): Promise<MealLogEntry> => {
  const food = await FoodItem.findById(new mongoose.Types.ObjectId(input.food_ref))
    .select("name calories_per_100g protein_g carbs_g fat_g is_verified")
    .lean();

  if (!food) {
    throw new AppError(
      "Food item not found. Please select a valid meal from the catalogue.",
      404,
      "FOOD_NOT_FOUND"
    );
  }

  if (!food.is_verified) {
    throw new AppError(
      "This food item is not yet available. Please select another meal.",
      400,
      "FOOD_NOT_VERIFIED"
    );
  }

  // Scale per-100g values to the actual portion size.
  // Round to 2 decimal places for clean display values.
  const factor = input.quantity_grams / 100;
  const calories  = Math.round(food.calories_per_100g * factor * 100) / 100;
  const protein_g = Math.round(food.protein_g * factor * 100) / 100;
  const carbs_g   = Math.round(food.carbs_g * factor * 100) / 100;
  const fat_g     = Math.round(food.fat_g * factor * 100) / 100;

  const result = await pgPool.query(
    `INSERT INTO meal_logs
       (user_id, food_ref, food_name, custom_name, quantity_grams,
        meal_type, logged_date, calories, protein_g, carbs_g, fat_g, source)
     VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, 'catalogue')
     RETURNING
       id, food_ref, food_name, custom_name, quantity_grams, meal_type,
       logged_date, calories, protein_g, carbs_g, fat_g, source, created_at`,
    [
      userId,
      input.food_ref,
      food.name, // instead of trusting the client to send the correct food_name, we take it from MongoDB to ensure consistency and prevent tampering
      input.quantity_grams,
      input.meal_type,
      input.logged_date,
      calories,
      protein_g,
      carbs_g,
      fat_g,
    ]
  );

  console.log(
    `[REMOVE LOG LATER] Catalogue meal logged. user. ${userId}. food. ${input.food_name}. ` +
    `quantity. ${input.quantity_grams}g. calories. ${calories}`
  );

  return result.rows[0];
};

// ---------------------------------------------------------------------------
// createCustomMealLog
// Logs a meal not in the catalogue. The user provides the name and optionally per-100g nutrition values. If nutrition is not provided,
// values are stored as 0 and the log is nutritionally untracked. math sill remains consistent
// ---------------------------------------------------------------------------
export const createCustomMealLog = async (
  userId: string,
  input: CustomMealLogInput
): Promise<MealLogEntry> => {
  // Apply the same scaling formula as catalogue logs.
  const factor = input.quantity_grams / 100;
  const calories  = Math.round(input.calories_per_100g * factor * 100) / 100;
  const protein_g = Math.round(input.protein_g * factor * 100) / 100;
  const carbs_g   = Math.round(input.carbs_g * factor * 100) / 100;
  const fat_g     = Math.round(input.fat_g * factor * 100) / 100;

  const result = await pgPool.query(
    `INSERT INTO meal_logs
       (user_id, food_ref, food_name, custom_name, quantity_grams,
        meal_type, logged_date, calories, protein_g, carbs_g, fat_g, source)
     VALUES ($1, NULL, NULL, $2, $3, $4, $5, $6, $7, $8, $9, 'custom')
     RETURNING
       id, food_ref, food_name, custom_name, quantity_grams, meal_type,
       logged_date, calories, protein_g, carbs_g, fat_g, source, created_at`,
    [
      userId,
      input.custom_name,
      input.quantity_grams,
      input.meal_type,
      input.logged_date,
      calories,
      protein_g,
      carbs_g,
      fat_g,
    ]
  );

  console.log(
    `[REMOVE LOG LATER] Custom meal logged. user. ${userId}. name. ${input.custom_name}. ` +
    `quantity. ${input.quantity_grams}g. calories. ${calories}`
  );

  return result.rows[0];
};

// ---------------------------------------------------------------------------
// getMealLogs
// Returns all logs for a user on a specific date. Ordered by created_at.
// Returns both catalogue and custom logs. caller handles display differences.
// ---------------------------------------------------------------------------
export const getMealLogs = async (
  userId: string,
  date?: string
): Promise<MealLogEntry[]> => {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  const result = await pgPool.query(
    `SELECT
       id, food_ref, food_name, custom_name, quantity_grams, meal_type,
       logged_date, calories, protein_g, carbs_g, fat_g, source, created_at
     FROM meal_logs
     WHERE user_id = $1
       AND logged_date = $2
     ORDER BY created_at ASC`,
    [userId, targetDate]
  );

  return result.rows;
};

// ---------------------------------------------------------------------------
// deleteMealLog
// Deletes a log entry. user_id in WHERE clause prevents cross-user deletion.
// ---------------------------------------------------------------------------
export const deleteMealLog = async (
  userId: string,
  logId: string
): Promise<void> => {
  const result = await pgPool.query(
    "DELETE FROM meal_logs WHERE id = $1 AND user_id = $2",
    [logId, userId]
  );

  if (result.rowCount === 0) {
    throw new AppError("Meal log not found", 404, "LOG_NOT_FOUND");
  }

  console.log(
    `[REMOVE LOG LATER] Meal log deleted. user. ${userId}. logId. ${logId}`
  );
};

// ---------------------------------------------------------------------------
// getDashboardData
// All aggregation runs against PostgreSQL only. No MongoDB involvement.
// Works identically for catalogue and custom logs since nutrition values
// are denormalised into meal_logs regardless of source.
// ---------------------------------------------------------------------------
export const getDashboardData = async (
  userId: string,
  date?: string
): Promise<DashboardData> => {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  // Daily totals and log count, coalesce returns 0 if SUM() is null.
  const totalsResult = await pgPool.query(
    `SELECT
       COALESCE(SUM(calories), 0)  AS calories,
       COALESCE(SUM(protein_g), 0) AS protein_g,
       COALESCE(SUM(carbs_g), 0)   AS carbs_g,
       COALESCE(SUM(fat_g), 0)     AS fat_g,
       COUNT(*)                     AS log_count
     FROM meal_logs
     WHERE user_id = $1
       AND logged_date = $2`,
    [userId, targetDate]
  );

  const totals = totalsResult.rows[0];

  // Breakdown by meal type
  const byTypeResult = await pgPool.query(
    `SELECT
       meal_type,
       COALESCE(SUM(calories), 0)  AS calories,
       COALESCE(SUM(protein_g), 0) AS protein_g,
       COALESCE(SUM(carbs_g), 0)   AS carbs_g,
       COALESCE(SUM(fat_g), 0)     AS fat_g
     FROM meal_logs
     WHERE user_id = $1
       AND logged_date = $2
     GROUP BY meal_type`,
    [userId, targetDate]
  );

  const byMealType: DashboardData["by_meal_type"] = {};
  for (const row of byTypeResult.rows) {
    byMealType[row.meal_type] = {
      calories:  parseFloat(row.calories),
      protein_g: parseFloat(row.protein_g),
      carbs_g:   parseFloat(row.carbs_g),
      fat_g:     parseFloat(row.fat_g),
    };
  }

  // User calorie target from health profile
  const targetResult = await pgPool.query(
    "SELECT calorie_target FROM health_profiles WHERE user_id = $1",
    [userId]
  );

  const calorieTarget = targetResult.rows[0]?.calorie_target ?? null;

  // 7-day trend. generate_series guarantees exactly 7 data points
  // even on days with no logs by using LEFT JOIN.
  const weeklyResult = await pgPool.query(
    `SELECT
       TO_CHAR(dates.day, 'YYYY-MM-DD') AS date,
       COALESCE(SUM(ml.calories), 0)    AS calories
     FROM generate_series(
       $2::date - INTERVAL '6 days',
       $2::date,
       INTERVAL '1 day'
     ) AS dates(day)
     LEFT JOIN meal_logs ml
       ON ml.logged_date = dates.day
       AND ml.user_id = $1
     GROUP BY dates.day
     ORDER BY dates.day ASC`,
    [userId, targetDate]
  );

  return {
    date: targetDate,
    daily_totals: {
      calories:  parseFloat(totals.calories),
      protein_g: parseFloat(totals.protein_g),
      carbs_g:   parseFloat(totals.carbs_g),
      fat_g:     parseFloat(totals.fat_g),
    },
    by_meal_type: byMealType,
    calorie_target: calorieTarget,
    weekly_trend: weeklyResult.rows.map((r) => ({
      date:     r.date,
      calories: parseFloat(r.calories),
    })),
    log_count: parseInt(totals.log_count, 10),
  };
};