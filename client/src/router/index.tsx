import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse, AuthUser, FullProfile } from "@/types/apiTypes";

/* Lazy pages */
const LandingPage = lazy(() => import("@/features/landing/LandingPage"));
const HomePage = lazy(() => import("@/features/home/HomePage"));
const RegisterForm = lazy(() => import("@/features/auth/RegisterForm"));
const LoginForm = lazy(() => import("@/features/auth/LoginForm"));
const OtpForm = lazy(() => import("@/features/auth/OtpForm"));
const AuthCallbackPage = lazy(() => import("@/features/auth/AuthCallbackPage"));
const ForgotPasswordForm = lazy(
  () => import("@/features/auth/ForgotPasswordForm"),
);
const ResetPasswordForm = lazy(
  () => import("@/features/auth/ResetPasswordForm"),
);
const OnboardingFlow = lazy(
  () => import("@/features/onboarding/OnboardingFlow"),
);
const PlaceholderPage = lazy(() => import("@/pages/PlaceholderPage"));
const SpinTab = lazy(() =>
  import("@/features/home/SpinTab").then((m) => ({ default: m.SpinTab })),
);
const AskNouraPage = lazy(() => import("@/pages/AskNouraPage"));

/* Full screen spinner, shown while verifying session */
const PageLoader = () => (
  <div
    className="min-h-screen flex items-center justify-center
    bg-off-white dark:bg-dark-bg"
  >
    <div
      className="w-8 h-8 border-2 border-moringa dark:border-moringa-faded
      border-t-transparent rounded-full animate-spin"
    />
  </div>
);

/*
  RetrySpinner, shown when /me fails due to network error. Retries /me in the background every 3 seconds.
  No page reload. No navigation. Just waits for connectivity.
  When /me succeeds, the app transitions normally.
  When /me fails with a real auth error, the interceptor
  already handles the redirect so this component never needs to.
*/
const RetrySpinner = ({
  onSuccess,
}: {
  onSuccess: (user: AuthUser) => void;
}) => {
  const attemptRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const retry = async () => {
      if (cancelled) return;
      attemptRef.current++;

      try {
        const { data } =
          await api.get<ApiResponse<{ user: AuthUser }>>("/api/auth/me");
        if (!cancelled) onSuccess(data.data.user);
      } catch (err: unknown) {
        /*
          Only keep retrying on network errors (no response).
          If there is a real auth error the interceptor already
          redirected. We just stop here.
        */
        const isNetwork = !(err as { response?: unknown })?.response;
        if (isNetwork && !cancelled) {
          setTimeout(retry, 3000);
        }
      }
    };

    /* Start first retry after 3 seconds */
    const t = setTimeout(retry, 3000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [onSuccess]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center
      gap-4 bg-off-white dark:bg-dark-bg"
    >
      <div
        className="w-8 h-8 border-2 border-moringa dark:border-moringa-faded
        border-t-transparent rounded-full animate-spin"
      />
      <p className="text-sm text-cocoa-faded">Waiting for connection...</p>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <PageLoader />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, pendingNavigation } = useAuthStore();
  if (isLoading || pendingNavigation) return <PageLoader />;
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

/* "/" serves landing for unauthenticated, homepage for authenticated */
const RootRoute = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <PageLoader />;
  return isAuthenticated ? <HomePage /> : <LandingPage />;
};

/*
  SessionGate — runs once on app mount.

  Flow:
  1. Call GET /api/auth/me (no _skipRefresh so cookie-based refresh can run).
  2a. Success -> setUser, fetch avatar in background, done.
  2b. Network error (offline) -> show RetrySpinner, retry every 3s.
  2c. Auth error (NO_TOKEN, INVALID_TOKEN, TOKEN_EXPIRED, TOKEN_REUSED)
      -> interceptor already called window.location.replace().
         Just clearAuth and let the redirect happen.
*/
const SessionGate = ({ children }: { children: React.ReactNode }) => {
  const { setUser, setAvatarUrl, clearAuth, setLoading } = useAuthStore();
  const [showRetry, setShowRetry] = useState(false);
  const checked = useRef(false);

  const verifyUser = async () => {
    try {
      const { data } =
        await api.get<ApiResponse<{ user: AuthUser }>>("/api/auth/me");
      setUser(data.data.user);
      setShowRetry(false);

      /* Fetch avatar in background, never block app render */
      api
        .get<ApiResponse<{ profile: FullProfile }>>("/api/users/profile")
        .then((res) => setAvatarUrl(res.data.data.profile.avatar_url))
        .catch(() => {});
    } catch (err: unknown) {
      const isNetworkError = !(err as { response?: unknown })?.response;

      if (isNetworkError) {
        /*
          Offline or server unreachable on startup.
          Show the retry spinner. RetrySpinner will call verifyUser
          again every 3 seconds via its own timer.
        */
        setLoading(false);
        setShowRetry(true);
      } else {
        /*
          Real auth error. The interceptor already called
          window.location.replace() so we just clean up state.
        */
        setLoading(false);
        clearAuth();
      }
    }
  };

  const handleRetrySuccess = (user: AuthUser) => {
    setUser(user);
    setShowRetry(false);

    api
      .get<ApiResponse<{ profile: FullProfile }>>("/api/users/profile")
      .then((res) => setAvatarUrl(res.data.data.profile.avatar_url))
      .catch(() => {});
  };

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    verifyUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showRetry) {
    return <RetrySpinner onSuccess={handleRetrySuccess} />;
  }

  return <>{children}</>;
};

const AppRouter = () => {
  return (
    <BrowserRouter>
      <SessionGate>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/api/auth/callback" element={<AuthCallbackPage />} />

            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterForm />
                </PublicRoute>
              }
            />
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginForm />
                </PublicRoute>
              }
            />
            <Route
              path="/verify-otp"
              element={
                <PublicRoute>
                  <OtpForm />
                </PublicRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPasswordForm />
                </PublicRoute>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicRoute>
                  <ResetPasswordForm />
                </PublicRoute>
              }
            />

            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingFlow />
                </ProtectedRoute>
              }
            />
            <Route
              path="/spin"
              element={
                <ProtectedRoute>
                  <SpinTab />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <PlaceholderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ask-noura"
              element={
                <ProtectedRoute>
                  <AskNouraPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <PlaceholderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <PlaceholderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <PlaceholderPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </SessionGate>
    </BrowserRouter>
  );
};

export default AppRouter;
