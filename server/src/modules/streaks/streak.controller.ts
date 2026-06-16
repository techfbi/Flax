import type { Request, Response, NextFunction } from "express";
import { getStreaks } from "./streak.service.js";
import { sendSuccess } from "../../shared/response.js";

export const getStreaksHandler = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const streaks = await getStreaks(req.user!.id);
    sendSuccess({ res, data: { streaks } });
  } catch (err) {
    next(err);
  }
};