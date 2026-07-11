import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuthStore } from "@/store/authStore";

export const Navbar = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { isAuthenticated } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const cycleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };
  const ThemeIcon = resolvedTheme === "dark" ? Moon : Sun;

  const scrollTo = (id: string) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    setMobileOpen(false);
  };

  return (
    <div className="fixed top-5 md:top-3 left-4 right-4 z-50">
      <nav
        className="
          bg-white/70 dark:bg-cocoa/70
          backdrop-blur-md
          rounded-2xl shadow-lg
          border border-white/20 dark:border-white/10
          px-5 py-5 md:px-10 md:py-10 h-14 flex items-center justify-between
          max-w-7xl mx-auto
        "
      >
        <Link to="/" aria-label="Flax home" className="shrink-0">
          <img
            src={
              resolvedTheme === "dark"
                ? "/images/logoDark.png"
                : "/images/logoLight.png"
            }
            alt="Flax"
            width={72}
            height={35}
            className="h-[30px] md:h-[35px] w-auto mt-1 object-contain"
          />
        </Link>

        <div className="hidden md:flex items-center gap-5">
          {!isAuthenticated ? (
            <>
              <button
                onClick={() => scrollTo("noura")}
                className="text-sm font-semibold text-cocoa dark:text-dark-white hover:opacity-70 transition-opacity"
              >
                Noura
              </button>
              <button
                onClick={() => scrollTo("how-it-works")}
                className="text-sm font-semibold text-cocoa dark:text-dark-white hover:opacity-70 transition-opacity"
              >
                How it Works
              </button>
              <button
                onClick={() => navigate("/login")}
                className="
                  px-5 py-2 rounded-full
                  text-sm font-semibold text-surface
                  bg-pawpaw dark:bg-black-pawpaw
                  hover:opacity-90 transition-opacity
                "
              >
                Log in
              </button>
            </>
          ) : (
            <>
              {[
                { label: "Home", to: "/dashboard" },
                { label: "Spin", to: "/spin" },
                { label: "Meals", to: "/meals" },
                { label: "Water", to: "/water" },
                { label: "Chat", to: "/chat" },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm font-medium text-cocoa dark:text-dark-white hover:opacity-70 transition-opacity"
                >
                  {link.label}
                </Link>
              ))}
            </>
          )}

          <button
            onClick={cycleTheme}
            aria-label={`Current theme: ${theme}. Click to cycle.`}
            className="text-cocoa dark:text-dark-white hover:opacity-70 transition-opacity"
          >
            <ThemeIcon size={18} />
          </button>
        </div>

        <div className="md:hidden flex items-center gap-7">
          <button
            onClick={cycleTheme}
            aria-label={`Theme: ${theme}`}
            className="text-cocoa dark:text-dark-white"
          >
            <ThemeIcon size={18} />
          </button>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
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
          {!isAuthenticated ? (
            <>
              <button
                onClick={() => scrollTo("noura")}
                className="text-left text-sm font-medium text-cocoa dark:text-dark-white py-2"
              >
                Noura
              </button>
              <button
                onClick={() => scrollTo("how-it-works")}
                className="text-left text-sm font-medium text-cocoa dark:text-dark-white py-2"
              >
                How it Works
              </button>
              <button
                onClick={() => {
                  navigate("/login");
                  setMobileOpen(false);
                }}
                className="
                  mt-2 w-full py-3 rounded-full
                  text-sm font-semibold text-surface
                  bg-pawpaw dark:bg-black-pawpaw
                "
              >
                Log in
              </button>
            </>
          ) : (
            <>
              {[
                { label: "Home", to: "/dashboard" },
                { label: "Spin", to: "/spin" },
                { label: "Meals", to: "/meals" },
                { label: "Water", to: "/water" },
                { label: "Chat", to: "/chat" },
                { label: "Profile", to: "/profile" },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm font-medium text-cocoa dark:text-dark-white py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
