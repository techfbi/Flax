import mongoose from "mongoose";
import { FoodItem } from "../../models/food.model.js";
import { redis } from "../../config/db.redis.js";
import { pgPool } from "../../config/db.postgres.js";
import { withImageUrl } from "../../shared/food.helpers.js";
import { AppError } from "../../shared/errors.js";
import type { FlagMealInput } from "./spin.schema.js";
import { getUserPantryNames } from "../pantry/pantry.service.js";
import { generateText } from "../../config/ai.js";
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
  ingredients: string[];
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
// Tags are sorted alphabetically before joining so that ["high-protein", "spicy"] and ["spicy", "high-protein"] produce
// the same key and hit the same cache entry.
// ---------------------------------------------------------------------------
const buildCacheKey = (region: string, filters: SpinFilters): string => {
  const parts = [`food:${region}`];
  if (filters.meal_type) parts.push(`mt:${filters.meal_type}`);
  if (filters.tags?.length) parts.push(`tags:${filters.tags.sort().join(",")}`); // sorted alphabetically to avoid duplicate keys
  return parts.join(":");
};

// ---------------------------------------------------------------------------
// Get food refs to exclude for this user. Combines two exclusion sources in one query using UNION.
// 1. Foods seen in the last 48 hours via spin_history. Prevents the same meal appearing twice within 2 days.
// 2. Foods permanently flagged via flagged_meals. Which will never appear again until user removes flag.
// UNION automatically removes duplicates so a food "flagged" AND "recently seen" only appears once in the result.
// ---------------------------------------------------------------------------
export const getExcludedFoodRefs = async (userId: string): Promise<string[]> => {
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
// applyPantryLogic
// Shared logic for applying pantry filtering on top of base-filtered foods.
// Extracted into its own function because it is called identically whether
// the food list came from Redis cache or fresh from MongoDB.
// This prevents code duplication between the cache hit path and the DB path.
// ---------------------------------------------------------------------------
const applyPantryLogic = async (
  foodsWithUrls: FoodResult[],
  userAllergens: string[],
  excludeIds: string[],
  userId: string
): Promise<{
  foods: FoodResult[];
  pantryMatchUsed: boolean;
  recencyRelaxed: boolean;
}> => {

  // User pantry
  const userPantry = await getUserPantryNames(userId);

  // Apply the normal filters.
  const baseFiltered = filterResults(
    foodsWithUrls,
    userAllergens,
    excludeIds
  );

  // Normal path.
  // We still have foods after exclusions.
  if (baseFiltered.length > 0) {

    // No pantry → just return normally.
    if (userPantry.length === 0) {
      return {
        foods: baseFiltered,
        pantryMatchUsed: false,
        recencyRelaxed: false,
      };
    }

    // Pantry exists.
    const pantryFiltered = filterByPantry(baseFiltered, userPantry);

    if (pantryFiltered.length > 0) {
      return {
        foods: pantryFiltered,
        pantryMatchUsed: true,
        recencyRelaxed: false,
      };
    }

    // Pantry produced no matches.
    console.log(
      `[REMOVE LOG LATER] Pantry fallback used for user ${userId}`
    );

    return {
      foods: baseFiltered,
      pantryMatchUsed: false,
      recencyRelaxed: false,
    };
  }

  // No foods remain.
  // Before failing, relax ONLY the 48-hour exclusion.
  //
  // We continue respecting:
  //   allergens
  //   flagged meals
  console.log(
    `[REMOVE LOG LATER] No foods after exclusions. Relaxing recency for ${userId}`
  );

  const flaggedResult = await pgPool.query(
    `SELECT food_ref
       FROM flagged_meals
      WHERE user_id = $1`,
    [userId]
  );

  const flaggedOnly = new Set(
    flaggedResult.rows.map(
      (row: { food_ref: string }) => row.food_ref
    )
  );

  const lowerAllergens = new Set(
    userAllergens.map((a) => a.toLowerCase())
  );

  const relaxedFoods = foodsWithUrls.filter((food) => {

    // Always respect permanent flags.
    if (flaggedOnly.has(food._id)) {
      return false;
    }

    // Always respect allergens.
    if (lowerAllergens.size > 0) {
      const foodAllergens = food.allergen_tags.map((a) =>
        a.toLowerCase()
      );

      if (foodAllergens.some((a) => lowerAllergens.has(a))) {
        return false;
      }
    }

    // Ignore excludeIds.
    return true;
  });

  // Still nothing?
  // Allergens and/or flagged meals are blocking everything.
  if (relaxedFoods.length === 0) {
    throw new AppError(
      "No meals match your current filters without triggering your allergens. Try changing your filters.",
      404,
      "NO_FOODS_AFTER_ALLERGENS"
    );
  }

  // We successfully relaxed the recency rule.
  // Optionally reapply pantry.

  if (userPantry.length > 0) {
    const pantryRelaxed = filterByPantry(relaxedFoods, userPantry);

    if (pantryRelaxed.length > 0) {
      console.log(
        `[REMOVE LOG LATER] Returning previously seen pantry meals for ${userId}`
      );

      return {
        foods: pantryRelaxed,
        pantryMatchUsed: true,
        recencyRelaxed: true,
      };
    }
  }

  console.log(
    `[REMOVE LOG LATER] Returning previously seen meals for ${userId}`
  );

  return {
    foods: relaxedFoods,
    pantryMatchUsed: false,
    recencyRelaxed: true,
  };
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
  excludeIds: string[] = [],
  userId: string
): Promise<{ foods: FoodResult[]; pantryMatchUsed: boolean; recencyRelaxed: boolean }> => {
  const cacheKey = buildCacheKey(region, filters);

  // Check Redis cache first
  try {
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log(`[REMOVE LOG LATER] Food cache hit. key. ${cacheKey}`);
      // Parse the cached JSON string back into an array of FoodResult objects.
      // Then pass through the same pantry logic as the MongoDB path.
      // The return type must match the function signature in both the cache
      // hit path and the MongoDB path. applyPantryLogic handles both.
      const cachedFoods = JSON.parse(cached) as FoodResult[];
      return applyPantryLogic(cachedFoods, userAllergens, excludeIds, userId);
    }
  } catch (err) {
    // If Redis fails, continue to MongoDB. we didnt block spin due to cache failure.
    console.error(
      "[REMOVE LOG LATER] Redis cache read failed. falling back to MongoDB.",
      err
    );
  }

  // BUILD MONGODB QUERY. Since we don't know beforehand which properties will exist, a fixed type wouldn't work well.
  const query: Record<string, unknown> = {
    region,
    is_verified: true,
  };

  if (filters.meal_type) {
    // When a field is an array in MongoDB, querying for a single value checks if the array CONTAINS that value among other values.
    query.meal_types = filters.meal_type; // Dynamically adding to the query field
  }

  if (filters.tags?.length) {
    // $all means the food must have ALL the requested tags.
    // Selecting "spicy" and "high-protein" returns only foods with both.
    query.tags = { $all: filters.tags };
  }

  const foods = await FoodItem.find(query)
    .select("-__v -createdAt -updatedAt -usda_ref -regional_names") // Exclude those fields from the result. ingredients is NOT excluded and is included by default.
    .lean(); // We do not want our returned object to be full Mongoose document instance (i.e the methods, getters, internal tracking etc). To get faster and use less memory js objects for safe caching.

  if (foods.length === 0) {
    throw new AppError(
      "No meals found matching your filters. Try adjusting your preferences.",
      404,
      "NO_FOODS_FOUND"
    );
  }

  // Attach full image URLs before caching.
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

  // Pass through pantry logic and return.
  // applyPantryLogic handles allergen filtering, exclusion filtering,
  // pantry matching, graceful fallback, and all error cases.
  return applyPantryLogic(foodsWithUrls, userAllergens, excludeIds, userId);
};

// ---------------------------------------------------------------------------
// filterResults
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
      userAllergens.map((a) => a.toLowerCase()) // case-insensitive so that allergen "peanut" and "Peanut" and "PEANUT" will all match
    );
    filtered = filtered.filter((food) => {
      const foodAllergens = (food.allergen_tags as string[]).map((a) =>
        a.toLowerCase()
      );
      // returns true (keep this food) ONLY if no allergen matches. (foodAllergens.some(...) means does ANY allergen match?)
      return !foodAllergens.some((a) => lowerAllergens.has(a));
    });
  }

  return filtered;
};

// ---------------------------------------------------------------------------
// filterByPantry
// Filters a food list to only those whose ingredients array contains
// at least one item from the user's pantry.
// Matching is partial and case-insensitive.
// "palm oil" in pantry matches "palm oil" in ingredients.
// "yam" in pantry matches "water yam" and "yam flour" in ingredients.
// A food passes if ANY ONE of its ingredients matches ANY ONE pantry item.
// We do not require all ingredients because users rarely have every ingredient at home.
// ---------------------------------------------------------------------------
const filterByPantry = (
  foods: FoodResult[],
  userPantry: string[]
): FoodResult[] => {
  if (userPantry.length === 0) return foods;

  const lowerPantry = userPantry.map((p) => p.toLowerCase());

  return foods.filter((food) => {
    const foodIngredients = (food.ingredients as string[]).map((i) =>
      i.toLowerCase()
    );

    return foodIngredients.some((ingredient) =>
      lowerPantry.some(
        (pantryItem) =>
          ingredient.includes(pantryItem) || pantryItem.includes(ingredient)
      )
    );
  });
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

  // Check cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    console.error(
      "[REMOVE LOG LATER] Redis filter cache read failed.",
      err
    );
  }

  // MongoDB aggregation pipeline
  const result = await FoodItem.aggregate([
    { $match: { region, is_verified: true } }, // filter to verified foods in this region only
    {
      $group: {
        _id: null,
        all_tags: { $addToSet: "$tags" },
        all_meal_types: { $addToSet: "$meal_types" },
      },
    }, // collect all tags and meal_types arrays into sets. $addToSet prevents duplicate arrays from being added.
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
      }, // flatten the nested sets into single flat arrays. $reduce with $setUnion merges the array-of-arrays into one flat array.
    },
  ]);

  // If the aggregation returns no results (empty collection or no verified items for this region),
  // fall back to empty arrays so the frontend receives a valid response rather than an error.
  const filters = result[0] ?? { tags: [], meal_types: [] };

  // Cache for 24 hours
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
// ON CONFLICT DO NOTHING means if the user tries to flag the same meal twice, the second attempt silently succeeds without throwing a duplicate key error.
// ---------------------------------------------------------------------------
export const flagMeal = async (userId: string, input: FlagMealInput): Promise<void> => {
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
// Used to render the flagged meals management screen. Ordered by most recent.
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
// The WHERE clause includes user_id to prevent a user from removing
// another user's flags by guessing flag IDs.
// ---------------------------------------------------------------------------
export const unflagMeal = async (
  userId: string,
  flagId: number
): Promise<void> => {
  await pgPool.query(
    "DELETE FROM flagged_meals WHERE id = $1 AND user_id = $2",
    [flagId, userId]
  );
}


// ---------------------------------------------------------------------------
// generateSpinReasoning
// Asks the AI to explain in 2 to 3 sentences why this specific meal is a good suggestion for this user right now.
//
// We pass structured context about the user so the model can personalise the reasoning. We never ask the AI to pick the food or calculate
// nutrition values. the database handles both. AI only adds the
// human-readable explanation layer.
//
// If both Groq models fail, we return a random hard fallback string.
// The spin result is never blocked by an AI failure.
// ---------------------------------------------------------------------------
export const generateSpinReasoning = async (
  food: FoodResult,
  context: {
    healthGoal: string | null;
    dietaryStyle: string | null;
    mealType: string | null;
    timeOfDay: string;
    pantryMatchUsed: boolean;
    region: string;
  }
): Promise<string> => {
  const prompt = `You are an expert and friendly nutrition assistant for a food suggestion app.

  A user has just spun the wheel and landed on: ${food.name}

  User context:
  - Region: ${context.region}
  - Health goal: ${context.healthGoal ?? "not specified"}
  - Dietary style: ${context.dietaryStyle ?? "not specified"}
  - Meal type filter selected: ${context.mealType ?? "any"}
  - Time of day: ${context.timeOfDay}
  - Meal matched their pantry ingredients: ${context.pantryMatchUsed ? "yes" : "no"}

  Food details:
  - Description: ${food.description}
  - Protein: ${food.protein_g}g per 100g, Carbs: ${food.carbs_g}g per 100g, Fat: ${food.fat_g}g per 100g

  Write exactly 2 short sentences. maximum 200 characters. Focus on the single most relevant aspect of this meal for this user right now.
  Possible aspects include:
  - protein support
  - satiety
  - convenience
  - flavour
  - cultural relevance
  - pantry usefulness
  - meal timing
  - variety
  - enjoyment
  - goal matching
  Choose whichever aspect best fits the meal and user context.

  Avoid repeating common phrases such as:
  "start your day"
  "provide energy"
  "support muscle growth"
  "balanced meal"
  "Nigerian meal"
  "Nigerian taste"
  "regional names"
  "good source of protein"
  Vary sentence structure and wording across responses.
  Be warm and encouraging but not over the top.
  Be creative and dynamic in your reasoning. Avoid repeating the same phrases and sentence structures across different spins for the same user. Make it feel fresh and personalised every time.
  Do not repeat the food name more than once.
  Do not mention exact numbers unless directly relevant to their health goal.
  Do not make medical claims.
  Respond with ONLY the explanation text. no labels, no bullet points, no greeting, no sign-off, no emoji, no unnecessary hyphen, no medical diagnosis, no dangerous instructions/self harm advice, no hateful content, no explicit sexual context.`;

  const { text } = await generateText(prompt, 300, 0.7);

  if (!text) {
    // Both models failed. use hard fallback.
    console.warn(
      "[REMOVE LOG LATER] All AI models failed for spin reasoning. Using hard fallback."
    );
    return getFallbackReasoning(food.name);
  }

  return text;
};

// ---------------------------------------------------------------------------
// getFallbackReasoning
// Returns a randomly selected generic explanation when all AI models fail.
// Random selection prevents users seeing the same text repeatedly
// if the AI is down for an extended period.
// ---------------------------------------------------------------------------
const getFallbackReasoning = (foodName: string): string => {
  const fallbacks = [
    `${foodName} looks like a great choice for this meal. It is a well-balanced option that fits your current preferences.`,
    `Based on your selected preferences, ${foodName} is a solid meal suggestion. Would you like to give it a try?`,
    `${foodName} matches the filters applied to your spin. It could be a tasty option to add some variety to your meal choices today.`,
  ];

  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
};

// ---------------------------------------------------------------------------
// HEALTH GOAL TAG PREFERENCES
// Maps each health goal to preferred and deprioritised tags.
// Used for weighted random selection so the spinner favours foods that
// align with the user's goal without hard-excluding anything.
// ---------------------------------------------------------------------------
const HEALTH_GOAL_WEIGHTS: Record<
  string,
  { prefer: string[]; deprioritise: string[] }
> = {
  weight_loss: {
    prefer: ["light", "low-carb", "high-protein", "salad", "healthy", "vegetables"],
    deprioritise: ["high-fat", "sweet", "party-food", "comfort-food", "high-carb"],
  },
  muscle_gain: {
    prefer: ["high-protein"],
    deprioritise: ["light", "low-carb"],
  },
  weight_gain: {
    prefer:       ["high-fat", "high-carb", "filling", "comfort-food", "sweet", "heavy"],
    deprioritise: ["light", "low-carb"],
},
  maintenance: {
    prefer: [],
    deprioritise: [],
  },
  general_health: {
    prefer: ["nutritious", "vegetables", "healthy", "light"],
    deprioritise: ["fast-food", "sweet", "street-food"],
  },
};

// ---------------------------------------------------------------------------
// pickFoodByHealthGoal
// Applies weighted random selection based on the user's health goal. Foods matching preferred tags get weight 3.
// Foods matching deprioritised tags get weight 1. All other foods get weight 2.
// This means preferred foods are 3x more likely to be picked than
// deprioritised foods but deprioritised foods can still appear occasionally.
// If no health goal or an unrecognized health goal is provided, no tags are preferred or deprioritised, but validated boost still applies.
// ---------------------------------------------------------------------------
export const pickFoodByHealthGoal = (
  foods: FoodResult[],
  healthGoal: string | null,
  validatedRefs: Set<string> = new Set()
): FoodResult => {
  if (!healthGoal || !HEALTH_GOAL_WEIGHTS[healthGoal]) {
    // No health goal but still apply validated boost.
    return pickWithValidatedBoost(foods, [], [], validatedRefs);
  }

  const { prefer, deprioritise } = HEALTH_GOAL_WEIGHTS[healthGoal];
  return pickWithValidatedBoost(foods, prefer, deprioritise, validatedRefs);
};

// ---------------------------------------------------------------------------
// pickWithValidatedBoost
// Separated from pickFoodByHealthGoal to keep the weighting logic readable.
// Weight hierarchy from highest to lowest priority:
//   validated + preferred  = weight 9  (3 × 3)
//   validated + neutral    = weight 6  (3 × 2)
//   validated + deprioritised = weight 3 (3 × 1)
//   preferred only         = weight 3
//   neutral                = weight 2
//   deprioritised          = weight 1
// Validated meals are always weighted at 3x their normal weight.
// Health goal still matters within the validated set so a user who
// validated a heavy meal but switches to weight_loss goal still sees lighter validated meals ranked above heavier ones.
// ---------------------------------------------------------------------------
const pickWithValidatedBoost = (
  foods: FoodResult[],
  prefer: string[],
  deprioritise: string[],
  validatedRefs: Set<string>
): FoodResult => {
  const weighted = foods.map((food) => {
    const tags = food.tags as string[];
    const isValidated = validatedRefs.has(food._id); // check if this food is in the user's validated set
    const isPreferred = prefer.length > 0 && prefer.some((tag) => tags.includes(tag));
    const isDeprioritised = deprioritise.length > 0 && deprioritise.some((tag) => tags.includes(tag));

    const baseWeight = isPreferred ? 3 : isDeprioritised ? 1 : 2;
    const weight     = isValidated ? baseWeight * 3 : baseWeight;

    return { food, weight };
  });

  const pool: FoodResult[] = [];
  for (const { food, weight } of weighted) {
    for (let i = 0; i < weight; i++) {
      pool.push(food);
    }
  }

  return pool[Math.floor(Math.random() * pool.length)];
};


// ---------------------------------------------------------------------------
// validateMeal
// Stores a thumbs up reaction against a food for this user. ON CONFLICT DO NOTHING makes this idempotent. tapping thumbs up twice
// on the same food is silently ignored.
// ---------------------------------------------------------------------------
export const validateMeal = async (
  userId: string,
  foodRef: string,
  foodName: string
): Promise<void> => {
  await pgPool.query(
    `INSERT INTO validated_meals (user_id, food_ref, food_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, food_ref) DO NOTHING`,
    [userId, foodRef, foodName]
  );

  console.log(
    `[REMOVE LOG LATER] Meal validated. user. ${userId}. food. ${foodName}`
  );
};

// ---------------------------------------------------------------------------
// unvalidateMeal
// Removes a thumbs up. user_id in WHERE prevents removing another user's validation.
// ---------------------------------------------------------------------------
export const unvalidateMeal = async (
  userId: string,
  foodRef: string
): Promise<void> => {
  await pgPool.query(
    "DELETE FROM validated_meals WHERE user_id = $1 AND food_ref = $2",
    [userId, foodRef]
  );

  console.log(
    `[REMOVE LOG LATER] Meal validation removed. user. ${userId}. food. ${foodRef}`
  );
};

// ---------------------------------------------------------------------------
// getValidatedFoodRefs
// Returns the validated foodrefs. Called inside spin controller alongside getExcludedFoodRefs so both PostgreSQL lookups can happen in parallel using Promise.all.
// ---------------------------------------------------------------------------
export const getValidatedFoodRefs = async (userId: string): Promise<Set<string>> => {
  const result = await pgPool.query(
    "SELECT food_ref FROM validated_meals WHERE user_id = $1",
    [userId]
  );

  return new Set(result.rows.map((r: { food_ref: string }) => r.food_ref));
};

// ---------------------------------------------------------------------------
// getSpinHistory
// Returns spin history for the user for display in the history UI section.
// displayDays controls how many days back to show. default is 2.
// We always store 7 days but the UI shows 2 by default. was_accepted: true means the user accepted this spin result.
// was_accepted: false means they rejected and spun again.
// ---------------------------------------------------------------------------
export const getSpinHistory = async ( userId: string, displayDays: number = 2 ): Promise<object[]> => {
  const result = await pgPool.query(
    `SELECT
   id, food_ref, result_name, result_description, filters_applied, was_accepted, rejection_reason, spun_at
    FROM spin_history
    WHERE user_id = $1
      AND spun_at >= NOW() - ($2 || ' days')::INTERVAL
    ORDER BY spun_at DESC`,
    [userId, displayDays]
  );

  return result.rows;
};

//------------------------------------------------------------------------------
// Returns a small random sample of verified food image URLs from the
// user's region, used only to cycle through while the spin frame is
// still deciding, not the actual landed result. Falls back to an
// empty array if the catalogue has nothing yet, SpinFrame already
// handles an empty list by just showing the placeholder.
export const getCycleImageSample = async (region: string, limit = 8): Promise<string[]> => {
  const foods = await FoodItem.aggregate([
    { $match: { region, is_verified: true } },
    { $sample: { size: limit } },
    { $project: { image_path: 1 } },
  ]);

  return foods.map((food) => withImageUrl(food).image_url);
};


//-----------------------------------------------------------------------------------
// Removes spin history older than 48 hours. Nothing in the app ever
// reads past that window, getExcludedFoodRefs above only looks at
// the last 48 hours, and the history tab only ever shows Today and
// Yesterday, so this is pure cleanup, not a behavior change.
export const cleanupOldSpinHistory = async (): Promise<void> => {
  const result = await pgPool.query(
    `DELETE FROM spin_history WHERE spun_at < NOW() - INTERVAL '48 hours'`
  );
  console.log(`[REMOVE LOG LATER]Spin cleanup, removed ${result.rowCount} spin history rows older than 48 hours`);
};