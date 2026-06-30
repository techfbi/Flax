import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { forgotPasswordSchema, type ForgotPasswordSchema } from "./authSchema";
import api from "@/lib/api";
import type { InternalAxiosRequestConfig } from "axios";
import { handleApiError } from "@/utils/handleApiError";

/**
 * Forgot password screen.
 * Left panel: "Reset Password" heading, same rotating bg image, no conveyor items.
 * Right panel: email input + "Send Reset-link" button + "Didn't get link? Resend".
 *
 * On success: shows a confirmation message, no redirect.
 * Resend: re-submits the same email silently.
 * Token arrives via email link → user lands on /reset-password?token=xyz.
 */
const ForgotPasswordForm = () => {
  const [apiError, setApiError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [resending, setResending] = useState(false);
  const [lastEmail, setLastEmail] = useState("");

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const sendLink = async (email: string) => {
    await api.post("/api/auth/forgot-password", { email }, {
      _skipRefresh: true,
    } as InternalAxiosRequestConfig);
  };

  const onSubmit = async (values: ForgotPasswordSchema) => {
    setApiError("");
    try {
      await sendLink(values.email);
      setLastEmail(values.email);
      setSubmitted(true);
      localStorage.removeItem("emailforforgot");
    } catch (err) {
      setApiError(handleApiError(err));
    }
  };

  const handleResend = async () => {
    setResending(true);
    setApiError("");
    try {
      await sendLink(lastEmail || getValues("email"));
    } catch (err) {
      setApiError(handleApiError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout panelHeading="Reset Password" panelItems={[]}>
      {/* API error */}
      {apiError && (
        <p
          className="text-sm text-rose-500 dark:text-rose-700 text-center mb-5"
          role="alert"
        >
          {apiError}
        </p>
      )}

      {!submitted ? (
        /* ── Email entry state ── */
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <Input
            id="email"
            type="email"
            label="Email"
            placeholder="you@email.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isSubmitting}
            className="mt-2"
          >
            Send Reset-link
          </Button>
          <div className="mt-2 flex justify-between px-1">
            <p className="text-sm text-cocoa dark:text-dark-white">
              Didn't get link?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="font-semibold hover:opacity-70 transition-opacity disabled:opacity-40"
              >
                {resending ? "Resending..." : "Resend"}
              </button>
            </p>
            <Link
              to="/login"
              className="font-bold hover:opacity-70 transition-opacity underline"
            >
              Cancel
            </Link>
          </div>
        </form>
      ) : (
        /* ── Success state ── */
        <div className="flex flex-col items-center gap-4 text-center py-4">
          <div className="w-14 h-14 rounded-full bg-moringa/10 dark:bg-moringa-faded/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                stroke="#2F5D4B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-sm text-cocoa dark:text-dark-white leading-relaxed">
            We sent a reset link to <strong>{lastEmail}</strong>. Check your
            inbox and follow the link to set a new password.
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-sm font-semibold text-cocoa dark:text-dark-white hover:opacity-70 transition-opacity disabled:opacity-40"
          >
            {resending ? "Resending..." : "Didn't get it? Resend"}
          </button>
        </div>
      )}
    </AuthLayout>
  );
};

export default ForgotPasswordForm;
