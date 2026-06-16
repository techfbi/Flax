import { z } from "zod";
import { passwordSchema } from "../auth/auth.schema.js";
//---------------------------------------------------------------------------
// Update basic profile fields.
// All fields optional. user can update one or all at once.
export const updateProfileSchema = z.object({
  display_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be under 50 characters")
    .trim()
    .optional(),
  avatar_url: z
    .string()
    .transform((val) => (val.trim() === "" ? null : val)) // Convert empty string to null in case avatar is being removed
    .pipe(z.string().url("Avatar must be a valid URL").nullable()) // Allow null for removing avatar, but if not null it must be a valid URL. runs the response from transform.
    .optional()
    .nullable(),
});
//---------------------------------------------------------------------------

// Update health profile.
// dietary_style and health_goal use string enums so the frontend can render them as dropdowns with exact known values.
export const updateHealthSchema = z.object({
  region: z
    .string()
    .min(2, "Region must be at least 2 characters")
    .max(100)
    .trim()
    .optional(),
  dietary_style: z
    .enum([
      "omnivore",
      "vegetarian",
      "vegan",
      "pescatarian",
      "keto",
      "paleo",
      "halal",
      "kosher",
    ])
    .optional(),
  health_goal: z
    .enum([
      "weight_loss",
      "muscle_gain",
      "weight_gain",
      "maintenance",
      "general_health",
    ])
    .optional(),
  allergies: z
    .array(z.string().min(1).max(50))
    .max(20, "Maximum 20 allergies allowed")
    .optional(),
  health_conditions: z
    .array(z.string().min(1).max(100))
    .max(20, "Maximum 20 conditions allowed")
    .optional(),
  calorie_target: z
    .number()
    .int()
    .min(500, "Calorie target must be at least 500")
    .max(10000, "Calorie target seems too high")
    .optional()
    .nullable(),
  biological_sex: z
    .enum(["male", "female"])
    .optional(),
  activity_level: z
    .enum([
      "sedentary",
      "lightly_active",
      "moderately_active",
      "very_active",
      "extremely_active",
    ])
    .optional(),
  height_cm: z
    .number()
    .int()
    .min(50,  "Height must be at least 50cm")
    .max(300, "Height seems incorrect")
    .optional(),
  weight_kg: z
    .number()
    .min(10,  "Weight must be at least 10kg")
    .max(500, "Weight seems incorrect")
    .optional(),
  age_range: z
    .enum(["18-24", "25-34", "35-44", "45-54", "55-64", "65+"])
    .optional(),
  exact_age: z
    .number()
    .int()
    .min(16,  "Age must be at least 16")
    .max(120, "Age seems incorrect")
    .optional(),

  // Allow user to manually override the auto-calculated water target.
  // If null, the auto-calculated value is used.
  water_target_ml: z
    .number()
    .int()
    .min(500,  "Water target must be at least 500ml")
    .max(8000, "Water target seems too high")
    .optional()
    .nullable(),
});
//---------------------------------------------------------------------------

// Change password. requires current password confirmation so an attacker who hijacks a session cannot silently change credentials.
export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: "New password must be different from your current password",
    path: ["new_password"],
  });
//---------------------------------------------------------------------------

// Delete account. requires password confirmation to prevent accidental or malicious deletion.
export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to delete your account"),
});
//---------------------------------------------------------------------------

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateHealthInput = z.infer<typeof updateHealthSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
