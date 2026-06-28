/**
 * handleApiError, extracts a safe, user-facing error message from an Axios error.
 *
 * Rules:
 * - 4xx errors: use the backend `message` field directly.
 *   e.g. "Email already in use", "Invalid OTP", "Incorrect password"
 * - 5xx errors: always return the generic fallback.
 * - Network errors (no response): return the generic fallback.
 *   "Something went wrong, please try again."
 */

const GENERIC = 'Something went wrong, please try again.'

interface ApiErrorShape {
  response?: {
    status?: number
    data?: {
      message?: string
    }
  }
  message?: string
}

export const handleApiError = (err: unknown): string => {
  const error = err as ApiErrorShape
  const status = error?.response?.status
  const backendMessage = error?.response?.data?.message

  // No response at all — network failure
  if (!status) return GENERIC

  // 5xx — server error, never expose internals
  if (status >= 500) return GENERIC

  // 4xx — use backend message if present and it's a non-empty string
  if (status >= 400 && status < 500) {
    if (backendMessage && typeof backendMessage === 'string' && backendMessage.trim()) {
      return backendMessage.trim()
    }
    // 4xx with no message — generic fallback
    return GENERIC
  }

  return GENERIC
}