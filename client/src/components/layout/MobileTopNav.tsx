import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Bell,
  LogOut,
  Settings,
  Home,
  BarChart2,
  History,
  Sun,
  Moon,
  Monitor,
  MessageCircle,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuthStore } from "@/store/authStore";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import api from "@/lib/api";
import type { InternalAxiosRequestConfig } from "axios";

/*
  Mobile top nav. Floating rounded card, same pattern as landing page navbar.
  Logo left. Bell (with unread badge) + avatar circle + hamburger right.
  Hamburger opens a drawer with nav links.
*/
export const MobileTopNav = () => {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const cycleTheme = () => {
    const next: Record<string, "light" | "dark" | "system"> = {
      light: "dark",
      dark: "system",
      system: "light",
    };
    setTheme(next[theme]);
  };
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout", {}, {
        _skipRefresh: true,
      } as InternalAxiosRequestConfig);
    } catch {
      /* best effort */
    }
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <div className="px-0 fixed top-1 left-4 right-4 z-50">
        <div
          className="bg-white/70 dark:bg-cocoa/70
          backdrop-blur-md
          rounded-2xl shadow-lg
          border border-white/20 dark:border-white/10
          px-5 py-5 h-14 flex items-center justify-between
          max-w-7xl mx-auto"
        >
          {/* Logo */}
          <Link to="/" aria-label="Home">
            <img
              src={
                resolvedTheme === "dark"
                  ? "/images/logoDark.png"
                  : "/images/logoLight.png"
              }
              alt="Flax"
              className="h-[32px] mt-1 w-auto object-contain"
            />
          </Link>

          {/* Right: bell + avatar + menu */}
          <div className="flex items-center gap-5">
            {/* Theme toggle */}
            <button
              onClick={cycleTheme}
              aria-label={`Theme: ${theme}`}
              className=" text-cocoa dark:text-dark-white"
            >
              <ThemeIcon size={20} />
            </button>
            {/* Notification bell */}
            <Link to="/notifications" className="relative">
              <Bell size={20} className="text-cocoa dark:text-dark-white" />
              {/* Unread badge - shown only when count > 0 */}
              {/* TODO: wire to real notification count from web push */}
              <span
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full
                bg-pawpaw text-surface text-[9px] font-bold
                flex items-center justify-center"
              >
                1
              </span>
            </Link>

            {/* Hamburger */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="text-cocoa dark:text-dark-white"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div
            className="mt-2 bg-surface dark:bg-black-surface rounded-2xl
            shadow-md px-4 py-3 flex flex-col gap-1"
          >
            {[
              { to: "/", icon: Home, label: "Homepage" },
              { to: "/dashboard", icon: BarChart2, label: "Dashboard" },
              { to: "/spin-history", icon: History, label: "Spin history" },
              { to: "/ask-noura", icon: MessageCircle, label: "Ask Noura" },
              { to: "/settings", icon: Settings, label: "Settings" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-2 py-2.5 text-sm font-medium
                  text-cocoa dark:text-dark-white hover:opacity-70 transition-opacity"
                onClick={() => setMenuOpen(false)}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => {
                setMenuOpen(false);
                setShowLogout(true);
              }}
              className="flex items-center gap-3 px-2 py-2.5 text-sm font-medium
                text-cocoa/60 dark:text-dark-white/50 w-full text-left"
            >
              <LogOut size={18} />
              Log out
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={showLogout}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmLabel="Log out"
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
      />
    </>
  );
};
