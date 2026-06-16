import type { Request, Response, NextFunction } from "express";
import { logWater, getWaterLogs, deleteWaterLog } from "./water.service.js";
import { logWaterSchema } from "./water.schema.js";
import { sendSuccess } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";

export const logWaterHandler = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const parsed = logWaterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.issues[0]?.message ?? "Invalid input.",
        400,
        "VALIDATION_ERROR"
      );
    }

    const result = await logWater(req.user!.id, parsed.data);

    sendSuccess({
      res,
      statusCode: 201,
      message: "Water intake logged.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getWaterLogsHandler = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const date = req.query.date as string | undefined;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError("Date must be YYYY-MM-DD.", 400, "INVALID_DATE");
    }

    const data = await getWaterLogs(req.user!.id, date);
    sendSuccess({ res, data });
  } catch (err) {
    next(err);
  }
};

export const deleteWaterLogHandler = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    await deleteWaterLog(req.user!.id, req.params.id as string);
    sendSuccess({ res, message: "Water log deleted." });
  } catch (err) {
    next(err);
  }
};