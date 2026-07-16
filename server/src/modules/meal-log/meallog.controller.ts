import type { Request, Response, NextFunction } from "express";
import {
  createCatalogueMealLog,
  createCustomMealLog,
  getMealLogs,
  deleteMealLog,
  getDashboardData,
  updateMealLog,
} from "./meallog.service.js";
import { sendSuccess } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
import {
  catalogueMealLogSchema,
  customMealLogSchema,
  patchMealLogSchema,
} from "./meallog.schema.js";
import { estimateNutritionSchema } from "./meallog.schema.js";
import { estimateNutrition } from "./nutritionEstimate.service.js";
import { getInsights, getStreakCalendar } from "./insights.service.js";

// ---------------------------------------------------------------------------
// POST /api/meal-logs
// Accepts both catalogue and custom meal logs in one endpoint. The presence of food_ref in the body determines which path is taken.
// ---------------------------------------------------------------------------
export const logMeal = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    // food_ref present means from catalogue. custom_name present means from custom.
    // If neither is present we return a clear error rather than letting the validation fail with a confusing message.
    const isCatalogue = typeof req.body?.food_ref === "string" && req.body.food_ref.length > 0;
    const isCustom    = typeof req.body?.custom_name === "string" && req.body.custom_name.length > 0;

    if (!isCatalogue && !isCustom) {
      throw new AppError(
        "Pick either from catalogue meal or input a custom meal.",
        400,
        "MISSING_MEAL_IDENTIFIER"
      );
    }

    if (isCatalogue && isCustom) {
      throw new AppError(
        "Choose either a catalogue meal or a custom meal, not both.",
        400,
        "AMBIGUOUS_MEAL_SOURCE"
      );
    }

    if (isCatalogue) {
      // Validate against the catalogue schema then call the catalogue service.
      const parsed = catalogueMealLogSchema.safeParse(req.body); // using safeparse() instead of parse() to get back structured response from zod.
      if (!parsed.success) {
        throw new AppError(
          parsed.error.issues[0]?.message ?? "Invalid input",
          400,
          "VALIDATION_ERROR"
        );
      }
      const log = await createCatalogueMealLog(req.user!.id, parsed.data);
      sendSuccess({ res, statusCode: 201, message: "Meal logged successfully.", data: { log } });
      return;
    }

    // Custom path. validate and call the custom service.
    const parsed = customMealLogSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? "Invalid input",
        400,
        "VALIDATION_ERROR"
      );
    }
    const log = await createCustomMealLog(req.user!.id, parsed.data);
    sendSuccess({ res, statusCode: 201, message: "Meal logged successfully.", data: { log } });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/meal-logs?date=YYYY-MM-DD
// Returns all logs for the authenticated user on the given date. Defaults to today if no date param is provided.
// ---------------------------------------------------------------------------
export const getLogs = async (
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
// Deletes a specific log entry. Service verifies ownership.
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
// Returns daily totals, meal type breakdown, calorie target, and 7-day trend.
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


// ---------------------------------------------------------------------------
// PATCH /api/meal-logs/:id
// Edits quantity_grams or meal_type on an existing log entry.
// Nutrition values are recalculated automatically when quantity changes.
// ---------------------------------------------------------------------------
export const patchLog = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const logId = req.params.id as string;

    if (!logId) {
      throw new AppError("Log ID is required.", 400, "MISSING_ID");
    }

    const parsed = patchMealLogSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? "Invalid input.",
        400,
        "VALIDATION_ERROR"
      );
    }

    const log = await updateMealLog(req.user!.id, logId, parsed.data);

    sendSuccess({
      res,
      message: "Meal log updated.",
      data: { log },
    });
  } catch (err) {
    next(err);
  }
};

//----------------------------------------------------------------------------------------------------------------------
//Get Insights and streak calender
//----------------------------------------------------------------------------------------------------------------------
export const getInsightsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const range = (req.query.range as string) ?? "week";
    const endDate = (req.query.end_date as string) ?? new Date().toISOString().split("T")[0];

    if (!["week", "month", "year"].includes(range)) {
      throw new AppError("range must be week, month, or year", 400, "INVALID_RANGE");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new AppError("end_date must be YYYY-MM-DD", 400, "INVALID_DATE_FORMAT");
    }

    const insights = await getInsights(req.user!.id, range as "week" | "month" | "year", endDate);
    sendSuccess({ res, data: { insights } });
  } catch (err) {
    next(err);
  }
};

export const getStreakCalendarHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const month = (req.query.month as string) ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError("month must be YYYY-MM", 400, "INVALID_MONTH_FORMAT");
    }
    const calendar = await getStreakCalendar(req.user!.id, month);
    sendSuccess({ res, data: { calendar } });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/meal-logs/estimate
// Log with Noura. Given a meal name and a quantity in grams, returns
// an estimated calories and macro breakdown for that exact portion.
// ---------------------------------------------------------------------------
export const estimateNutritionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = estimateNutritionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? "Invalid request data",
        400,
        "VALIDATION_ERROR"
      );
    }

   const estimate = await estimateNutrition(parsed.data.name, {
      grams: parsed.data.grams,
      quantity_description: parsed.data.quantity_description,
    });
    sendSuccess({ res, data: { estimate } });
  } catch (err) {
    next(err);
  }
};