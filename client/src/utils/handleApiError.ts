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

  if (backendMessage === SESSION_SENTINEL) return ''

  /*
    401 with a real backend message means wrong credentials or similar.
    Show the backend message directly.
    Only swallow 401 if there is no message (that means the interceptor
    already handled refresh failure and set the sentinel, or there truly
    is no user facing message).
  */
  if (status >= 400 && status < 500) {
    if (backendMessage && typeof backendMessage === 'string' && backendMessage.trim()) {
      return backendMessage.trim()
    }
    return GENERIC
  }

  return GENERIC
}