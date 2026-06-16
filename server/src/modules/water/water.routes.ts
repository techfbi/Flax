import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import { logWaterHandler, getWaterLogsHandler, deleteWaterLogHandler } from "./water.controller.js";

export const waterRouter = Router();

const waterLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 30,
  keyPrefix: "water:log",
});

waterRouter.use(authenticate);

waterRouter.post("/", waterLimiter, logWaterHandler); //POST /api/water/ - Log water intake
waterRouter.get("/", getWaterLogsHandler); //GET /api/water/?date=YYYY-MM-DD - Get water logs for a specific date (optional, defaults to today)
waterRouter.delete("/:id", deleteWaterLogHandler); //DELETE /api/water/:id - Delete a specific water log