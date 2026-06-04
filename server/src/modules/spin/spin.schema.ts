import { z } from "zod";

// Schema for flagging a meal as "do not show anymore".
// Requires both the MongoDB ObjectId of the food and its name.
// The name is stored denormalised in the flagged_meals table so we can display the list of flagged meals to the user without a MongoDB lookup.

export const flagMealSchema = z.object({
  food_ref: z.string().min(1, "Food reference is required"),
  food_name: z.string().min(1, "Food name is required"),
});

export type FlagMealInput = z.infer<typeof flagMealSchema>;