import { lazy, Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse, AuthUser } from "@/types/apiTypes";
import type { InternalAxiosRequestConfig } from "axios";

/* ── Lazy pages ─────────────────────────────────────────────── */
const LandingPage = lazy(() => import("@/features/landing/LandingPage"));
const RegisterForm = lazy(() => import("@/features/auth/RegisterForm"));
const LoginForm = lazy(() => import("@/features/auth/LoginForm"));
const OtpForm = lazy(() => import("@/features/auth/OtpForm"));
const AuthCallbackPage = lazy(() => import("@/features/auth/AuthCallbackPage"));
const PlaceholderPage = lazy(() => import("@/pages/PlaceholderPage"));
const ForgotPasswordForm = lazy(
  () => import("@/features/auth/ForgotPasswordForm"),
);
const ResetPasswordForm = lazy(
  () => import("@/features/auth/ResetPasswordForm"),
);

/* ── Page loader ────────────────────────────────────────────── */
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-off-white dark:bg-dark-bg">
    <div className="w-8 h-8 border-2 border-moringa dark:border-moringa-faded border-t-transparent rounded-full animate-spin" />
  </div>
);

/* ── Route guards ────────────────────────────────────────────── */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <PageLoader />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <PageLoader />;
  return !isAuthenticated ? (
    <>{children}</>
  ) : (
    <Navigate to="/dashboard" replace />
  );
};

/* ── Session check — runs once on app load ───────────────────
   Uses _skipRefresh so a 401 from /me does NOT trigger the
   interceptor's refresh attempt. We just treat it as "no session"
   and clear auth. No redirect happens here — guards handle it.
────────────────────────────────────────────────────────────── */
const SessionGate = ({ children }: { children: React.ReactNode }) => {
  const { setAuth, clearAuth } = useAuthStore();
  const checked = useRef(false); // prevent double-fire in React StrictMode

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    const verify = async () => {
      try {
        const { data } = await api.get<
          ApiResponse<{ user: AuthUser; accessToken: string }>
        >(
          "/api/auth/me",
          // _skipRefresh prevents the 401 from this call triggering
          // the refresh interceptor and creating a loop
          { _skipRefresh: true } as InternalAxiosRequestConfig,
        );
        setAuth(data.data.user, data.data.accessToken);
      } catch {
        // No valid session — clear state, guards will redirect if needed
        clearAuth();
      }
    };

    verify();
  }, [setAuth, clearAuth]);

  return <>{children}</>;
};

/* ── App router ─────────────────────────────────────────────── */
const AppRouter = () => {
  return (
    <BrowserRouter>
      <SessionGate>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public — accessible always */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

            {/* Public-only — redirect to dashboard if logged in */}
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

            {/* Protected — redirect to login if not authenticated */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <PlaceholderPage />
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

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </SessionGate>
    </BrowserRouter>
  );
};

export default AppRouter;
