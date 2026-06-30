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
const SESSION_SENTINEL = '__SESSION_EXPIRED__'

interface ApiErrorShape {
  response?: {
    status?: number
    data?: {
      message?: string
    }
  }
}

export const handleApiError = (err: unknown): string => {
  const error = err as ApiErrorShape
  const status = error?.response?.status
  const backendMessage = error?.response?.data?.message

  if (!status) return GENERIC
  if (status >= 500) return GENERIC

  // Swallow session expiry silently. The interceptor already redirected
  // to /login. Nothing should appear in the UI as an inline error.
  if (backendMessage === SESSION_SENTINEL) return ''

  if (status === 401) {
    // Any 401 that reaches here without the sentinel means the interceptor
    // could not refresh. Treat it as session expired, redirect handled elsewhere.
    return ''
  }

  if (status >= 400 && status < 500) {
    if (backendMessage && typeof backendMessage === 'string' && backendMessage.trim()) {
      return backendMessage.trim()
    }
    return GENERIC
  }

  return GENERIC
}