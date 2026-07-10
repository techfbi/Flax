import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import {
  logMeal,
  getLogs,
  deleteLog,
  getDashboard,
  patchLog,
  getInsightsHandler, 
  getStreakCalendarHandler
} from "./meallog.controller.js";

export const mealLogRouter = Router();

// Dedicated rate limiter for meal logging.
const mealLogLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 20, // 20 req per minute.
  keyPrefix: "meal-log:create",
});

// All meal log routes require authentication
mealLogRouter.use(authenticate);

mealLogRouter.get("/dashboard", getDashboard);
mealLogRouter.get("/", getLogs);
mealLogRouter.post("/", mealLogLimiter, logMeal); // Validation now happens in the controller since we have two different schemas based on the presence of food_ref or custom_name in the request body.
mealLogRouter.patch("/:id", patchLog);
mealLogRouter.delete("/:id", deleteLog);
mealLogRouter.get("/insights", getInsightsHandler); // GET /api/meal-logs/insights?range=week|month|year&end_date=YYYY-MM-DD
mealLogRouter.get("/streak-calendar", getStreakCalendarHandler); // GET /api/meal-logs/streak-calendar?month=YYYY-MM