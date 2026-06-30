import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { resetPasswordSchema, type ResetPasswordSchema } from "./authSchema";
import api from "@/lib/api";
import type { InternalAxiosRequestConfig } from "axios";
import { handleApiError } from "@/utils/handleApiError";

/**
 * Reset password screen. user arrives here from the email link.
 * URL: /reset-password?token=xyz
 *
 * Token is read silently from URL via useSearchParams().
 * User only types new password + confirm. Token never shown in UI.
 * On success: redirect to /login with a success message in state.
 *
 */
const ResetPasswordForm = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");

  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // If no token in URL, show an error. link is invalid or expired
  if (!token) {
    return (
      <AuthLayout panelHeading="Reset Password" panelItems={[]}>
        <div className="text-center py-8">
          <p className="text-sm text-rose-500 dark:text-rose-700 mb-4">
            This reset link is invalid or has expired.
          </p>
          <button
            onClick={() => navigate("/forgot-password")}
            className="text-sm font-semibold text-cocoa dark:text-dark-white hover:opacity-70 transition-opacity"
          >
            Request a new link
          </button>
        </div>
      </AuthLayout>
    );
  }

  const onSubmit = async (values: ResetPasswordSchema) => {
    setApiError("");
    try {
      await api.post(
        "/api/auth/reset-password",
        // confirm_password never sent, frontend only
        { token, password: values.password, confirm_password: values.password },
        { _skipRefresh: true } as InternalAxiosRequestConfig,
      );
      // On success go to login with a success flag
      navigate("/login?resetPassword=true", { state: { resetSuccess: true } });
    } catch (err: unknown) {
      setApiError(handleApiError(err));
    }
  };

  return (
    <AuthLayout panelHeading="Reset Password" panelItems={[]}>
      {/* Top-level error , matches design (error at top, not field level) */}
      {(apiError ||
        errors.password?.message ||
        errors.confirmPassword?.message) && (
        <p
          className="text-sm text-rose-500 dark:text-rose-700 text-center mb-5"
          role="alert"
        >
          {apiError ||
            errors.password?.message ||
            errors.confirmPassword?.message}
        </p>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Input
          id="password"
          type="password"
          label="New password"
          placeholder=""
          autoComplete="new-password"
          // No field-level error shown, surfaced at top instead
          {...register("password")}
        />

        <Input
          id="confirmPassword"
          type="password"
          label="confirm new password"
          placeholder=""
          autoComplete="new-password"
          {...register("confirmPassword")}
        />

        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={isSubmitting}
          className="mt-2"
        >
          Reset Password
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ResetPasswordForm;
