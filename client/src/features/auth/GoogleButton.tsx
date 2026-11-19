/**
 * GoogleButton — "Continue with Google" button.
 * Builds the Google OAuth consent URL directly on the frontend.
 * Google redirects back to /auth/callback?code=xxx after user consent.
 * Frontend then POSTs the code to POST /api/auth/google (Pattern B).
 *
 * TRACK: NEXT_PUBLIC_GOOGLE_CLIENT_ID (or legacy VITE_GOOGLE_CLIENT_ID) must be set in .env before this works.
 * TRACK: Authorised redirect URI in Google Cloud Console must match
 *        the NEXT_PUBLIC_GOOGLE_REDIRECT_URI value exactly.
 */

interface GoogleButtonProps {
  loading?: boolean;
}

// Scopes we request — email and profile are all we need
const SCOPES = ["openid", "email", "profile"].join(" ");

const buildGoogleUrl = (): string => {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string;
  const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI as string;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const GoogleButton = ({ loading = false }: GoogleButtonProps) => {
  const handleClick = () => {
    // Redirect browser to Google consent page
    window.location.href = buildGoogleUrl();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
                 bg-[#D9D9D9] dark:bg-[#343434]
                 text-cocoa dark:text-dark-white
                 text-sm font-medium font-body
                 hover:bg-[#c8c8c8] dark:hover:bg-[#404040]
                 transition-colors duration-150
                 disabled:opacity-50 disabled:cursor-not-allowed
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pawpaw"
      aria-label="Continue with Google"
    >
      {/* Official Google G icon */}
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        />
      </svg>
      {loading ? "Connecting..." : "Continue with google"}
    </button>
  );
};
