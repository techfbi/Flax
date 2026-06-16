import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { flagMealSchema } from "./spin.schema.js";
import { z } from "zod"; // Added zod schema for spin req body
import { spinLimiter } from "../../middleware/rateLimiter.js";
import {
  getFilters,
  flagMealHandler,
  getFlaggedHandler,
  unflagMealHandler,
  spin,
  rejectSpin,
  validateMealHandler, 
  unvalidateMealHandler,
  getSpinHistoryHandler,
} from "./spin.controller.js";

export const spinRouter = Router();

//schema for spin
const spinRequestSchema = z.object({
  meal_type: z
    .enum(["breakfast", "lunch", "dinner", "snack", "brunch"])
    .optional(),
  tags: z.array(z.string().min(1)).max(5).optional(),
});

const rejectSpinSchema = z.object({
  food_ref: z.string().min(1, "food_ref is required"),
  rejection_reason: z.string().max(200).optional(),
});

// All spin routes require authentication
spinRouter.use(authenticate);

// Returns available filter options for the user's region
spinRouter.get("/filters", getFilters); //GET /api/spin/filters

// Spin system
spinRouter.post("/", spinLimiter, validate(spinRequestSchema), spin); // POST /api/spin
spinRouter.post("/reject", validate(rejectSpinSchema), rejectSpin);   // POST /api/spin/reject

// History
spinRouter.get("/history", getSpinHistoryHandler); // GET /api/spin/history?days=2

// Flagging system
spinRouter.post("/flag", validate(flagMealSchema), flagMealHandler); // POST /api/spin/flag
spinRouter.get("/flagged", getFlaggedHandler); // GET /api/spin/flagged
spinRouter.delete("/flag/:flagId", unflagMealHandler); // DELETE /api/spin/flag/:flagId

// Validation system i.e thumbs up liked meals that should be prioritised in future spins
spinRouter.post("/validate", validateMealHandler);
spinRouter.delete("/validate/:foodRef", unvalidateMealHandler);
