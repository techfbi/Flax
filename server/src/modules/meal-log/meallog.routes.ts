import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import { createMealLogSchema } from "./meallog.schema.js";
import {
  logMeal,
  getLogs,
  deleteLog,
  getDashboard,
} from "./meallog.controller.js";

export const mealLogRouter = Router();

// Dedicated rate limiter for meal logging.
// Prevents scripted bulk logging that could pollute nutrition data.
const mealLogLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 20, // 20 req per minute.
  keyPrefix: "meal-log:create",
});

// All meal log routes require authentication
mealLogRouter.use(authenticate);

// IMPORTANT. dashboard route must be defined BEFORE /:id routes.
mealLogRouter.get("/dashboard", getDashboard);

mealLogRouter.get("/", getLogs);
mealLogRouter.post("/", mealLogLimiter, validate(createMealLogSchema), logMeal);
mealLogRouter.delete("/:id", deleteLog);