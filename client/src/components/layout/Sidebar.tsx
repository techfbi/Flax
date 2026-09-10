import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  BarChart2,
  MessageCircle,
  LogOut,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useAuthStore } from "@/store/authStore";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import api from "@/lib/api";
import type { InternalAxiosRequestConfig } from "axios";
import { MessageSquare } from "lucide-react";
import { useReviewStore } from "@/store/reviewStore";
import { useReviewUnread } from "@/hooks/useReviewUnread";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/*
  Desktop sidebar.
  Expanded: 220px wide. Logo + name, collapse toggle, nav items with icon+label.
  Collapsed: 64px wide. Icon only.
  Active: off-white bg + left pawpaw border (light). dark-bg bg + dark-pawpaw border (dark).
  Bottom: logout, avatar+firstname, settings.
  Logo icon: place at public/images/logoIcon.png (40x36px).
*/
export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { resolvedTheme } = useTheme();
  const { user, avatarUrl, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const { open: openReviews } = useReviewStore();
  const { data: hasUnreadReview } = useReviewUnread();

  const firstName = user?.display_name?.split(" ")[0] ?? "User";

  const navItems = [
    { to: "/", icon: Home, label: "Homepage" },
    { to: "/spin", icon: RefreshCw, label: "Spin" },
    { to: "/dashboard", icon: BarChart2, label: "Dashboard" },
    { to: "/ask-noura", icon: MessageCircle, label: "Ask Noura", dot: true },
  ];

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout", {}, {
        _skipRefresh: true,
      } as InternalAxiosRequestConfig);
    } catch {
      /* logout best effort */
    }
    clearAuth();
    navigate("/login", { replace: true });
  };

  const activeClass = `
    bg-off-white dark:bg-dark-bg
    border-l-[3px] border-pawpaw dark:border-black-pawpaw
    text-cocoa dark:text-dark-white
  `;
  const inactiveClass = `
    text-cocoa/60 dark:text-dark-white/50
    hover:bg-cocoa/5 dark:hover:bg-dark-white/5
    border-l-2 border-transparent
  `;

  return (
    <>
      <aside
        className={`
          h-screen flex flex-col
          bg-surface-two dark:bg-black-surface
          transition-all duration-200
          ${collapsed ? "w-16" : "w-[220px]"}
        `}
      >
        {/* Logo + collapse toggle */}
        <div
          className={`flex items-center md:pt-5 lg:pt-9 pb-6 px-3 ${collapsed ? "flex-col gap-4" : "justify-between"}`}
        >
          {!collapsed && (
            <Link to="/" aria-label="Home">
              <img
                src={
                  resolvedTheme === "dark"
                    ? "/images/logoDark.png"
                    : "/images/logoLight.png"
                }
                alt="Flax"
                className="h-[35px] w-auto object-contain"
              />
            </Link>
          )}
          {collapsed && (
            /*
              Collapsed logo: icon only.
              Place at public/images/logoIcon.png (40x36px).
            */
            <Link to="/" aria-label="Home">
              <img
                src={
                  resolvedTheme === "dark"
                    ? "/images/logoIconDark.png"
                    : "/images/logoIcon.png"
                }
                alt="Flax"
                className="w-8 h-8 object-contain mx-auto"
              />
            </Link>
          )}
          {!collapsed && (
            /* Two vertical bars collapse icon */
            <button
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="text-cocoa/40 dark:text-dark-white/40 hover:text-cocoa
                dark:hover:text-dark-white transition-colors p-1"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect
                  x="2"
                  y="2"
                  width="4"
                  height="14"
                  rx="1.5"
                  fill="currentColor"
                  opacity="0.5"
                />
                <rect
                  x="10"
                  y="2"
                  width="6"
                  height="14"
                  rx="1.5"
                  fill="currentColor"
                  opacity="0.3"
                />
              </svg>
            </button>
          )}
          {collapsed && (
            <button
              onClick={onToggle}
              aria-label="Expand sidebar"
              className="text-cocoa/50 dark:text-dark-white/50
      hover:text-cocoa dark:hover:text-dark-white
      transition-colors mx-auto"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M7 4l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2 lg:mt-5 lg:gap-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 
                transition-colors duration-150 relative
                ${isActive ? activeClass : inactiveClass}`
              }
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="text-sm font-heading font-medium flex items-center gap-1.5">
                  {item.label}
                  {item.dot && (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill={resolvedTheme === "dark" ? "#9CA3AF" : "#E8623C"}
                    >
                      <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" />
                    </svg>
                  )}
                </span>
              )}
            </NavLink>
          ))}

          {/* Reviews button, opens the review sheet */}
          <button
            onClick={openReviews}
            className={`flex items-center gap-3 px-3 py-2.5 w-full
              transition-colors duration-150 relative
              text-cocoa/60 dark:text-dark-white/50
              hover:bg-cocoa/5 dark:hover:bg-dark-white/5
              border-l-2 border-transparent`}
          >
            <div className="relative shrink-0">
              <MessageSquare size={18} />
              {hasUnreadReview && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-pawpaw dark:bg-black-pawpaw" />
              )}
            </div>
            {!collapsed && (
              <span className="text-sm font-heading font-medium">Reviews</span>
            )}
          </button>
        </nav>

        {/* Bottom section */}
        <div className="flex flex-col gap-0.5 px-2 pb-4 lg:mb-5 lg:gap-4">
          {/* Logout */}
          <button
            onClick={() => setShowLogout(true)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg
              text-cocoa/60 dark:text-dark-white/50
              hover:bg-cocoa/5 dark:hover:bg-dark-white/5
              transition-colors duration-150 w-full text-left`}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && (
              <span className="text-sm font-heading font-medium">Log out</span>
            )}
          </button>

          {/* Avatar + firstname */}

          <div className=" cursor-pointer">
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5
              transition-colors duration-150
              ${isActive ? activeClass : inactiveClass}`
              }
            >
              <UserAvatar avatarUrl={avatarUrl} name={firstName} />

              {!collapsed && (
                <span className="text-sm font-heading font-medium text-cocoa dark:text-dark-white truncate">
                  {firstName}
                </span>
              )}
            </NavLink>
          </div>

          {/* Settings */}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5
              transition-colors duration-150
              ${isActive ? activeClass : inactiveClass}`
            }
          >
            <Settings size={18} className="shrink-0" />
            {!collapsed && (
              <span className="text-sm font-heading font-medium">Settings</span>
            )}
          </NavLink>
        </div>
      </aside>

      {/* Logout confirmation modal */}
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

/* Avatar circle: shows image or grey profile icon */
export const UserAvatar = ({
  avatarUrl,
  name,
  size = 32,
}: {
  avatarUrl: string | null;
  name: string;
  size?: number;
}) => {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-cocoa/15 dark:bg-dark-white/15
        flex items-center justify-center shrink-0"
    >
      {/* Grey human profile icon */}
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="8"
          r="4"
          fill="currentColor"
          className="text-cocoa/40 dark:text-dark-white/40"
        />
        <path
          d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-cocoa/40 dark:text-dark-white/40"
        />
      </svg>
    </div>
  );
};
