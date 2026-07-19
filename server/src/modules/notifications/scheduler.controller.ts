import type { Request, Response, NextFunction } from "express";
import { runScheduledChecks } from "./notification.events.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";

// ---------------------------------------------------------------------------
// POST /internal/run-scheduled-checks
//
// Triggered externally, an outside scheduler pings this on a timer,
// instead of the old setInterval that used to run inside this process
// forever,  This only does real work the moment something calls it, the
// process itself does nothing on its own in between.
// ---------------------------------------------------------------------------
export const runScheduledChecksHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const providedSecret = req.headers["x-scheduler-secret"];
    if (providedSecret !== env.SCHEDULER_SECRET) {
      throw new AppError("Unauthorized", 401, "INVALID_SCHEDULER_SECRET");
    }

    await runScheduledChecks();
    res.status(200).json({ success: true, message: "Scheduled checks completed" });
  } catch (err) {
    next(err);
  }
};