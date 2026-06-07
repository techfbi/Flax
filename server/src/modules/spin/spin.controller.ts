import type { Request, Response, NextFunction } from "express";
import { pgPool } from "../../config/db.postgres.js";
import { sendSuccess } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
import { getExcludedFoodRefs, getFoodsForSpin, generateSpinReasoning, SpinFilters, pickFoodByHealthGoal } from "./spin.service.js";
import {
  getAvailableFilters,
  flagMeal,
  getFlaggedMeals,
  unflagMeal,
} from "./spin.service.js";
import { type FlagMealInput } from "./spin.schema.js";

// ---------------------------------------------------------------------------
// GET /api/spin/filters
// Returns available meal types and tags for the authenticated user's region.
// Frontend uses this to populate the pre-spin filter UI.
// ---------------------------------------------------------------------------
export const getFilters = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await pgPool.query(
      "SELECT region FROM health_profiles WHERE user_id = $1",
      [req.user!.id]
    );

    const region = result.rows[0]?.region;

    if (!region) {
      throw new AppError(
        "Please complete your profile and set your region before using the spinner.",
        400,
        "NO_REGION_SET"
      );
    }

    const filters = await getAvailableFilters(region);

    sendSuccess({ res, data: { region, filters } });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/spin/flag
// Permanently flags a meal so it never appears in this user's spins again.
// ---------------------------------------------------------------------------
export const flagMealHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as FlagMealInput;
    await flagMeal(req.user!.id, input);
    sendSuccess({
      res,
      message: "Meal flagged. It will not appear in your future spins.",
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/spin/flagged
// Returns all meals the user has permanently flagged.
// Used to render a management screen where users can review and unflag meals.
// ---------------------------------------------------------------------------
export const getFlaggedHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const meals = await getFlaggedMeals(req.user!.id);
    sendSuccess({ res, data: { flagged_meals: meals } });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/spin/flag/:flagId
// Removes a flag so the meal can appear in spins again.
// ---------------------------------------------------------------------------
export const unflagMealHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const flagId = parseInt(req.params.flagId as string, 10); //The radix argument 10 is base 10, bcos without it js might interpret as octal if string starts with 0.

    if (isNaN(flagId)) {
      throw new AppError("Invalid flag ID", 400, "INVALID_ID");
    }

    await unflagMeal(req.user!.id, flagId);
    sendSuccess({
      res,
      message: "Meal unflagged and back in your future spins again.",
    });
  } catch (err) {
    next(err);
  }
};


// ---------------------------------------------------------------------------
// POST /api/spin
// The core spin endpoint. picks a random food from the filtered list,
// records it in spin history, and returns it with a Gemini reasoning explanation.
//
// Response:
//   food: FoodResult        — the selected food item with full details
//   reasoning: string       — Gemini explanation
//   pantry_match: boolean   — whether pantry filtering was used
// ---------------------------------------------------------------------------
export const spin = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const userId = req.user!.id;

    // ---------------------------------------------------------------------------
    // Step 1. Get user profile data needed for filtering and Gemini context
    // ---------------------------------------------------------------------------
    const profileResult = await pgPool.query(
      `SELECT
         hp.region, hp.dietary_style, hp.health_goal,
         hp.allergies, hp.health_conditions
       FROM health_profiles hp
       WHERE hp.user_id = $1`,
      [userId]
    );

    const profile = profileResult.rows[0];

    if (!profile?.region) {
      throw new AppError(
        "Please complete your profile and set your region before spinning.",
        400,
        "NO_REGION_SET"
      );
    }

    // ---------------------------------------------------------------------------
    // Step 2. Parse filters from request body
    // ---------------------------------------------------------------------------
    const filters: SpinFilters = {};

    if (req.body?.meal_type && typeof req.body.meal_type === "string") {
      filters.meal_type = req.body.meal_type;
    }

    if (Array.isArray(req.body?.tags) && req.body.tags.length > 0) {
      filters.tags = req.body.tags.filter((t: unknown) => typeof t === "string"); // Filter out every other type in the array except the string
    }

    // ---------------------------------------------------------------------------
    // Step 3. Get exclusion list. recently seen + permanently flagged
    // ---------------------------------------------------------------------------
    const excludeIds = await getExcludedFoodRefs(userId);

    // ---------------------------------------------------------------------------
    // Step 4. Get filtered food list
    // ---------------------------------------------------------------------------
    const { foods, pantryMatchUsed } = await getFoodsForSpin(
      profile.region,
      filters,
      profile.allergies ?? [],
      excludeIds,
      userId
    );

    // ---------------------------------------------------------------------------
    // Step 5. Pick food by biased randomness based on health goal. This adds a personalized touch to the randomness. Two users with the same filters might get different results based on their health goals.
    // Applies weighted random selection based on the user's health goal.
    // We pick the winner here and the frontend uses the animation to dramatically reveal it.
    // ---------------------------------------------------------------------------
    const selectedFood = pickFoodByHealthGoal(foods, profile.health_goal);

    // ---------------------------------------------------------------------------
    // Step 6. Determine time of day for Gemini context
    // ---------------------------------------------------------------------------
    const hour = new Date().getHours();
    const timeOfDay =
      hour < 12 ? "morning" :
      hour < 17 ? "afternoon" :
      hour < 21 ? "evening" : "night";

    // ---------------------------------------------------------------------------
    // Step 7. Generate Gemini reasoning
    // This runs after we have selected the food so Gemini knows exactly what was picked. We do not let Gemini pick the food.
    // ---------------------------------------------------------------------------
    const reasoning = await generateSpinReasoning(selectedFood, {
      healthGoal: profile.health_goal,
      dietaryStyle: profile.dietary_style,
      mealType: filters.meal_type ?? null,
      timeOfDay,
      pantryMatchUsed,
      region: profile.region,
    });

    // ---------------------------------------------------------------------------
    // Step 8. Record the spin in history
    // Stored after Gemini call to avoid recording if Gemini throws.
    // food_ref is the MongoDB _id. result_name is stored as fallback display.
    // ---------------------------------------------------------------------------
    await pgPool.query(
      `INSERT INTO spin_history
         (user_id, food_ref, result_name, filters_applied, was_accepted)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [
        userId,
        selectedFood._id,
        selectedFood.name,
        JSON.stringify({
          meal_type: filters.meal_type ?? null,
          tags: filters.tags ?? [],
        }),
      ]
    );

    // ---------------------------------------------------------------------------
    // Step 9. Return the result
    // ---------------------------------------------------------------------------
    sendSuccess({
      res,
      data: {
        food: selectedFood,
        reasoning,
        pantry_match: pantryMatchUsed,
        // pantry_match: false tells the frontend to optionally show
        // "showing all options, not just pantry matches"
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/spin/reject
// Called when the user reshuffles (does not accept the spin result).
// Updates the spin history record to mark it as rejected and records the reason if provided. This data improves future suggestions.
// ---------------------------------------------------------------------------
export const rejectSpin = async ( 
  req: Request, res: Response, next: NextFunction 
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { food_ref, rejection_reason } = req.body as {
      food_ref: string;
      rejection_reason?: string;
    };

    if (!food_ref) {
      throw new AppError("food_ref is required", 400, "MISSING_FIELD");
    }

    // Update the most recent spin history record for this food and user
    await pgPool.query(
      `UPDATE spin_history
       SET was_accepted = FALSE,
           rejection_reason = $1
       WHERE user_id = $2
         AND food_ref = $3
         AND spun_at = (
           SELECT MAX(spun_at) FROM spin_history
           WHERE user_id = $2 AND food_ref = $3
         )`,
      [rejection_reason ?? null, userId, food_ref]
    );

    sendSuccess({ res, message: "Spin rejected. Spinning again." });
  } catch (err) {
    next(err);
  }
};