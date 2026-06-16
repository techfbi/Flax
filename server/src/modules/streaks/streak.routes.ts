import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { getStreaksHandler } from "./streak.controller.js";

export const streakRouter = Router();

streakRouter.use(authenticate);
streakRouter.get("/", getStreaksHandler); //GET /api/streaks/ - Get current streaks for the user