/*
  Every URL owned by the client side app (src/router/index.tsx).
  app/[...app]/page.tsx serves the app shell for exactly these paths
  and returns a real 404 for anything else, so unknown URLs are never
  reported to search engines as soft 404 duplicates of the app.

  Keep this list in sync with the <Route> paths in src/router/index.tsx.
  Adding a route there without adding it here makes it 404 on a full
  page load or refresh.
*/
export const SPA_ROUTES = [
  "home",
  "spin",
  "dashboard",
  "ask-noura",
  "profile",
  "settings",
  "notifications",
  "onboarding",
  "login",
  "register",
  "verify-otp",
  "forgot-password",
  "reset-password",
  "auth/callback",
] as const;

// Private app areas, kept out of search engines entirely.
export const PRIVATE_PATHS = [
  "/home",
  "/spin",
  "/dashboard",
  "/ask-noura",
  "/profile",
  "/settings",
  "/notifications",
  "/onboarding",
  "/verify-otp",
  "/reset-password",
  "/forgot-password",
  "/auth/",
  "/api/",
];
