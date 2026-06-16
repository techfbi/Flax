import { z } from "zod";

export const logWaterSchema = z.object({
  amount_ml: z
    .number()
    .int("Amount must be a whole number of millilitres")
    .min(50,   "Minimum log is 50ml")
    .max(2000, "Maximum single log is 2000ml"),

  logged_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional()
    .transform((val) => val ?? new Date().toISOString().split("T")[0]),
});

export const setWaterTargetSchema = z.object({
  water_target_ml: z
    .number()
    .int()
    .min(500,  "Target must be at least 500ml")
    .max(8000, "Target seems too high")
    .nullable(),
});

export type LogWaterInput       = z.infer<typeof logWaterSchema>;
export type SetWaterTargetInput = z.infer<typeof setWaterTargetSchema>;