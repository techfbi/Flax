// All route paths in one place.
// Components import from here rather than hardcoding strings. If a route ever changes, it changes in exactly one place.
export const ROUTES = {
  LANDING:          "/",
  LOGIN:            "/login",
  SIGNUP:           "/signup",
  VERIFY_OTP:       "/verify-otp",
  FORGOT_PASSWORD:  "/forgot-password",
  RESET_PASSWORD:   "/reset-password",
  AUTH_CALLBACK:    "/auth/callback",
  ONBOARDING:       "/onboarding",
  HOME:             "/home",
  DASHBOARD:        "/dashboard",
  LOG:              "/log",
  WATER:            "/water",
  CHAT:             "/chat",
  PROFILE:          "/profile",
  SETTINGS:         "/settings",
  PANTRY:           "/pantry",
  SPIN_HISTORY:     "/spin-history",
  NOT_FOUND:        "/404",
} as const;

// API query keys for TanStack Query.
// Using string arrays as keys lets us invalidate by prefix.
// queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD }) invalidates all dashboard queries regardless of the date parameter.
export const QUERY_KEYS = {
  PROFILE:       ["profile"]       as const,
  DASHBOARD:     ["dashboard"]     as const,
  MEAL_LOGS:     ["meal-logs"]     as const,
  WATER_LOGS:    ["water-logs"]    as const,
  STREAKS:       ["streaks"]       as const,
  PANTRY:        ["pantry"]        as const,
  SPIN_FILTERS:  ["spin-filters"]  as const,
  SPIN_HISTORY:  ["spin-history"]  as const,
  FOOD_SEARCH:   ["food-search"]   as const,
  CHAT_HISTORY:  ["chat-history"]  as const,
  FLAGGED_MEALS: ["flagged-meals"] as const,
} as const;

export const APP_NAME = "Flax";