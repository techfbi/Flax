import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageTopBar } from "@/components/layout/PageTopBar";
import { MobileTopNav } from "@/components/layout/MobileTopNav";
import { NouraFullChat } from "@/features/home/NouraFullChat";
import { StreakPanel } from "@/features/home/StreakPanel";
import { useTheme } from "@/context/ThemeContext";
import api from "@/lib/api";
import type {
  ApiResponse,
  DashboardData,
  WaterData,
  StreakData,
} from "@/types/apiTypes";

/*
  Noura full chat page at /ask-noura.
  The Noura icon, name, and description live in the header row, same
  line as search, theme, and bell, on every tier from tablet up. They
  are not a side column, the chat gets the full width next to the
  sidebar and the streak panel.

  The whole page is locked to the viewport height on every tier, only
  the chat's own message list scrolls. This overrides AppLayout's
  normal "mobile and tablet scroll the whole page" behavior on purpose,
  this one page needs the app like fixed shell on every screen size.
*/

const NouraIdentity = () => (
  <div className="flex items-center gap-3 min-w-0">
    <div className="w-10 h-10 rounded-full bg-surface-two dark:bg-black-surface border-2 border-cocoa/10 dark:border-dark-white/10 flex items-center justify-center shrink-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#E8623C">
        <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" />
      </svg>
    </div>
    <div className="min-w-0">
      <p className="font-heading font-bold text-sm lg:text-base text-cocoa dark:text-dark-white">
        Noura
      </p>
      <p className="text-[11px] lg:text-xs text-cocoa-faded leading-snug truncate max-w-[220px] lg:max-w-[280px] lg:whitespace-normal">
        Your nutrition assistant. Ask about meals, ingredients, or what fits
        your goal today.
      </p>
    </div>
  </div>
);

export const AskNouraPage = () => {
  const { resolvedTheme } = useTheme();

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

  const { data: waterData } = useQuery({
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

  return (
    <AppLayout>
      <div
        className="flex flex-col h-screen overflow-hidden"
        style={{
          background:
            resolvedTheme === "dark"
              ? "linear-gradient(180deg, #3E4E42 -10%, #2D342C 4%, #2D342C 10%, #171410 45%)"
              : "linear-gradient(170deg, #9DAFA1 15%, #EAE8DE 45%, #EAE8DE 30%, #F6F1E7 100%)",
        }}
      >
        <div className="flex-1 flex flex-col min-h-0 w-full max-w-[1700px] mx-auto overflow-hidden">
          {/* Tablet and desktop: identity block sits left of search,
          theme, and bell, one header row, sticky since it is outside
          the scrolling chat area below. */}
          <PageTopBar leftContent={<NouraIdentity />} />

          {/* Mobile: Flax nav first, then the identity row right under
          it, both outside the chat's own scroll area. */}
          <div className="md:hidden shrink-0">
            <MobileTopNav />
            <div className="px-4 pt-20 pb-3">
              <NouraIdentity />
            </div>
          </div>

          <div className="flex-1 flex min-h-0 gap-6 px-4 md:px-6 pb-4 overflow-hidden">
            {/* Chat gets the full remaining width, no side column
            stealing space from it anymore. */}
            <div className="flex-1 min-w-0 min-h-0">
              <NouraFullChat />
            </div>

            {/* Streak panel, desktop only, unchanged from before. */}
            <div className="hidden lg:flex flex-col w-[340px] shrink-0 pt-2 overflow-y-auto">
              <StreakPanel
                streakData={streakData}
                dashData={dashData}
                waterData={waterData}
              />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AskNouraPage;
