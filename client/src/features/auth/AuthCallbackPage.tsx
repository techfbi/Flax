import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse, GoogleAuthData } from "@/types/apiTypes";

/**
 * AuthCallback — Google OAuth Pattern B.
 * Google redirects to /auth/callback?code=xxx after user consent.
 * This page extracts the code from the URL and POSTs it to the backend.
 * Backend exchanges code for tokens, returns user + accessToken.
 *
 * On success: if isNewUser or !hasCompletedOnboarding → /onboarding
 *             else → /dashboard
 * On error: → /login with error message in state
 *
 * TRACK: the redirect URI registered in Google Cloud Console must be
 *        updated to the production domain before launch.
 */
const AuthCallbackPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const didRun = useRef(false); // prevent double-fire in React strict mode

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const code = params.get("code");
    if (!code) {
      navigate("/login", {
        state: { error: "Google sign-in was cancelled." },
        replace: true,
      });
      return;
    }

    const exchange = async () => {
      try {
        const { data } = await api.post<ApiResponse<GoogleAuthData>>(
          "/api/auth/google",
          { code },
        );
        setAuth(data.data.user, data.data.accessToken);

        if (data.data.isNewUser || !data.data.user.hasCompletedOnboarding) {
          navigate("/onboarding", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } catch {
        navigate("/login", {
          state: { error: "Google sign-in failed. Try again." },
          replace: true,
        });
      }
    };

    exchange();
  }, [params, navigate, setAuth]);

  // Minimal loading UI — user sees this briefly
  return (
    <div className="min-h-screen bg-off-white dark:bg-dark-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-moringa dark:border-moringa-faded border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-cocoa-faded">Signing you in...</p>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
