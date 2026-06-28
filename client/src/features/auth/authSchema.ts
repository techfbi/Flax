import { z } from 'zod'

/* ── Register ────────────────────────────────────────────────── */
export const registerSchema = z
  .object({
    displayName: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name must be under 50 characters'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must include an uppercase letter')
      .regex(/[0-9]/, 'Password must include a number')
      .regex(/[^A-Za-z0-9]/, 'Password must include a special character'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export type RegisterSchema = z.infer<typeof registerSchema>

/* ── Login ───────────────────────────────────────────────────── */
export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

export type LoginSchema = z.infer<typeof loginSchema>

/* ── Forgot password ─────────────────────────────────────────── */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>

/* ── Reset password ──────────────────────────────────────────── */
export const resetPasswordSchema = z
  .object({
    // token comes from URL — not user input, not sent through form state
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must include an uppercase letter')
      .regex(/[0-9]/, 'Password must include a number')
      .regex(/[^A-Za-z0-9]/, 'Password must include a special character'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>

/* ── OTP verification ────────────────────────────────────────── */
export const otpSchema = z.object({
  // pendingId is numeric — stored in component state, not form field
  otp: z
    .string()
    .length(6, 'Enter the full 6-digit code')
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
})

export type OtpSchema = z.infer<typeof otpSchema>