import { z } from "zod";

export const flagMealSchema = z.object({
  food_ref: z.string().min(1, "Food reference is required"),
  food_name: z.string().min(1, "Food name is required"),
});

export type FlagMealInput = z.infer<typeof flagMealSchema>;