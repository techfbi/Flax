import type { Request, Response, NextFunction } from "express";
import { pgPool } from "../../config/db.postgres.js";
import { sendSuccess } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
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
