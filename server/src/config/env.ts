//This code is a safe environment variable validator using Zod.
//It checks whether all our .env variables exist and are valid BEFORE our app starts.

import { z } from "zod";

//This creates a validation blueprint. What environment variables should exist and what rules they must follow.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().url(),
  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  USDA_API_KEY: z.string().min(1),
  MEDIA_BASE_URL: z.string().url(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1),
  CLIENT_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  // Controls whether email OTP verification is required on registration.
  // Set to "false" in development to test with non-existing emails freely.Set to "true" in production.
  REQUIRE_EMAIL_VERIFICATION: z
  .enum(["true", "false"]) // env must only takein "true" or "false" as string.
  .default("false") // if that env doesnt exist, default to false to avoid app crash
  .transform((val) => val === "true"), // transform the string "true"/"false" into actual boolean true/false for use in our code. bcos all env vars are strings by default.
});

const parsed = envSchema.safeParse(process.env); //parse returns an error immediately but safeparse returns an object like success: true/false and data.

if (!parsed.success) {
  console.error("==================================================");
  console.error("FATAL: Invalid or missing environment variables:");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)); //This displays readable errors.
  console.error("==================================================");
  process.exit(1);
}

export const env = parsed.data;