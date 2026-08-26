import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse, AuthUser, FullProfile } from "@/types/apiTypes";
import { motion, useReducedMotion } from "framer-motion";
import { NouraChatProvider } from "@/context/NouraChatContext";
import { useStatusBar } from "@/hooks/useStatusBar";

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
//const PlaceholderPage = lazy(() => import("@/pages/PlaceholderPage"));
const SpinTab = lazy(() =>
  import("@/features/home/SpinTab").then((m) => ({ default: m.SpinTab })),
);
const AskNouraPage = lazy(() => import("@/pages/AskNouraPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));

/* Full screen spinner, shown while verifying session */
const PageLoader = () => (
  <div
    className="min-h-screen flex items-center justify-center
    bg-off-white dark:bg-dark-bg"
  >
    <div
      className="w-8 h-8 rounded-full animate-spin
      border-2 border-moringa dark:border-moringa-faded
      border-t-transparent dark:border-t-transparent"
      style={{ borderTopColor: "transparent" }}
    />
  </div>
);

/*
  Enter only, no exit. The old page unmounts instantly like a normal
  route swap, only the new one fades and settles in over it. Two full
  page components animating opacity at once, one entering and one
  exiting, only overlap cleanly with absolute positioning, which gets
  messy across pages that each manage their own height and scroll
  differently. Skipping the exit sidesteps that entirely, there is
  never a moment where two pages coexist, so there is nothing that
  can look like a blank or dim gap between them.
*/
const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
};

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
        className="w-8 h-8 rounded-full animate-spin
      border-2 border-moringa dark:border-moringa-faded
      border-t-transparent dark:border-t-transparent"
        style={{ borderTopColor: "transparent" }}
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

  // Override: Show status bar on landing, hide on home
  useStatusBar({ show: !isAuthenticated });

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
  const location = useLocation();

  const hideStatusBarRoutes = [
    "/spin",
    "/dashboard",
    "/ask-noura",
    "/profile",
    "/settings",
    "/notifications",
  ];
  const shouldHide = hideStatusBarRoutes.includes(location.pathname);

  useStatusBar({ show: !shouldHide });

  // Useeffect to set timezone for user
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const lastSent = sessionStorage.getItem("flax-timezone-sent");
    if (lastSent === tz) return;
    api
      .patch("/api/users/timezone", { timezone: tz })
      .then(() => sessionStorage.setItem("flax-timezone-sent", tz))
      .catch(() => {
        // non critical, scheduled notifications just skip this user
        // until it succeeds on a future load
      });
  }, []);

  return (
    <BrowserRouter>
      <SessionGate>
        <NouraChatProvider>
          <Suspense fallback={<PageLoader />}>
            <AnimatedRoutes />
          </Suspense>
        </NouraChatProvider>
      </SessionGate>
    </BrowserRouter>
  );
};

/*
  Split out from AppRouter since useLocation needs to be called
  inside the Router, and AnimatePresence needs the location to key
  off of to know when a real route change happened.
*/
const AnimatedRoutes = () => {
  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<RootRoute />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route
        path="/register"
        element={
          <PublicRoute>
            <PageTransition>
              <RegisterForm />
            </PageTransition>
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <PageTransition>
              <LoginForm />
            </PageTransition>
          </PublicRoute>
        }
      />
      <Route
        path="/verify-otp"
        element={
          <PublicRoute>
            <PageTransition>
              <OtpForm />
            </PageTransition>
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <PageTransition>
              <ForgotPasswordForm />
            </PageTransition>
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <PageTransition>
              <ResetPasswordForm />
            </PageTransition>
          </PublicRoute>
        }
      />

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <PageTransition>
              <OnboardingFlow />
            </PageTransition>
          </ProtectedRoute>
        }
      />
      <Route
        path="/spin"
        element={
          <ProtectedRoute>
            <PageTransition>
              <SpinTab />
            </PageTransition>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <PageTransition>
              <DashboardPage />
            </PageTransition>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ask-noura"
        element={
          <ProtectedRoute>
            <PageTransition>
              <AskNouraPage />
            </PageTransition>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <PageTransition>
              <ProfilePage />
            </PageTransition>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <PageTransition>
              <SettingsPage />
            </PageTransition>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <PageTransition>
              <NotificationsPage />
            </PageTransition>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
export default AppRouter;
