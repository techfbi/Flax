"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { THEME_STORAGE_KEY } from "@/lib/themeKey";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  /** The resolved mode after applying system preference */
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Shared with the inline script in app/layout.tsx, which applies the
// dark class before first paint so server rendered pages never flash
// the wrong theme.
const STORAGE_KEY = THEME_STORAGE_KEY;

const isBrowser = typeof window !== "undefined";

/*
  Server rendered markup must never depend on theme or resolvedTheme,
  the server cannot know the visitor's preference. Public pages style
  themed elements with Tailwind dark: classes instead, which the inline
  head script makes correct before paint. The logged in app renders
  client only, so it reads the real values from its very first render.
*/
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (!isBrowser) return "system";
    try {
      // Read persisted preference on first render
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      return saved ?? "system";
    } catch {
      return "system";
    }
  });

  // Resolve 'system' to the actual OS preference
  const getResolved = (t: Theme): "light" | "dark" => {
    if (t === "system") {
      if (!isBrowser) return "light";
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return t;
  };

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    getResolved(theme),
  );

  // Apply the dark class to <html> and keep resolvedTheme in sync
  useEffect(() => {
    const apply = () => {
      const resolved = getResolved(theme);
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };

    apply();

    // Watch for OS-level changes when theme === 'system'
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // storage unavailable, preference just lasts for this visit
    }
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
