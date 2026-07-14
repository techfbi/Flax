import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse, GoogleAuthData } from "@/types/apiTypes";
import { resolvePostAuthRoute } from "@/utils/resolvePostAuthRoute";

const AuthCallbackPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth, setPendingNavigation } = useAuthStore();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const code = params.get("code");
    if (!code) {
      navigate("/login?authError=google_cancelled", { replace: true });
      return;
    }

    const exchange = async () => {
      try {
        /*
          Set pendingNavigation before the exchange so if SessionGate
          clears auth between now and when we call setAuth,
          no stray redirect fires.
        */
        setPendingNavigation(true);

        const { data } = await api.post<ApiResponse<GoogleAuthData>>(
          "/api/auth/google",
          { code },
        );

        const route = data.data.isNewUser
          ? "/onboarding"
          : await resolvePostAuthRoute(data.data.accessToken);

        setAuth(data.data.user, data.data.accessToken);
        navigate(route, { replace: true });
        /*
          Do not call setPendingNavigation(false).
          It stays true until clearAuth on logout.
        */
      } catch (err: unknown) {
        setPendingNavigation(false);
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        const errorCode =
          status === 409 ? "google_email_exists" : "google_failed";

        navigate(`/login?authError=${errorCode}`, { replace: true });
      }
    };

    exchange();
  }, [params, navigate, setAuth, setPendingNavigation]);

  return (
    <div className="min-h-screen bg-off-white dark:bg-dark-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 border-2 border-moringa dark:border-moringa-faded
          border-t-transparent rounded-full animate-spin"
        />
        <p className="text-sm text-cocoa-faded">Signing you in...</p>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
