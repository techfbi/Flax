import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { getStreaksHandler, restoreStreakHandler } from "./streak.controller.js";

export const streakRouter = Router();

streakRouter.use(authenticate);
streakRouter.get("/", getStreaksHandler); //GET /api/streaks/?date=YYYY-MM-DD
streakRouter.post("/restore", restoreStreakHandler); //POST /api/streaks/restore { type, date }