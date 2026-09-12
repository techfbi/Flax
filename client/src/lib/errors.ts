import axios, { type AxiosError } from "axios";

// Translates axios and API errors into a clean, user-facing string.
// Precedence:
//   1. Timeout  →  clear timeout message
//   2. No response received (offline, DNS failure, server down) → network message
//   3. Server responded with an error → use the message the backend sent
//   4. Anything else → generic fallback
//
// This is what prevents internal infrastructure details like
// "getaddrinfo ENOTFOUND aws-0-eu-west-1.pooler.supabase.com" from
// reaching the UI.
export const getErrorMessage = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string => {
  //when offline.
  if ((error as any)?.isOfflineError === true) {
    return "Check your connection and try again.";
  }

  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const axiosErr = error as AxiosError<{ message?: string }>;

  // Request was made but no response came back, covers offline, DNS failures, and any network-level error including the pooler ENOTFOUND case.
  if (!axiosErr.response) {
    if (axiosErr.code === "ECONNABORTED" || axiosErr.message?.toLowerCase().includes("timeout")) {
      return "Request timed out. Check your connection and try again.";
    }
    return "Check your connection and try again.";
  }

  // Server responded but with an error status.
  // The backend always puts a human-readable message in data.message.
  return axiosErr.response.data?.message ?? fallback;
};