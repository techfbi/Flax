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
