import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { flagMealSchema } from "./spin.schema.js";
import {
  getFilters,
  flagMealHandler,
  getFlaggedHandler,
  unflagMealHandler,
} from "./spin.controller.js";

export const spinRouter = Router();

// All spin routes require authentication
spinRouter.use(authenticate);

// Returns available filter options for the user's region
spinRouter.get("/filters", getFilters);

// Flagging system
spinRouter.post("/flag", validate(flagMealSchema), flagMealHandler);
spinRouter.get("/flagged", getFlaggedHandler);
spinRouter.delete("/flag/:flagId", unflagMealHandler);
