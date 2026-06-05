import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import { addPantryItemSchema, updatePantryItemSchema } from "./pantry.schema.js";
import { getPantry, addItem, updateItem, deleteItem } from "./pantry.controller.js";

export const pantryRouter = Router();

// Dedicated rate limiter for pantry mutations.
// Prevents bulk scripted adds trying to overflow the limit check.
const pantryMutateLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 30,
  keyPrefix: "pantry:mutate",
});

// All pantry routes require authentication
pantryRouter.use(authenticate);

// GET /api/pantry  returns all items
pantryRouter.get("/", getPantry);

// POST /api/pantry  adds a new item
pantryRouter.post("/", pantryMutateLimiter, validate(addPantryItemSchema), addItem);

// PATCH /api/pantry/:id  updates an item name
pantryRouter.patch("/:id", pantryMutateLimiter, validate(updatePantryItemSchema), updateItem);

// DELETE /api/pantry/:id  removes an item
pantryRouter.delete("/:id", pantryMutateLimiter, deleteItem);