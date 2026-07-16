import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import { searchFoods, getFoodById } from "./food.controller.js";

export const foodRouter = Router();

const searchLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 60,
  keyPrefix: "food:search",
});

foodRouter.use(authenticate);

foodRouter.get("/search", searchLimiter, searchFoods);
foodRouter.get("/:id", searchLimiter, getFoodById); // GET /api/foods/:id