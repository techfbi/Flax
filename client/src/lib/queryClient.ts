import { QueryClient } from "@tanstack/react-query";

// Single QueryClient instance shared across the app.
// Imported by main.tsx and wrapped around the app.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry on 401/403/404. retrying won't fix auth or not-found errors.
      retry: (failureCount, error: unknown) => {
        const status = (error as { response?: { status: number } })?.response?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2; // retry network errors up to 2 times
      },
      // Refetch when the user returns to a tab after being away
      refetchOnWindowFocus: true,
      // Data is considered fresh for 1 minute by default. Individual queries override this with their own staleTime.
      staleTime: 60 * 1000,
    },
    mutations: {
      // Don't retry mutations. a failed POST should not silently retry.
      retry: false,
    },
  },
});