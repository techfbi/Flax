import { z } from "zod";

// ---------------------------------------------------------------------------
// Catalogue meal log schema.
// User picks a food from the catalogue (spin result or search).
// Nutrition is calculated server-side from MongoDB. user cannot override it. food_ref is the MongoDB ObjectId. food_name is stored for display.
// ---------------------------------------------------------------------------
export const catalogueMealLogSchema = z.object({
  food_ref: z
    .string()
    .min(1, "Food reference is required")
    .regex(/^[a-f\d]{24}$/i, "Invalid food reference format"),

  food_name: z
    .string()
    .min(1, "Food name is required")
    .max(100),

  quantity_grams: z
    .number()
    .int("Quantity must be a whole number")
    .min(10, "Quantity must be at least 10 grams")
    .max(3000, "Quantity cannot exceed 3000 grams"),

  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack", "brunch"]),

 logged_date: z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .optional()
  .transform((val) => val ?? new Date().toISOString().split("T")[0])
});

// ---------------------------------------------------------------------------
// Custom meal log schema.
// User types a meal name that is not in the catalogue. Nutrition values are optional. if not provided they are stored as 0
// and the log is considered nutritionally untracked. We accept per-100g values and scale them by quantity_grams server-side,
// exactly the same calculation as catalogue logs. This keeps the dashboard aggregation consistent regardless of source.
// ---------------------------------------------------------------------------
export const customMealLogSchema = z.object({
  custom_name: z
    .string()
    .min(1, "Meal name is required")
    .max(100, "Meal name cannot exceed 100 characters")
    .transform((val) => val.trim()),

  quantity_grams: z
    .number()
    .int("Quantity must be a whole number")
    .min(10, "Quantity must be at least 10 grams")
    .max(3000, "Quantity cannot exceed 3000 grams"),

  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack", "brunch"]),

  logged_date: z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .optional()
  .transform((val) => val ?? new Date().toISOString().split("T")[0]),

  // Nutrition values are per 100g, matching the catalogue convention.
  // All optional. default to 0 if not provided.
  calories_per_100g: z.number().min(0).max(10000).optional().default(0),
  protein_g:         z.number().min(0).max(1000).optional().default(0),
  carbs_g:           z.number().min(0).max(1000).optional().default(0),
  fat_g:             z.number().min(0).max(1000).optional().default(0),
});

// ---------------------------------------------------------------------------
// Patch schema for editing an existing meal log entry. Only quantity_grams and meal_type are editable.
// We make both fields optional individually, then add a .refine() to enforce that at least one is present.
// ---------------------------------------------------------------------------
export const patchMealLogSchema = z
  .object({
    quantity_grams: z
      .number()
      .int("Quantity must be a whole number")
      .min(10, "Quantity must be at least 10 grams")
      .max(3000, "Quantity cannot exceed 3000 grams")
      .optional(),

    meal_type: z
      .enum(["breakfast", "lunch", "dinner", "snack", "brunch"])
      .optional(),
  })
  .refine(
    (data) => data.quantity_grams !== undefined || data.meal_type !== undefined,
    {
      message: "Provide at least one field to update. quantity grams or meal type.",
    }
  );

  // ---------------------------------------------------------------------------
// Estimate schema, for the Log with Noura flow. Just a name and a
// quantity, the AI fills in the rest.
// ---------------------------------------------------------------------------
export const estimateNutritionSchema = z
  .object({
    name: z
      .string()
      .min(1, "Meal name is required")
      .max(100, "Meal name cannot exceed 100 characters")
      .transform((val) => val.trim()),

    grams: z
      .number()
      .int("Quantity must be a whole number")
      .min(10, "Quantity must be at least 10 grams")
      .max(3000, "Quantity cannot exceed 3000 grams")
      .optional(),

    quantity_description: z
      .string()
      .min(1, "Quantity description cannot be empty")
      .max(100, "Quantity description cannot exceed 100 characters")
      .transform((val) => val.trim())
      .optional(),
  })
  .refine((data) => data.grams !== undefined || data.quantity_description !== undefined, {
    message: "Provide either an exact gram amount or a quantity description",
  });

export type EstimateNutritionInput = z.infer<typeof estimateNutritionSchema>;
export type PatchMealLogInput = z.infer<typeof patchMealLogSchema>;
export type CatalogueMealLogInput = z.infer<typeof catalogueMealLogSchema>;
export type CustomMealLogInput = z.infer<typeof customMealLogSchema>;