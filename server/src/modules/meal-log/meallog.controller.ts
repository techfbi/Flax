import type { Request, Response, NextFunction } from "express";
import {
  createMealLog,
  getMealLogs,
  deleteMealLog,
  getDashboardData,
} from "./meallog.service.js";
import { sendSuccess } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
import type { CreateMealLogInput } from "./meallog.schema.js";

// ---------------------------------------------------------------------------
// POST /api/meal-logs
// Logs a meal from the food catalogue for the authenticated user.
// Nutrition values are calculated server-side from the food catalogue data.
// The client sends food_ref, food_name, quantity_grams, meal_type, and optionally logged_date. Everything else is computed here.
// ---------------------------------------------------------------------------
export const logMeal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as CreateMealLogInput;
    const log = await createMealLog(req.user!.id, input);

    sendSuccess({
      res,
      statusCode: 201,
      message: "Meal logged successfully.",
      data: { log },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/meal-logs?date=YYYY-MM-DD
// Returns all meal logs for the authenticated user on the given date.If no date query param is provided, defaults to today.
// ---------------------------------------------------------------------------
export const getLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // date comes from query string not body. e.g. /api/meal-logs?date=2026-06-07
    const date = req.query.date as string | undefined;

    // Validate date format if provided
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError(
        "Date must be in YYYY-MM-DD format",
        400,
        "INVALID_DATE_FORMAT"
      );
    }

    const logs = await getMealLogs(req.user!.id, date);

    sendSuccess({
      res,
      data: { logs, date: date ?? new Date().toISOString().split("T")[0] },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/meal-logs/:id
// Deletes a specific meal log entry.The service verifies the log belongs to the authenticated user.
// ---------------------------------------------------------------------------
export const deleteLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const logId = req.params.id as string;

    if (!logId) {
      throw new AppError("Log ID is required", 400, "MISSING_ID");
    }

    await deleteMealLog(req.user!.id, logId);

    sendSuccess({ res, message: "Meal log deleted." });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/meal-logs/dashboard?date=YYYY-MM-DD
// Returns the full dashboard data for the authenticated user.
// Includes daily totals, breakdown by meal type, calorie target, and 7-day weekly trend. If no date provided, defaults to today.
// ---------------------------------------------------------------------------
export const getDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const date = req.query.date as string | undefined;

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError(
        "Date must be in YYYY-MM-DD format",
        400,
        "INVALID_DATE_FORMAT"
      );
    }

    const dashboard = await getDashboardData(req.user!.id, date);

    sendSuccess({ res, data: { dashboard } });
  } catch (err) {
    next(err);
  }
};