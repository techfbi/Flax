import { pgPool } from "../../config/db.postgres.js";
import { FoodItem } from "../../models/food.model.js";
import { AppError } from "../../shared/errors.js";
import type { CreateMealLogInput } from "./meallog.schema.js";
import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface MealLogEntry {
  id: string;
  food_ref: string;
  food_name: string;
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
// createMealLog
// Looks up the food item in MongoDB to get accurate nutrition values,
// calculates the actual nutrition for the quantity eaten, and stores the result in PostgreSQL with the values denormalised.
//
// WHY we denormalise nutrition values into the log row.
// If we only stored food_ref and quantity, every dashboard query would
// need to join to MongoDB for nutrition data across potentially hundreds of log entries. 
// By calculating and storing at log time, the dashboard query is a fast single PostgreSQL aggregation with no MongoDB involvement.
// ---------------------------------------------------------------------------
export const createMealLog = async (
  userId: string,
  input: CreateMealLogInput
): Promise<MealLogEntry> => {
  // ---------------------------------------------------------------------------
  // Step 1. fetch the food item from MongoDB to get nutrition per 100g
  // ---------------------------------------------------------------------------
  const food = await FoodItem.findById( new mongoose.Types.ObjectId(input.food_ref) )
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

  // ---------------------------------------------------------------------------
  // Step 2. calculate nutrition for the actual quantity eaten All nutrition values in the food catalogue are per 100g.
  // We scale them to the user's actual portion size. Round to 2 decimal places to keep values clean.
  // ---------------------------------------------------------------------------
  const factor = input.quantity_grams / 100;

  const calories = Math.round(food.calories_per_100g * factor * 100) / 100;
  const protein_g = Math.round(food.protein_g * factor * 100) / 100;
  const carbs_g = Math.round(food.carbs_g * factor * 100) / 100;
  const fat_g = Math.round(food.fat_g * factor * 100) / 100;

  // ---------------------------------------------------------------------------
  // Step 3. insert the log entry into PostgreSQL
  // ---------------------------------------------------------------------------
  const result = await pgPool.query(
    `INSERT INTO meal_logs
       (user_id, food_ref, food_name, quantity_grams, meal_type,
        logged_date, calories, protein_g, carbs_g, fat_g, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'catalogue')
     RETURNING
       id, food_ref, food_name, quantity_grams, meal_type,
       logged_date, calories, protein_g, carbs_g, fat_g, source, created_at`,
    [
      userId,
      input.food_ref,
      input.food_name,
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
    `[REMOVE LOG LATER] Meal logged. user. ${userId}. food. ${input.food_name}. ` +
    `quantity. ${input.quantity_grams}g. calories. ${calories}`
  );

  return result.rows[0];
};

// ---------------------------------------------------------------------------
// getMealLogs
// Returns all meal logs for a user on a specific date. Defaults to today if no date is provided.
// Ordered by created_at so logs appear in the order they were recorded.
// ---------------------------------------------------------------------------
export const getMealLogs = async (
  userId: string,
  date?: string
): Promise<MealLogEntry[]> => {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  const result = await pgPool.query(
    `SELECT
       id, food_ref, food_name, quantity_grams, meal_type,
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
// Removes a meal log entry. WHERE clause includes user_id to prevent users from deleting
// other users' logs by guessing IDs.
// ---------------------------------------------------------------------------
export const deleteMealLog = async ( userId: string, logId: string ): Promise<void> => {
  const result = await pgPool.query(
    "DELETE FROM meal_logs WHERE id = $1 AND user_id = $2",
    [logId, userId]
  );

  if (result.rowCount === 0) {
    throw new AppError(
      "Meal log not found",
      404,
      "LOG_NOT_FOUND"
    );
  }

  console.log(
    `[REMOVE LOG LATER] Meal log deleted. user. ${userId}. logId. ${logId}`
  );
};

// ---------------------------------------------------------------------------
// getDashboardData
// Returns all data the nutrition dashboard needs in one query set. Four queries total. daily totals, meal type breakdown, calorie target,
// and 7-day weekly trend. All run against PostgreSQL only.
//
// These four queries run sequentially rather than in parallel because
// they all depend on the same connection pool and the total data is small.
// Promise.all would not meaningfully improve performance here.
// ---------------------------------------------------------------------------
export const getDashboardData = async ( userId: string, date?: string ): Promise<DashboardData> => {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  // ---------------------------------------------------------------------------
  // Query 1. daily totals and log count for the target date
  // SUM with COALESCE ensures we get 0 instead of null when no logs exist.
  // ---------------------------------------------------------------------------
  const totalsResult = await pgPool.query(
    `SELECT
       COALESCE(SUM(calories), 0)   AS calories,
       COALESCE(SUM(protein_g), 0)  AS protein_g,
       COALESCE(SUM(carbs_g), 0)    AS carbs_g,
       COALESCE(SUM(fat_g), 0)      AS fat_g,
       COUNT(*)                      AS log_count
     FROM meal_logs
     WHERE user_id = $1
       AND logged_date = $2`,
    [userId, targetDate]
  );

  const totals = totalsResult.rows[0];

  // ---------------------------------------------------------------------------
  // Query 2. breakdown by meal type for the target date. Returns one row per meal type that has entries on this date.
  // This is perfect for ui charts.
  // ---------------------------------------------------------------------------
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

  // Shape the rows into a keyed object for easy frontend consumption. parseFloat converts string to decimal number/float 
  const byMealType: DashboardData["by_meal_type"] = {};
  for (const row of byTypeResult.rows) {
    byMealType[row.meal_type] = {
      calories: parseFloat(row.calories), 
      protein_g: parseFloat(row.protein_g),
      carbs_g: parseFloat(row.carbs_g),
      fat_g: parseFloat(row.fat_g),
    };
  }

  // ---------------------------------------------------------------------------
  // Query 3. user's calorie target from health profile
  // ---------------------------------------------------------------------------
  const targetResult = await pgPool.query(
    "SELECT calorie_target FROM health_profiles WHERE user_id = $1",
    [userId]
  );

  const calorieTarget = targetResult.rows[0]?.calorie_target ?? null;

  // ---------------------------------------------------------------------------
  // Query 4. 7-day weekly trend ending on the target date
  // generate_series creates a row for every date in the range even if no logs exist for that day. LEFT JOIN fills those days with zero.
  // This ensures the frontend always gets exactly 7 data points.
  // ---------------------------------------------------------------------------
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
      calories: parseFloat(totals.calories),
      protein_g: parseFloat(totals.protein_g),
      carbs_g: parseFloat(totals.carbs_g),
      fat_g: parseFloat(totals.fat_g),
    },
    by_meal_type: byMealType,
    calorie_target: calorieTarget,
    weekly_trend: weeklyResult.rows.map((r) => ({
      date: r.date,
      calories: parseFloat(r.calories),
    })),
    log_count: parseInt(totals.log_count, 10),
  };
};