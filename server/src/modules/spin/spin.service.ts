import mongoose from "mongoose";
import { FoodItem, type IFoodItem } from "../../models/food.model.js";
import { redis } from "../../config/db.redis.js";
import { pgPool } from "../../config/db.postgres.js";
import { withImageUrl } from "../../shared/food.helpers.js";
import { AppError } from "../../shared/errors.js";
import type { FlagMealInput } from "./spin.schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SpinFilters {
  meal_type?: string;
  tags?: string[];
}

export interface FoodResult {
  _id: string;
  name: string;
  description: string;
  image_url: string;
  image_path: string;
  tags: string[];
  meal_types: string[];
  allergen_tags: string[];
  calories_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// ---------------------------------------------------------------------------
// Build Redis cache key from region and filters.
// Different filter combinations get independent cache entries.
// ---------------------------------------------------------------------------
const buildCacheKey = (region: string, filters: SpinFilters): string => {
  const parts = [`food:${region}`];
  if (filters.meal_type) parts.push(`mt:${filters.meal_type}`);
  if (filters.tags?.length) parts.push(`tags:${filters.tags.sort().join(",")}`);
  return parts.join(":");
};

// ---------------------------------------------------------------------------
// Get food refs to exclude for this user.
// Combines two exclusion sources in one query.
// 1. Foods seen in the last 48 hours via spin_history.
// 2. Foods permanently flagged via flagged_meals.
// ---------------------------------------------------------------------------
export const getExcludedFoodRefs = async (
  userId: string
): Promise<string[]> => {
  const result = await pgPool.query(
    `SELECT food_ref FROM spin_history
     WHERE user_id = $1
     AND spun_at > NOW() - INTERVAL '48 hours'
     AND food_ref IS NOT NULL

     UNION

     SELECT food_ref FROM flagged_meals
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows.map((r: { food_ref: string }) => r.food_ref);
};

// ---------------------------------------------------------------------------
// Get foods for the spin wheel.
// Returns a filtered list of foods for the user's region.
// Results are cached in Redis for 1 hour to avoid hitting MongoDB on every spin.
// Allergen filtering and exclusion filtering happen after cache retrieval
// because they are per-user and cannot be cached generically.
// ---------------------------------------------------------------------------
export const getFoodsForSpin = async (
  region: string,
  filters: SpinFilters,
  userAllergens: string[],
  excludeIds: string[] = []
): Promise<FoodResult[]> => {
  const cacheKey = buildCacheKey(region, filters);

  // Check Redis cache first
  try {
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log(`[REMOVE LOG LATER] Food cache hit. key. ${cacheKey}`);
      const cachedFoods = JSON.parse(cached) as FoodResult[];
      return filterResults(cachedFoods, userAllergens, excludeIds);
    }
  } catch (err) {
    // If Redis fails, continue to MongoDB. never block a spin due to cache failure.
    console.error(
      "[REMOVE LOG LATER] Redis cache read failed. falling back to MongoDB.",
      err
    );
  }

  // Build MongoDB query
  const query: Record<string, unknown> = {
    region,
    is_verified: true,
  };

  if (filters.meal_type) {
    query.meal_types = filters.meal_type;
  }

  if (filters.tags?.length) {
    // $all means the food must have ALL the requested tags.
    // Selecting "spicy" and "high-protein" returns only foods with both.
    query.tags = { $all: filters.tags };
  }

  const foods = await FoodItem.find(query)
    .select("-__v -createdAt -updatedAt -usda_ref -regional_names")
    .lean();

  if (foods.length === 0) {
    throw new AppError(
      "No meals found matching your filters. Try adjusting your preferences.",
      404,
      "NO_FOODS_FOUND"
    );
  }

  // Attach full image URLs before caching
  const foodsWithUrls = foods.map((food) =>
    withImageUrl({
      ...food,
      _id: (food._id as mongoose.Types.ObjectId).toString(),
    })
  ) as FoodResult[];

  // Cache the unfiltered region result for 1 hour.
  // Allergen and exclusion filtering happen after retrieval, not here,
  // so the same cache entry serves all users in the same region.
  try {
    await redis.setEx(cacheKey, 3600, JSON.stringify(foodsWithUrls));
    console.log(`[REMOVE LOG LATER] Food list cached. key. ${cacheKey}`);
  } catch (err) {
    console.error("[REMOVE LOG LATER] Redis cache write failed.", err);
  }

  return filterResults(foodsWithUrls, userAllergens, excludeIds);
};

// ---------------------------------------------------------------------------
// Apply allergen and exclusion filters to a food list.
// Separated into its own function so it can be called identically
// whether the list came from Redis cache or fresh from MongoDB.
// ---------------------------------------------------------------------------
const filterResults = (
  foods: FoodResult[],
  userAllergens: string[],
  excludeIds: string[]
): FoodResult[] => {
  let filtered = foods;

  // Remove permanently flagged and recently seen foods
  if (excludeIds.length > 0) {
    const excludeSet = new Set(excludeIds);
    filtered = filtered.filter((food) => !excludeSet.has(food._id));
  }

  // Remove foods containing any of the user's allergens
  if (userAllergens.length > 0) {
    const lowerAllergens = new Set(
      userAllergens.map((a) => a.toLowerCase())
    );
    filtered = filtered.filter((food) => {
      const foodAllergens = (food.allergen_tags as string[]).map((a) =>
        a.toLowerCase()
      );
      return !foodAllergens.some((a) => lowerAllergens.has(a));
    });
  }

  return filtered;
};

// ---------------------------------------------------------------------------
// Get available filters for the user's region.
// Used by the frontend to populate the pre-spin filter UI.
// Cached for 24 hours since filters rarely change.
// ---------------------------------------------------------------------------
export const getAvailableFilters = async (
  region: string
): Promise<{ meal_types: string[]; tags: string[] }> => {
  const cacheKey = `filters:${region}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    console.error(
      "[REMOVE LOG LATER] Redis filter cache read failed.",
      err
    );
  }

  // Aggregate all unique tags and meal_types for this region
  const result = await FoodItem.aggregate([
    { $match: { region, is_verified: true } },
    {
      $group: {
        _id: null,
        all_tags: { $addToSet: "$tags" },
        all_meal_types: { $addToSet: "$meal_types" },
      },
    },
    {
      $project: {
        tags: {
          $reduce: {
            input: "$all_tags",
            initialValue: [],
            in: { $setUnion: ["$$value", "$$this"] },
          },
        },
        meal_types: {
          $reduce: {
            input: "$all_meal_types",
            initialValue: [],
            in: { $setUnion: ["$$value", "$$this"] },
          },
        },
      },
    },
  ]);

  const filters = result[0] ?? { tags: [], meal_types: [] };

  try {
    await redis.setEx(cacheKey, 24 * 3600, JSON.stringify(filters));
  } catch (err) {
    console.error(
      "[REMOVE LOG LATER] Redis filter cache write failed.",
      err
    );
  }

  return filters;
};

// ---------------------------------------------------------------------------
// Flag a meal as "do not show anymore" for this user.
// Permanently excludes it from all future spins.
// ---------------------------------------------------------------------------
export const flagMeal = async (
  userId: string,
  input: FlagMealInput
): Promise<void> => {
  await pgPool.query(
    `INSERT INTO flagged_meals (user_id, food_ref, food_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, food_ref) DO NOTHING`,
    [userId, input.food_ref, input.food_name]
  );

  console.log(
    `[REMOVE LOG LATER] Meal flagged. user. ${userId}. food. ${input.food_name}`
  );
};

// ---------------------------------------------------------------------------
// Get all meals flagged by this user.
// Used to render the flagged meals management screen.
// ---------------------------------------------------------------------------
export const getFlaggedMeals = async (userId: string) => {
  const result = await pgPool.query(
    `SELECT id, food_ref, food_name, created_at
     FROM flagged_meals
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
};

// ---------------------------------------------------------------------------
// Remove a flag so the meal can appear in spins again.
// ---------------------------------------------------------------------------
export const unflagMeal = async (
  userId: string,
  flagId: number
): Promise<void> => {
  await pgPool.query(
    "DELETE FROM flagged_meals WHERE id = $1 AND user_id = $2",
    [flagId, userId]
  );
};
