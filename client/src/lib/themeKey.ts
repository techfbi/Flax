// localStorage key for the theme preference. Read by ThemeProvider and by
// the inline pre-paint script in app/layout.tsx. Lives outside the
// "use client" ThemeContext module so the server layout can import the
// real string value.
export const THEME_STORAGE_KEY = "flax-theme";
