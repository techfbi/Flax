import { useState } from "react";
import { Bell, Sun, Moon, Monitor } from "lucide-react";
import { FoodSearch } from "@/features/home/FoodSearch";
import { NotificationDropdown } from "@/features/home/NotificationDropdown";
import { useTheme } from "@/context/ThemeContext";
import { useSpinStore } from "@/store/spinStore";
import { useNavigate } from "react-router-dom";
import type { Food } from "@/types/apiTypes";

interface PageTopBarProps {
  /** Uppercase page label, e.g. "SPIN". Ignored if leftContent is given. */
  title?: string;
  /** Anything richer than a title, e.g. the Noura icon plus description. */
  leftContent?: React.ReactNode;
  showSearch?: boolean;
}
/*
  Shared desktop header for pages that are not the homepage, keeps the
  same search, theme toggle, and notification bell that the homepage
  greeting row has, without repeating a greeting that only makes sense
  there.

  Selecting a food from search here sends the user to the Log intake
  tab with that food prefilled, same behavior as the homepage search.
*/
export const PageTopBar = ({
  title,
  leftContent,
  showSearch = true,
}: PageTopBarProps) => {
  const { theme, setTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const setPrefillMeal = useSpinStore((s) => s.setPrefillMeal);
  const navigate = useNavigate();

  const cycleTheme = () => {
    const next: Record<string, "light" | "dark" | "system"> = {
      light: "dark",
      dark: "system",
      system: "light",
    };
    setTheme(next[theme]);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  const handleSelectFood = (food: Food) => {
    setPrefillMeal({ food_ref: food._id, food_name: food.name });
    try {
      sessionStorage.setItem(
        "homepage-active-tab",
        JSON.stringify("logintake"),
      );
    } catch {
      // sessionStorage unavailable, homepage opens on its default tab
    }
    navigate("/");
  };

  return (
    <div className="hidden md:flex items-center justify-between px-8 pt-2 lg:pt-8 pb-5 shrink-0">
      {leftContent ? (
        leftContent
      ) : title ? (
        <h1 className="font-heading font-bold text-lg lg:text-xl uppercase tracking-wide text-cocoa/70 dark:text-dark-white/70">
          {title}
        </h1>
      ) : (
        <div />
      )}

      <div className="flex items-center md:gap-5 lg:gap-10 md:mr-0 lg:mr-2">
        {showSearch && <FoodSearch onSelectFood={handleSelectFood} />}

        <button
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}`}
          className="text-cocoa dark:text-dark-white hover:opacity-70 transition-opacity"
        >
          <ThemeIcon
            size={20}
            fill={theme === "dark" ? "dark-white" : "cocoa"}
          />
        </button>

        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
            className="relative text-cocoa dark:text-dark-white hover:opacity-70 mt-2 transition-opacity"
          >
            <Bell size={20} fill="cocoa" />
            <span
              className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full
              bg-pawpaw text-surface text-[10px] font-bold
              flex items-center justify-center"
            >
              1
            </span>
          </button>
          {notifOpen && (
            <NotificationDropdown onClose={() => setNotifOpen(false)} />
          )}
        </div>
      </div>
    </div>
  );
};
