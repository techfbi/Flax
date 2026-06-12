import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import { searchFoods } from "./food.controller.js";

export const foodRouter = Router();

// Moderate rate limit. search is a read-only MongoDB operation but regex queries are more expensive than indexed lookups so we protect it.
const searchLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 30,
  keyPrefix: "food:search",
});

foodRouter.use(authenticate);

foodRouter.get("/search", searchLimiter, searchFoods);