import { lazy, Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse, AuthUser } from "@/types/apiTypes";
import type { InternalAxiosRequestConfig } from "axios";

const LandingPage = lazy(() => import("@/features/landing/LandingPage"));
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

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-off-white dark:bg-dark-bg">
    <div
      className="w-8 h-8 border-2 border-moringa dark:border-moringa-faded
      border-t-transparent rounded-full animate-spin"
    />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <PageLoader />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, pendingNavigation } = useAuthStore();
  if (isLoading) return <PageLoader />;
  /*
    If a post-auth navigation is pending (resolvePostAuthRoute is in flight),
    hold here instead of redirecting to /dashboard.
    The form component will navigate to the correct route once resolved.
  */
  if (pendingNavigation) return <PageLoader />;
  return !isAuthenticated ? (
    <>{children}</>
  ) : (
    <Navigate to="/dashboard" replace />
  );
};

/*
  SessionGate runs once on app load to check if a session exists.
  It calls GET /api/auth/me silently.

  Critical race condition fix:
  If the user registers or logs in while the /me check is in flight,
  isAuthenticated becomes true via setAuth before clearAuth is called.
  We must NOT call clearAuth if the user is already authenticated by
  the time the /me response comes back.
  We check isAuthenticated from the store at response time, not at call time.
*/
const SessionGate = ({ children }: { children: React.ReactNode }) => {
  const { setUser, clearAuth } = useAuthStore();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    const verify = async () => {
      try {
        const { data } = await api.get<ApiResponse<{ user: AuthUser }>>(
          "/api/auth/me",
          { _skipRefresh: true } as InternalAxiosRequestConfig,
        );
        setUser(data.data.user);
      } catch {
        /*
          Only clear auth if the user is not already authenticated.
          If register or login set auth while this request was in flight,
          we must not wipe that state.
        */
        const currentState = useAuthStore.getState();
        if (!currentState.isAuthenticated) {
          clearAuth();
        } else {
          /*
            Auth was set by a login or register action after this check started.
            Just mark loading as done without clearing anything.
          */
          useAuthStore.getState().setLoading(false);
        }
      }
    };

    verify();
  }, [setUser, clearAuth]);

  return <>{children}</>;
};

const AppRouter = () => {
  return (
    <BrowserRouter>
      <SessionGate>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

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
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <PlaceholderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/spin"
              element={
                <ProtectedRoute>
                  <PlaceholderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meals"
              element={
                <ProtectedRoute>
                  <PlaceholderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/water"
              element={
                <ProtectedRoute>
                  <PlaceholderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <PlaceholderPage />
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

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </SessionGate>
    </BrowserRouter>
  );
};

export default AppRouter;
