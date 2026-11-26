import { useState, useEffect } from "react";
import {
  Link,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GoogleButton } from "./GoogleButton";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { loginSchema, type LoginSchema } from "./authSchema";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse, LoginData } from "@/types/apiTypes";
import { SecondAuthLayout } from "@/components/layout/SecondAuthLayout";
import { handleApiError } from "@/utils/handleApiError";
import { resolvePostAuthRoute } from "@/utils/resolvePostAuthRoute";
import type { InternalAxiosRequestConfig } from "axios";
import { useSignInLoader } from "@/store/signInLoaderStore";

/**
 * Login page.
 * Left panel: "Welcome Back" with motivational conveyor items.
 * Right panel: email + password + log in button + forgot password.
 *
 * On success: setAuth, redirect to /dashboard (or /onboarding if not completed).
 * On Google: redirect to Google consent (same pattern as register).
 */

const PANEL_ITEMS = [
  "✓ Your progress is waiting...",
  "✓ Keep your streak alive...",
  "✓ Stay on track with your goals",
  "✓ Log meals effortlessly",
  "✓ Stay hydrated",
  "✓ Know what to eat next",
  "✓ Make today count",
];

const LoginForm = () => {
  const navigate = useNavigate();
  const { setAuth, setPendingNavigation } = useAuthStore();
  const startSignInLoader = useSignInLoader((s) => s.start);
  const [apiError, setApiError] = useState("");
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const authErrorCode = searchParams.get("authError");
  const AUTH_ERROR_MESSAGES: Record<string, string> = {
    google_email_exists:
      "This Google account is linked to an existing email. Please log in with your password instead.",
    google_failed: "Google sign-in failed. Try again.",
    google_cancelled: "Google sign-in was cancelled.",
  };

  const locationError = authErrorCode
    ? (AUTH_ERROR_MESSAGES[authErrorCode] ?? "")
    : "";
  const [displayLocationError, setDisplayLocationError] =
    useState(locationError);
  const sessionExpired = searchParams.get("session") === "expired";
  const passwordReset = searchParams.get("resetPassword") === "true";

  // useeffect to clean up error on fresh load
  useEffect(() => {
    if (sessionExpired || passwordReset) {
      // Remove the query param from URL without re-render
      window.history.replaceState({}, "", "/login");
    }
  }, [sessionExpired, passwordReset]);

  // display error from google sign in if there is one and dissapear after 5 sec
  useEffect(() => {
    if (!locationError) return;

    // set error in local state
    setDisplayLocationError(locationError);

    // Remove it from the history entry
    setSearchParams({}, { replace: true });
  }, [locationError, navigate, location.pathname]);

  // useeffect to reset the displaylocation error i.e error from google so it wont persist
  useEffect(() => {
    if (!locationError) return;

    const timer = setTimeout(() => {
      setDisplayLocationError("");
    }, 10000); // 10 seconds
    return () => clearTimeout(timer);
  }, [displayLocationError]);

  // Afunction to handle all error messages
  const message = (() => {
    if (apiError) {
      return {
        text: apiError,
        type: "error",
      };
    }

    if (sessionExpired) {
      return {
        text: "Your session has expired. Please log in again.",
        type: "error",
      };
    }

    if (displayLocationError) {
      return {
        text: displayLocationError,
        type: "error",
      };
    }

    if (passwordReset) {
      return {
        text: "Your password has been reset. Please log in!",
        type: "success",
      };
    }

    return null;
  })();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginSchema) => {
    setApiError("");
    try {
      const { data } = await api.post<ApiResponse<LoginData>>(
        "/api/auth/login",
        {
          email: values.email,
          password: values.password,
        },
        { _skipRefresh: true } as InternalAxiosRequestConfig,
      );
      // Signed in: the logo animation covers the move to home.
      startSignInLoader();
      setPendingNavigation(true);
      const route = await resolvePostAuthRoute(data.data.accessToken);
      setAuth(data.data.user, data.data.accessToken);
      navigate(route, { replace: true });
    } catch (err: unknown) {
      setApiError(handleApiError(err));
    }
  };

  return (
    <SecondAuthLayout
      panelHeading={
        <>
          <span className="md:hidden">Welcome back to</span>
          <span className="hidden md:inline">Welcome Back</span>
        </>
      }
      panelItems={PANEL_ITEMS}
    >
      <h2 className="hidden md:block font-heading text-xl font-bold text-cocoa dark:text-dark-white mb-6">
        Log in
      </h2>

      <GoogleButton />

      <div className="relative my-5 flex items-center">
        <div className="flex-1 h-px bg-cocoa/10 dark:bg-dark-white/10" />
        <span className="mx-3 text-xs text-cocoa/40 dark:text-dark-white/30">
          Sign in with email
        </span>
        <div className="flex-1 h-px bg-cocoa/15 dark:bg-dark-white/15" />
      </div>

      {/*Show normal API error*/}
      {message && (
        <p
          role="alert"
          className={`text-sm text-center mb-4 ${
            message.type === "error"
              ? "text-rose-500 dark:text-rose-700"
              : "text-moringa-faded"
          }`}
        >
          {message.text}
        </p>
      )}

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

        <Input
          id="password"
          type="password"
          label="Password"
          placeholder=""
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        {/* Log in + Forgot password on same row — matches design */}
        <div className="flex items-center justify-between gap-5 mt-2">
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            className="shrink-1 w-[200px]"
          >
            Log in
          </Button>
          <Link
            to="/forgot-password"
            className="text-sm text-cocoa dark:text-dark-white hover:underline shrink-0"
          >
            Forgot Password?
          </Link>
        </div>
      </form>

      <p className="text-sm text-cocoa dark:text-dark-white mt-3">
        New here?{" "}
        <Link
          to="/register"
          className="font-semibold hover:text-moringa dark:hover:text-moringa-faded transition-colors"
        >
          Register
        </Link>
      </p>
    </SecondAuthLayout>
  );
};

export default LoginForm;
