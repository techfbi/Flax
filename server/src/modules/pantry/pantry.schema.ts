import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema for adding a new pantry item.
// Name is normalised to lowercase before storage so "Tomato" and "tomato" are treated as the same item. The UNIQUE constraint on (user_id, name)
// enforces this at the database level.
// ---------------------------------------------------------------------------
export const addPantryItemSchema = z.object({
  name: z
        .string()
    .min(2, "Ingredient name must be at least 2 characters")
    .max(50, "Ingredient name must be under 50 characters")
    .trim()
    .refine((val) => !/\p{Extended_Pictographic}/u.test(val), {
      message: "Ingredient name cannot contain emoji",
    })
    .refine((val) => /[a-zA-Z]/.test(val), {
      message: "Ingredient name must contain at least one letter",
    })
    .toLowerCase(),
});

// ---------------------------------------------------------------------------
// Schema for updating an existing pantry item. Same rules as adding. the id comes from the URL param not the body.
// ---------------------------------------------------------------------------
export const updatePantryItemSchema = z.object({
  name: z
    .string()
    .min(2, "Ingredient name must be at least 2 characters")
    .max(50, "Ingredient name must be under 50 characters")
    .trim()
    .toLowerCase(),
});

export type AddPantryItemInput = z.infer<typeof addPantryItemSchema>;
export type UpdatePantryItemInput = z.infer<typeof updatePantryItemSchema>;