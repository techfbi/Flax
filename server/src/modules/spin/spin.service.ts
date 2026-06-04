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
  meal_type?: string; // optional. filters to a specific meal type
  tags?: string[]; // optional. filters to foods matching ALL these tags
}

// The shape of a food item as returned to the frontend.
export interface FoodResult {
  _id: string;
  name: string;
  description: string;
  image_url: string; // full CDN URL built from image_path
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
// Different filter combinations get independent cache entries so they never overwrite each other.

// Examples of generated keys.
//   "food:Nigeria"
//   "food:Nigeria:mt:lunch"
//   "food:Nigeria:mt:dinner:tags:spicy,high-protein"
//
// Tags are sorted alphabetically before joining so that ["high-protein", "spicy"] and ["spicy", "high-protein"] produce
// the same key and hit the same cache entry.
// ---------------------------------------------------------------------------
const buildCacheKey = (region: string, filters: SpinFilters): string => {
  const parts = [`food:${region}`];
  if (filters.meal_type) parts.push(`mt:${filters.meal_type}`);
  if (filters.tags?.length) parts.push(`tags:${filters.tags.sort().join(",")}`); //This is where we sorted alphabetically to avoid duplicate keys
  return parts.join(":");
};

// ---------------------------------------------------------------------------
// Get food refs to exclude for this user. Combines two exclusion sources in one query using UNION.
// 1. Foods seen in the last 48 hours via spin_history. Prevents the same meal appearing twice within 2 days
// 2. Foods permanently flagged via flagged_meals. Which will never appear again until user removes flag.
// UNION automatically removes duplicates so a food "flagged" AND "recently seen" only appears once in the result.
// ---------------------------------------------------------------------------
export const getExcludedFoodRefs = async ( userId: string ): Promise<string[]> => {
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

  // Return an array of food_ref strings to exclude, without the default objects with row name "food_ref" that would come from the SQL result. Just a plain array of strings.
  return result.rows.map((r: { food_ref: string }) => r.food_ref);
};

// ---------------------------------------------------------------------------
// Get foods for the spin wheel. Returns a filtered list of foods for the user's region.
// Results are cached in Redis for 1 hour to avoid hitting MongoDB on every spin.
// Allergen filtering and exclusion filtering happen after cache retrieval because they are per-user and cannot be cached generically.
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
      const cachedFoods = JSON.parse(cached) as FoodResult[]; //Parse the cached JSON string back into an array of FoodResult objects
      return filterResults(cachedFoods, userAllergens, excludeIds); // Apply per-user filters to the cached list and return
    }
  } catch (err) {
    // If Redis fails, continue to MongoDB. we didnt block spin due to cache failure.
    console.error(
      "[REMOVE LOG LATER] Redis cache read failed. falling back to MongoDB.",
      err
    );
  }

  // BUILD MONGODB QUERY and Since we don't know beforehand which properties will exist, a fixed type wouldn't work well.
  const query: Record<string, unknown> = {
    region,
    is_verified: true,
  };

  if (filters.meal_type) {
    // When a field is an array in MongoDB, querying for a single value checks if the array CONTAINS that value among other values.
    query.meal_types = filters.meal_type; // Dynamically adding to the queryfield
  }

  if (filters.tags?.length) {
    // $all means the food must have ALL the requested tags.
    // Selecting "spicy" and "high-protein" returns only foods with both.
    query.tags = { $all: filters.tags };
  }

  const foods = await FoodItem.find(query)
    .select("-__v -createdAt -updatedAt -usda_ref -regional_names") // Exclude those fields from the result
    .lean(); // We do not want our returned object to be full Mongoose doucument instance (i.e the methods, getters, internal trackking etc). To get faster and use less memory js objects for safe caching

  if (foods.length === 0) {
    throw new AppError(
      "No meals found matching your filters. Try adjusting your preferences.",
      404,
      "NO_FOODS_FOUND"
    );
  }

  // Attach full image URLs before caching
  // We convert the MongoDB ObjectId to a string because ObjectId is a special Mongoose type that does not serialize to JSON cleanly.
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
    // Cache write failure is not a blocker. the user still gets their food list.
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
    const excludeSet = new Set(excludeIds); // we didnt use Array.includes because Set is much faster when checking membership repeatedly.
    filtered = filtered.filter((food) => !excludeSet.has(food._id));
  }

  // Remove foods containing any of the user's allergens
  if (userAllergens.length > 0) {
    const lowerAllergens = new Set(
      userAllergens.map((a) => a.toLowerCase()) // case-insensitive so that allergen "peanut and Peanut and PEANUT " will match
    );
    filtered = filtered.filter((food) => {
      const foodAllergens = (food.allergen_tags as string[]).map((a) =>
        a.toLowerCase()
      );
      // returns true (keep this food) ONLY if no allergen matches.( foodAllergens.some(...) means does ANY allergen match?)
      return !foodAllergens.some((a) => lowerAllergens.has(a)); 
    });
  }

  return filtered;
};

// ---------------------------------------------------------------------------
// Get available filters for the user's region. Used by the frontend to populate the pre-spin filter UI.
// Cached for 24 hours since filters rarely change.
// Uses a MongoDB aggregation pipeline which processes documents on the server side. More efficient than fetching all documents and processing in application code.
// ---------------------------------------------------------------------------
export const getAvailableFilters = async (
  region: string
): Promise<{ meal_types: string[]; tags: string[] }> => {
  const cacheKey = `filters:${region}`;

  // check cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    console.error(
      "[REMOVE LOG LATER] Redis filter cache read failed.",
      err
    );
  }

  // MongoDB aggregation pipeline.
  // Aggregate all unique tags and meal_types for this region
  const result = await FoodItem.aggregate([
    { $match: { region, is_verified: true } }, // $match. filter to verified foods in this region only.
    {
      $group: {
        _id: null,
        all_tags: { $addToSet: "$tags" },
        all_meal_types: { $addToSet: "$meal_types" },
      },
    }, // $group. collect all tags and meal_types arrays into sets. $addToSet prevents duplicate arrays from being added.
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
      }, // $project. flatten the nested sets into single flat arrays. $reduce with $setUnion merges the array-of-arrays into one flat array.
    },
  ]);

  // If the aggregation returns no results (empty collection or no verified items for this region), 
  // fall back to empty arrays so the frontend receives a valid response rather than an error.
  const filters = result[0] ?? { tags: [], meal_types: [] };

  // cache for 24hrs
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
export const flagMeal = async ( userId: string, input: FlagMealInput ): Promise<void> => {
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
// Used to render the flagged meals management screen. Order by most recent
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
