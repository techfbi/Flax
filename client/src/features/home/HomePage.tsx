import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Sun, Moon, Monitor } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GoalTab } from "./GoalTab";
import { LogIntakeTab } from "./LogIntakeTab";
import { HistoryTab } from "./HistoryTab";
import { StreakPanel } from "./StreakPanel";
import { NouraChat } from "./NouraChat";
import { NotificationDropdown } from "./NotificationDropdown";
import { FoodSearch } from "./FoodSearch";
import { useAuthStore } from "@/store/authStore";
import { useTheme } from "@/context/ThemeContext";
import { MobileTopNav } from "@/components/layout/MobileTopNav";
import api from "@/lib/api";
import { useSessionState } from "@/hooks/useSessionState";
import { UserAvatar } from "@/components/layout/Sidebar";
import { useSpinStore } from "@/store/spinStore";
import { PantryTab } from "./PantryTab";
import type {
  ApiResponse,
  DashboardData,
  WaterData,
  StreakData,
} from "@/types/apiTypes";

type Tab = "goal" | "pantry" | "logintake" | "history";

/*
  HomePage: the main authenticated page at "/".
  Desktop: sidebar (from AppLayout) + content area.
  Mobile: mobile top nav (from AppLayout) + content.

  Layout:
    Top: greeting + search + theme toggle + notifications (desktop)
    Tabs: Goal, Log intake, History
    Left panel (large): active tab content
    Right panel: streak cards + Noura chat
*/
const HomePage = () => {
  const { user, avatarUrl } = useAuthStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useSessionState<Tab>(
    "homepage-active-tab",
    "goal",
  );
  const [notifOpen, setNotifOpen] = useState(false);
  const setPrefillMeal = useSpinStore((s) => s.setPrefillMeal);

  const firstName = user?.display_name?.split(" ")[0] ?? "User";

  const { data: dashData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ dashboard: DashboardData }>>(
        "/api/meal-logs/dashboard",
      );
      return data.data.dashboard;
    },
    staleTime: 60 * 1000,
  });

  const { data: waterData, refetch: refetchWater } = useQuery({
    queryKey: ["water", "today"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await api.get<ApiResponse<WaterData>>(
        `/api/water?date=${today}`,
      );
      return data.data;
    },
    staleTime: 30 * 1000,
  });

  const { data: streakData } = useQuery({
    queryKey: ["streaks"],
    queryFn: async () => {
      const { data } =
        await api.get<ApiResponse<{ streaks: StreakData }>>("/api/streaks");
      return data.data.streaks;
    },
    staleTime: 5 * 60 * 1000,
  });

  const hasStreak = (streakData?.goal_streak ?? 0) > 0;

  const cycleTheme = () => {
    const next: Record<string, "light" | "dark" | "system"> = {
      light: "dark",
      dark: "system",
      system: "light",
    };
    setTheme(next[theme]);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  const tabs: { key: Tab; label: string }[] = [
    { key: "goal", label: "Goal" },
    { key: "pantry", label: "Pantry items" },
    { key: "logintake", label: "Log intake" },
    { key: "history", label: "History" },
  ];

  return (
    <AppLayout>
      <div
        className="flex flex-col lg:h-full lg:overflow-hidden"
        style={{
          background:
            resolvedTheme === "dark"
              ? "linear-gradient(180deg, #3E4E42 -10%, #2D342C 4%, #2D342C 10%, #171410 45%)"
              : "linear-gradient(170deg, #9DAFA1 15%, #EAE8DE 45%, #EAE8DE 30%, #F6F1E7 100%)",
        }}
      >
        {/* CENTERING WRAPPER */}
        <div
          className="flex-1 flex flex-col min-h-0 w-full
          max-w-[1700px] mx-auto overflow-hidden"
        >
          {/* Desktop top header */}
          <div className="hidden md:flex items-start justify-between px-8 pt-2 lg:pt-8 pb-5 shrink-0">
            {/* Greeting */}
            <div>
              <h1
                className="font-heading md:text-[20px] lg:text-2xl font-bold text-cocoa dark:text-dark-white
              flex items-center gap-2"
              >
                Hello, {firstName}!
                {hasStreak && (
                  <span>
                    <img
                      src="/images/fire.png"
                      alt="fire"
                      className="object-contain md:w-[17px] lg:w-[25px] flex"
                    />
                  </span>
                )}
              </h1>
              <p className="text-xs lg:text-sm text-cocoa/60 dark:text-dark-white/60 mt-0.5">
                {hasStreak
                  ? "You're on fire. Let's see what we've got here, today."
                  : "Let's see what we've got here, today."}
              </p>
            </div>

            {/* Search + icons */}
            <div className="flex items-center md:gap-5 lg:gap-10 md:mr-0 lg:mr-2">
              <FoodSearch
                onSelectFood={(food) => {
                  setPrefillMeal({ food_ref: food._id, food_name: food.name });
                  setActiveTab("logintake");
                }}
              />

              {/* Theme toggle */}
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

              {/* Notification bell */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label="Notifications"
                  className="relative text-cocoa dark:text-dark-white hover:opacity-70 mt-2
                  transition-opacity"
                >
                  <Bell size={20} fill="cocoa" className="" />
                  {/* Unread badge */}
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

          {/* Main content: left panel + right panel */}
          <div className=" flex gap-5 px-4 md:px-5 pb-4  overflow-x-hidden w-full lg:min-h-0 lg:flex-1">
            {/* Left: tabs + content */}

            <div className="flex-1 flex flex-col min-w-0 lg:min-w-[500px] lg:min-h-0 ">
              {/* Mobile top nav — sticky */}
              <div className="md:hidden">
                <MobileTopNav />
              </div>
              <div className="md:hidden mt-20 mb-7 shrink-0 flex items-center gap-2 ">
                {/* Mobile greeting + Avatar */}
                <UserAvatar avatarUrl={avatarUrl} name={firstName} size={35} />
                <div className="space-y-[-2px]">
                  <h1
                    className="font-heading text-[16px] font-bold text-cocoa dark:text-dark-white
                flex items-center gap-2"
                  >
                    Hello, {firstName}!
                    {hasStreak && (
                      <span>
                        <img
                          src="/images/fire.png"
                          alt="fire"
                          className="object-contain w-[17px] flex"
                        />
                      </span>
                    )}
                  </h1>
                  <p className="text-[12px] text-cocoa/50 dark:text-dark-white/50">
                    {hasStreak
                      ? "You're on fire. Let's see what we've got here, today."
                      : "Let's see what we've got here, today."}
                  </p>
                </div>
              </div>

              {/* Mobile streak cards */}
              <div className="md:hidden grid grid-cols-2 gap-3 mb-3 shrink-0">
                <MobileStreakCard
                  icon={
                    <img
                      src="/images/fire.png"
                      alt="fire"
                      className="object-contain w-[22px] flex"
                    />
                  }
                  label="Streaks"
                  days={streakData?.goal_streak ?? 0}
                  level={dashData?.daily_totals.calories ?? 0}
                  target={dashData?.calorie_target ?? 0}
                  type="calorie"
                  hasStreak={hasStreak}
                />
                <MobileStreakCard
                  icon="💧"
                  label="Water"
                  days={streakData?.water_streak ?? 0}
                  level={waterData?.daily_total ?? 0}
                  target={waterData?.target_ml ?? 0}
                  type="water"
                  hasStreak={hasStreak}
                />
              </div>

              {/* Tab bar */}
              <div className="relative mt-4  flex bg-cocoa/4 dark:bg-dark-white/4 rounded-t-2xl shrink-0 md:mt-0 lg:mt-5">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`font-heading relative px-5 py-2 text-xs lg:text-sm  transition-colors duration-150 z-10
                        ${
                          activeTab === tab.key
                            ? "text-cocoa dark:text-dark-white font-bold"
                            : "text-cocoa/90 lg:text-cocoa dark:text-dark-white/60 hover:text-cocoa dark:hover:text-dark-white font-medium md:font-normal"
                        }
                    `}
                  >
                    {/* Sliding background pill */}
                    {activeTab === tab.key && (
                      <span
                        className="absolute inset-0 bg-surface-two dark:bg-black-surface
                        rounded-t-xl shadow-sm z-[-1] transition-all duration-200"
                      />
                    )}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div
                className="bg-surface-two dark:bg-black-surface
                    rounded-b-2xl rounded-tr-2xl lg:flex-1 lg:min-h-0 lg:overflow-y-auto min-h-[calc(100vh-330px)] md:min-h-[calc(100vh-150px)]"
              >
                {activeTab === "goal" && (
                  <GoalTab
                    dashData={dashData}
                    waterData={waterData}
                    onRefetchWater={refetchWater}
                    onLogMealClick={() => setActiveTab("logintake")}
                  />
                )}
                {activeTab === "pantry" && <PantryTab />}
                {activeTab === "logintake" && (
                  <LogIntakeTab
                    waterData={waterData}
                    onRefetchWater={refetchWater}
                  />
                )}
                {activeTab === "history" && <HistoryTab />}
              </div>
            </div>

            {/* Right panel: streaks + Noura — desktop only */}
            <div className="hidden md:flex md:flex-1 flex-col gap-4 md:max-w-[300px] lg:max-w-[380px] shrink-1 overflow-y-auto md:mt-1 lg:mt-6">
              <StreakPanel
                streakData={streakData}
                dashData={dashData}
                waterData={waterData}
              />
              <NouraChat />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

/*
  Mobile-only condensed streak card shown at top of mobile homepage.
*/
const MobileStreakCard = ({
  icon,
  label,
  days,
  level,
  target,
  type,
  hasStreak,
}: {
  icon: React.ReactNode;
  label: string;
  days: number;
  level: number;
  target: number;
  type: "calorie" | "water";
  hasStreak: boolean;
}) => {
  const pct =
    target > 0 ? Math.min(100, Math.round((level / target) * 100)) : 0;

  return (
    <div className="bg-surface-two dark:bg-black-surface rounded-2xl px-4 py-3 shadow-md">
      <div className="flex items-center gap-2 mb-2">
        {hasStreak ? (
          <span className="text-xl">{icon}</span>
        ) : (
          <span className="text-xl opacity-15 dark:opacity-10">{icon}</span>
        )}
        <div className="space-y-[-1px]">
          <p className="text-xs font-semibold text-cocoa/40 dark:text-dark-white/45">
            {label}
          </p>
          <p className="font-heading font-bold text-sm text-cocoa dark:text-dark-white">
            {days > 0 ? `${days} ${days === 1 ? "day" : "days"}` : "No streak"}
          </p>
        </div>
      </div>
      <div className="mb-1 flex w-full justify-between items-center shrink-0">
        <p className="text-[12px] text-cocoa-faded font-medium">
          {type === "calorie" ? "Today's calorie" : "Hydration level"}
        </p>
        <p className="text-[12px] text-cocoa-faded font-bold">{pct}%</p>
      </div>
      {type === "calorie" ? (
        <div className="h-1.5 rounded-full bg-cocoa/10 dark:bg-dark-white/10">
          <div
            className="h-full rounded-full bg-pawpaw dark:bg-black-pawpaw transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <p className="text-xs font-bold text-cocoa dark:text-dark-white">
          {level}
          <span className="text-cocoa-faded font-normal"> / {target}ml</span>
        </p>
      )}
    </div>
  );
};

export default HomePage;
