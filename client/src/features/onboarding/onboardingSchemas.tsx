import { z } from "zod";

/**
 * Zod schemas for each onboarding step.
 * z.enum() in Zod v4 no longer accepts required_error.
 * Validation is handled at the component level — all fields are optional
 * since the user can skip steps. Final submission uses the combined shape.
 */

export const step1Schema = z.object({
  healthGoal: z
    .enum([
      "weight_loss",
      "muscle_gain",
      "weight_gain",
      "maintenance",
      "general_health",
    ])
    .optional(),
});

export const step2Schema = z.object({
  dietaryStyle: z
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
    .nullable()
    .optional(),
});

export const step3Schema = z.object({
  activityLevel: z
    .enum([
      "sedentary",
      "lightly_active",
      "moderately_active",
      "very_active",
      "extremely_active",
    ])
    .optional(),
});

export const step4Schema = z.object({
  biologicalSex: z.enum(["male", "female"]),
  ageRange: z.enum(["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]),
  region: z.string().min(1, "Please select a region"),
  heightCm: z
    .number({ error: "Enter a valid height" })
    .min(50, "Height must be at least 50cm")
    .max(300, "Height must be under 300cm"),
  weightKg: z
    .number({ error: "Enter a valid weight" })
    .min(10, "Weight must be at least 10kg")
    .max(500, "Weight must be under 500kg"),
});

export type Step1Schema = z.infer<typeof step1Schema>;
export type Step2Schema = z.infer<typeof step2Schema>;
export type Step3Schema = z.infer<typeof step3Schema>;
export type Step4Schema = z.infer<typeof step4Schema>;
