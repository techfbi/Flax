import type { Request, Response, NextFunction } from "express";
import { getStreaks, restoreStreak } from "./streak.service.js";
import { sendSuccess } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";

export const getStreaksHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const today = req.query.date as string | undefined;
    if (today && !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      throw new AppError("Date must be in YYYY-MM-DD format", 400, "INVALID_DATE_FORMAT");
    }
    const streaks = await getStreaks(req.user!.id, today ?? new Date().toISOString().split("T")[0]);
    sendSuccess({ res, data: { streaks } });
  } catch (err) {
    next(err);
  }
};

export const restoreStreakHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type, date } = req.body as { type?: string; date?: string };
    if (type !== "goal" && type !== "water") {
      throw new AppError("type must be goal or water", 400, "INVALID_STREAK_TYPE");
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError("Date must be in YYYY-MM-DD format", 400, "INVALID_DATE_FORMAT");
    }
    const streaks = await restoreStreak(
      req.user!.id,
      type,
      date ?? new Date().toISOString().split("T")[0]
    );
    sendSuccess({ res, data: { streaks } });
  } catch (err) {
    next(err);
  }
};