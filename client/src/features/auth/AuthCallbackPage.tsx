import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse, GoogleAuthData } from "@/types/apiTypes";
import { resolvePostAuthRoute } from "@/utils/resolvePostAuthRoute";
import { PageLoader } from "@/components/ui/PageLoader";
import { useSignInLoader } from "@/store/signInLoaderStore";

const AuthCallbackPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth, setPendingNavigation } = useAuthStore();
  const { start: startSignInLoader, stop: stopSignInLoader } = useSignInLoader();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const code = params.get("code");
    if (!code) {
      navigate("/login?authError=google_cancelled", { replace: true });
      return;
    }

    // Google sends people back here mid sign in, so the logo animation
    // starts now and covers the exchange and the move to home.
    startSignInLoader();

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
        stopSignInLoader();
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        const errorCode =
          status === 409 ? "google_email_exists" : "google_failed";

        navigate(`/login?authError=${errorCode}`, { replace: true });
      }
    };

    exchange();
  }, [params, navigate, setAuth, setPendingNavigation, startSignInLoader, stopSignInLoader]);

  // Covered by the sign in animation, this only shows if that is not up.
  return <PageLoader />;
};

export default AuthCallbackPage;
