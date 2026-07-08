import type { Request, Response, NextFunction } from "express";
import { pgPool } from "../../config/db.postgres.js";
import { sendSuccess } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
import { getExcludedFoodRefs, getFoodsForSpin, generateSpinReasoning, SpinFilters, pickFoodByHealthGoal, getValidatedFoodRefs } from "./spin.service.js";
import { validateMeal, unvalidateMeal, getSpinHistory } from "./spin.service.js";
import {
  getAvailableFilters,
  flagMeal,
  getFlaggedMeals,
  unflagMeal,
} from "./spin.service.js";
import { type FlagMealInput } from "./spin.schema.js";
import { equal } from "assert";

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
    console.log("[REMOVE LOG LATER: The spin req body: ", req.body)

    // ---------------------------------------------------------------------------
    // Step 1. Get user profile data needed for filtering and Groq context
    // ---------------------------------------------------------------------------
    const [profileResult, excludeIds, validatedRefs] = await Promise.all([
      pgPool.query(
        `SELECT hp.region, hp.dietary_style, hp.health_goal, hp.allergies, hp.health_conditions
        FROM health_profiles hp
        WHERE hp.user_id = $1`,
        [userId]
      ),
      getExcludedFoodRefs(userId),
      getValidatedFoodRefs(userId),
    ]);

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
    // Step 3. Get filtered food list
    // ---------------------------------------------------------------------------
    const { foods, pantryMatchUsed, recencyRelaxed } = await getFoodsForSpin(
      profile.region,
      filters,
      profile.allergies ?? [],
      excludeIds,
      userId
    );

      // Then pass validatedRefs to pickFoodByHealthGoal:
    const selectedFood = pickFoodByHealthGoal(foods, profile.health_goal, validatedRefs);

    // ---------------------------------------------------------------------------
    // Step 4. Determine time of day for Groq context
    // ---------------------------------------------------------------------------
    const hour = new Date().getHours();
    const timeOfDay =
      hour < 12 ? "morning" :
      hour < 17 ? "afternoon" :
      hour < 21 ? "evening" : "night";

    // ---------------------------------------------------------------------------
    // Step 5. Generate Groq reasoning
    // This runs after we have selected the food so Groq knows exactly what was picked. We do not let Groq pick the food.
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
    // Step 6. Record the spin in history
    // Stored after Groq call to avoid recording if Groq throws.
    // food_ref is the MongoDB _id. result_name is stored as fallback display.
    // ---------------------------------------------------------------------------
    await pgPool.query(
    `INSERT INTO spin_history
      (user_id, food_ref, result_name, result_description, filters_applied, was_accepted)
    VALUES ($1, $2, $3, $4, $5, TRUE)`,
    [
        userId,
        selectedFood._id,
        selectedFood.name,
        selectedFood.description ?? null,
        JSON.stringify({
          meal_type: filters.meal_type ?? null,
          tags: filters.tags ?? [],
        }),
      ]
    );

    // ---------------------------------------------------------------------------
    // Step 7. Return the result
    // ---------------------------------------------------------------------------
    sendSuccess({
      res,
      data: {
        food: selectedFood,
        reasoning,
        pantry_match: pantryMatchUsed,
        recencyRelaxed: recencyRelaxed,
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

// ---------------------------------------------------------------------------
// POST /api/spin/validate
// Records a thumbs up on a spun meal. Idempotent.
// ---------------------------------------------------------------------------
export const validateMealHandler = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { food_ref, food_name } = req.body as { food_ref: string; food_name: string };

    if (!food_ref || !food_name) {
      throw new AppError("food reference and name are required.", 400, "MISSING_FIELDS");
    }

    await validateMeal(req.user!.id, food_ref, food_name);
    sendSuccess({ res, message: "Liked meal. It will be prioritised in your future spins." });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/spin/validate/:foodRef
// Removes a thumbs up reaction from a meal.
// ---------------------------------------------------------------------------
export const unvalidateMealHandler = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const foodRef = req.params.foodRef as string;

    if (!foodRef) {
      throw new AppError("Food reference is required.", 400, "MISSING_FIELDS");
    }

    await unvalidateMeal(req.user!.id, foodRef);
    sendSuccess({ res, message: "Liked meal removed." });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/spin/history
// Returns spin history for the last N days. default 2 days for UI display.
// Frontend uses this to render the spin history section and enable logging a previously spun meal directly from history.
// ---------------------------------------------------------------------------
export const getSpinHistoryHandler = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const daysRaw = parseInt(req.query.days as string, 10);
    // Clamp between 1 and 7. 7 is our max retention window.
    const days = isNaN(daysRaw) ? 2 : Math.min(Math.max(daysRaw, 1), 7);

    const history = await getSpinHistory(req.user!.id, days);

    sendSuccess({ res, data: { history, days } });
  } catch (err) {
    next(err);
  }
};