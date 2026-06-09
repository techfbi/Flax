import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema for logging a meal from the food catalogue. food_ref is the MongoDB ObjectId of the food item as a string.
// quantity_grams is how much of the food the user ate. meal_type must match the enum values used in the food catalogue.
// logged_date defaults to today if not provided so users can log a meal they just ate without having to type the date.
// ---------------------------------------------------------------------------
export const createMealLogSchema = z.object({
  food_ref: z
    .string()
    .min(1, "Food reference is required")
    .regex(/^[a-f\d]{24}$/i, "Invalid food reference format"),
    // MongoDB ObjectIds are exactly 24 hex characters.This validation bocks garbage value reaching database

  food_name: z
    .string()
    .min(1, "Food name is required")
    .max(100),
    // Stored directly in the log for display purposes. Avoids a MongoDB lookup every time we render the log list.

  quantity_grams: z
    .number()
    .int("Quantity must be a whole number")
    .min(10, "Quantity must be at least 10 grams")
    .max(3000, "Quantity cannot exceed 3000 grams"),

  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack", "brunch"])
    .describe("Meal type must be breakfast, lunch, dinner, snack, or brunch"),

  logged_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional()
    .transform((val) => val ?? new Date().toISOString().split("T")[0]),
    // If no date provided, default to today in YYYY-MM-DD format.
    // toISOString gives UTC date which is fine for logging purposes.
});

export type CreateMealLogInput = z.infer<typeof createMealLogSchema>;