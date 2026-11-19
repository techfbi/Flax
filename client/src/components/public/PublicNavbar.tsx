"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { Menu, X, Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

/*
  The landing page navbar, same look as the old SPA Navbar.tsx, rebuilt
  for server rendering:
  - Real <a href> links instead of onClick navigation, so crawlers can
    follow them and they work before JavaScript loads.
  - Nothing in the markup depends on the theme, the logo and the theme
    icon swap with Tailwind dark: classes, so server HTML is right for
    every visitor and hydration never mismatches.

  variant "landing": in page links to the Noura and How it works sections.
  variant "site": links to the other public pages.
*/
type Variant = "landing" | "site";

const LINKS: Record<Variant, { label: string; href: string }[]> = {
  landing: [
    { label: "Noura", href: "#noura" },
    { label: "How it Works", href: "#how-it-works" },
  ],
  site: [
    { label: "Food calories", href: "/foods" },
    { label: "Calorie calculator", href: "/tools/calorie-calculator" },
  ],
};

// Both icons are always rendered, CSS shows the right one, so the server
// HTML is correct for light and dark visitors alike.
const ThemeIcon = () => (
  <>
    <Sun size={18} className="dark:hidden" aria-hidden="true" />
    <Moon size={18} className="hidden dark:block" aria-hidden="true" />
  </>
);

export const PublicNavbar = ({ variant = "landing" }: { variant?: Variant }) => {
  const { setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = LINKS[variant];

  const cycleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
  };

  const handleAnchor = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    document
      .getElementById(href.slice(1))
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    setMobileOpen(false);
  };

  return (
    <div className="fixed top-2 md:top-2 left-4 right-4 z-50">
      <nav
        aria-label="Main"
        className="
          bg-white/70 dark:bg-cocoa/70
          backdrop-blur-md
          rounded-2xl shadow-lg
          border border-white/20 dark:border-white/10
          px-5 py-5 md:px-10 md:py-10 h-14 flex items-center justify-between
          max-w-7xl lg:max-w-[95%] mx-auto
        "
      >
        <Link href="/" aria-label="Flax home" className="shrink-0">
          <img
            src="/images/logoLight.png"
            alt="Flax"
            width={72}
            height={35}
            className="h-[30px] md:h-[35px] w-auto mt-1 object-contain dark:hidden"
          />
          <img
            src="/images/logoDark.png"
            alt="Flax"
            width={72}
            height={35}
            className="h-[30px] md:h-[35px] w-auto mt-1 object-contain hidden dark:block"
          />
        </Link>

        <div className="hidden md:flex items-center gap-5">
          {links.map((link) =>
            link.href.startsWith("#") ? (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchor(e, link.href)}
                className="text-sm font-semibold text-cocoa dark:text-dark-white hover:opacity-70 transition-opacity"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-cocoa dark:text-dark-white hover:opacity-70 transition-opacity"
              >
                {link.label}
              </Link>
            ),
          )}
          <Link
            href="/login"
            className="
              px-5 py-2 rounded-full
              text-sm font-semibold text-surface
              bg-pawpaw dark:bg-black-pawpaw
              hover:opacity-90 transition-opacity
            "
          >
            Log in
          </Link>

          <button
            type="button"
            onClick={cycleTheme}
            aria-label="Toggle light and dark theme"
            className="text-cocoa dark:text-dark-white hover:opacity-70 transition-opacity"
          >
            <ThemeIcon />
          </button>
        </div>

        <div className="md:hidden flex items-center gap-7">
          <button
            type="button"
            onClick={cycleTheme}
            aria-label="Toggle light and dark theme"
            className="text-cocoa dark:text-dark-white"
          >
            <ThemeIcon />
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="text-cocoa dark:text-dark-white"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div
          className="
            md:hidden mt-2
            bg-white/70 dark:bg-cocoa/70
            backdrop-blur-md
            rounded-2xl shadow-lg
            border border-white/20 dark:border-white/10
            px-5 py-4 flex flex-col gap-1
            max-w-5xl mx-auto
          "
        >
          {links.map((link) =>
            link.href.startsWith("#") ? (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchor(e, link.href)}
                className="text-left text-sm font-medium text-cocoa dark:text-dark-white py-2"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-left text-sm font-medium text-cocoa dark:text-dark-white py-2"
              >
                {link.label}
              </Link>
            ),
          )}
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="
              mt-2 w-full py-3 rounded-full text-center
              text-sm font-semibold text-surface
              bg-pawpaw dark:bg-black-pawpaw
            "
          >
            Log in
          </Link>
        </div>
      )}
    </div>
  );
};
