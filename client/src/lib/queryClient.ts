import { QueryClient } from '@tanstack/react-query'

/**
 * Shared QueryClient.
 * staleTime is set conservatively — data is refetched in the background
 * only when it's older than the specified window.
 * retry: 1 because the Axios interceptor already handles 401 retries.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 60 seconds default. Override per-query where needed.
      staleTime: 60 * 1000,
      // Don't retry on 4xx, those are client errors, not transient
      retry: (failCount, error: unknown) => {
        const status = (error as { response?: { status: number } })?.response?.status
        if (status && status >= 400 && status < 500) return false
        return failCount < 1
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
})