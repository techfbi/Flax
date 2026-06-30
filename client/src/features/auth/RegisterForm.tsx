import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GoogleButton } from "./GoogleButton";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { registerSchema, type RegisterSchema } from "./authSchema";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse, RegisterData } from "@/types/apiTypes";
import { SecondAuthLayout } from "@/components/layout/SecondAuthLayout";
import { handleApiError } from "@/utils/handleApiError";
import { resolvePostAuthRoute } from "@/utils/resolvePostAuthRoute";

/**
 * Register page.
 * Left panel: "Let's get the journey started!" with conveyor items.
 * Right panel: name + email + password + confirm password + create account.
 *
 * On success: if requiresVerification, go to /verify-otp with pendingId in state.
 *             otherwise, setAuth and go to /onboarding.
 * On Google: redirect to Google consent page (OAuth Pattern B).
 */

// Conveyor belt texts shown on the left panel (one-by-one animation, deferred)
const PANEL_ITEMS = [
  "This will take just a minute...",
  "Start your journey with Flax",
  "Tell us a little about yourself",
  "Get recommendations tailored to you",
  "Set goals that fit your lifestyle",
  "Track your progress over time",
];

const RegisterForm = () => {
  const navigate = useNavigate();
  const { setAuth, setPendingNavigation } = useAuthStore();
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterSchema) => {
    setApiError("");
    try {
      const { data } = await api.post<ApiResponse<RegisterData>>(
        "/api/auth/register",
        {
          // Map camelCase form values to snake_case expected by backend
          display_name: values.displayName,
          email: values.email,
          password: values.password,
          confirm_password: values.confirmPassword,
        },
      );

      if (data.data.requiresVerification) {
        // Email verification required — pass pendingId via router state
        navigate("/verify-otp", {
          state: { pendingId: data.data.pendingId, email: values.email },
        });
      } else if (data.data.accessToken && data.data.user) {
        setPendingNavigation(true);
        const route = await resolvePostAuthRoute(data.data.accessToken);
        setAuth(data.data.user, data.data.accessToken);
        navigate(route, { replace: true });
      }
    } catch (err: unknown) {
      setApiError(handleApiError(err));
    }
  };

  return (
    <SecondAuthLayout
      panelHeading={
        <>
          <span className="md:hidden">
            Let's get the journey <br /> started on
          </span>
          <span className="hidden md:inline">
            {" "}
            Let's get the journey{" "}
            <span className="block">
              started
              <span className="text-pawpaw dark:text-black-pawpaw">!</span>
            </span>
          </span>
        </>
      }
      panelItems={PANEL_ITEMS}
    >
      <h2 className=" hidden md:block font-heading text-xl font-bold text-cocoa dark:text-dark-white mb-6">
        Create an account
      </h2>

      {/* Google OAuth */}
      <GoogleButton />

      {/* Divider */}
      <div className="relative my-5 flex items-center">
        <div className="flex-1 h-px bg-cocoa/10 dark:bg-dark-white/10" />
        <span className="mx-3 text-xs text-cocoa/40 dark:text-dark-white/30">
          Sign up with email
        </span>
        <div className="flex-1 h-px bg-cocoa/15 dark:bg-dark-white/15" />
      </div>

      {/* API-level error (e.g. email taken) */}
      {apiError && (
        <p
          className="text-sm text-rose-500 dark:text-rose-700 text-center mb-4"
          role="alert"
        >
          {apiError}
        </p>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Input
          id="displayName"
          label="Full name"
          placeholder="First and Last Name"
          autoComplete="name"
          error={errors.displayName?.message}
          {...register("displayName")}
        />

        <Input
          id="email"
          type="email"
          label="Email"
          placeholder="you@email.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <Input
          id="password"
          type="password"
          label="Password"
          placeholder=""
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <Input
          id="confirmPassword"
          type="password"
          label="Confirm password"
          placeholder=""
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={isSubmitting}
          className="mt-2"
        >
          Create account
        </Button>
      </form>

      {/* Log in link */}
      <p className="text-sm text-cocoa dark:text-dark-white mt-3">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold hover:text-moringa dark:hover:text-moringa-faded transition-colors"
        >
          Log in
        </Link>
      </p>
    </SecondAuthLayout>
  );
};

export default RegisterForm;
