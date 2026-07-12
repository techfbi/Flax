import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ThumbsUp, X } from "lucide-react";
import { toast } from "sonner";
import { SpinFrame } from "./SpinFrame";
import { SpinFilter } from "./SpinFilters";
import { SpinTipsPopup } from "./SpinTipsPopup";
import { SpinHistoryPanel } from "./SpinHistoryPanel";
import { PageTopBar } from "@/components/layout/PageTopBar";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import { goToLogMeal } from "@/lib/prefillNavigation";
import { useTheme } from "@/context/ThemeContext";
import { useScreenTier } from "@/hooks/useMediaQuery";
import { useSpinSound } from "@/hooks/useSpinSound";
import api from "@/lib/api";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSpinStore } from "@/store/spinStore";
import { AnimatePresence } from "framer-motion";
import type {
  ApiResponse,
  SpinResult,
  SpinFilters as SpinFiltersType,
  MealType,
} from "@/types/apiTypes";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileTopNav } from "@/components/layout/MobileTopNav";

const TIPS_STORAGE_KEY = "flax-spin-tips-dismissed";
const SPIN_TIMEOUT_MS = 10000;

const NUTRITION_BARS = [
  { key: "calories_per_100g", label: "Calories per 100g", color: "#2F5D4B" },
  { key: "protein_g", label: "Protein", color: "#F43F5E" },
  { key: "carbs_g", label: "Carbs", color: "#EAB308" },
  { key: "fat_g", label: "Fat", color: "#F59E0B" },
] as const;

type MobileSection = "spin" | "filters" | "history";

export const SpinTab = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const tier = useScreenTier();
  const { data: profile } = useUserProfile();
  const { enabled: spinSoundEnabled } = useSpinSound();

  const [showTips, setShowTips] = useState(false);
  const [tipsChecked, setTipsChecked] = useState(false);
  const { result, setResult } = useSpinStore();
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(
    null,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [mobileSection, setMobileSection] = useState<MobileSection>("spin");

  const spinControllerRef = useRef<AbortController | null>(null);
  const spinTimeoutRef = useRef<number | null>(null);
  const clearSpinWatchdog = () => {
    if (spinTimeoutRef.current) {
      window.clearTimeout(spinTimeoutRef.current);
      spinTimeoutRef.current = null;
    }
  };

  //-------------------------------------------------------------------------------------
  //spin button float
  const spinButtonRef = useRef<HTMLDivElement>(null);
  const [showFloatingSpin, setShowFloatingSpin] = useState(false);
  useEffect(() => {
    const checkVisibility = () => {
      if (!spinButtonRef.current) return;
      const rect = spinButtonRef.current.getBoundingClientRect();
      // The button is considered visible if any part of it is within the viewport
      const isVisible =
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0;
      setShowFloatingSpin(!isVisible);
    };

    // Initial check
    checkVisibility();

    // Listen to scroll and resize events
    window.addEventListener("scroll", checkVisibility, { passive: true });
    window.addEventListener("resize", checkVisibility, { passive: true });

    return () => {
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
    };
  }, []);
  //-------------------------------------------------------------------------------

  useEffect(() => {
    if (!tipsChecked) {
      setTipsChecked(true);
      const dismissed = localStorage.getItem(TIPS_STORAGE_KEY);
      const sessionDismissed = sessionStorage.getItem(TIPS_STORAGE_KEY);
      if (!dismissed && !sessionDismissed) setShowTips(true);
    }
  }, [tipsChecked]);

  const { data: filters } = useQuery({
    queryKey: ["spin-filters"],
    queryFn: async () => {
      const { data } =
        await api.get<
          ApiResponse<{ region: string; filters: SpinFiltersType }>
        >("/api/spin/filters");
      return data.data.filters;
    },
    staleTime: 5 * 60 * 1000,
  });

  // after
  const { data: cycleImages = [] } = useQuery({
    queryKey: ["spin-cycle-images"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ images: string[] }>>(
        "/api/spin/cycle-images",
      );
      return data.data.images;
    },
    staleTime: 10 * 60 * 1000,
  });

  const spinMutation = useMutation({
    mutationFn: async () => {
      const controller = new AbortController();
      spinControllerRef.current = controller;

      const body: Record<string, unknown> = {};
      if (selectedMealType) body.meal_type = selectedMealType;
      if (selectedTags.length) body.tags = selectedTags;

      const { data } = await api.post<ApiResponse<SpinResult>>(
        "/api/spin",
        body,
        { signal: controller.signal, timeout: SPIN_TIMEOUT_MS },
      );
      return data.data;
    },
    onMutate: () => {
      setIsSpinning(true);
      setErrorBanner(null);

      // This is the actual guarantee. It does not trust axios's own
      // timeout option to fire correctly, it forcibly stops the spin
      // and aborts the request on a plain browser timer no matter what
      // the network layer is doing underneath it.
      clearSpinWatchdog();
      spinTimeoutRef.current = window.setTimeout(() => {
        spinControllerRef.current?.abort();
        setIsSpinning(false);
        setErrorBanner(
          "Something went wrong. That took too long, please try again.",
        );
      }, SPIN_TIMEOUT_MS);
    },
    onSuccess: (data) => {
      clearSpinWatchdog();
      setTimeout(() => {
        setIsSpinning(false);
        setResult(data);
        if (data.recencyRelaxed === true) {
          toast.message(
            "All current filter matches seen. Showing previous meals",
          );
        }
        queryClient.invalidateQueries({ queryKey: ["spin-history"] });
      }, 3000);
    },
    onError: (err: unknown) => {
      clearSpinWatchdog();
      const axiosErr = err as {
        code?: string;
        response?: { status?: number };
      };

      // The watchdog already reset isSpinning and set the error banner
      // before this fires, ERR_CANCELED is just the abort call reaching
      // the promise afterwards, nothing left to do.
      if (axiosErr?.code === "ERR_CANCELED") return;

      setIsSpinning(false);
      const timedOut = axiosErr?.code === "ECONNABORTED";
      toast.error(
        timedOut
          ? "Something went wrong. That took too long, please try again."
          : axiosErr?.response?.status === 404
            ? "No meals found for your filters. Try adjusting your filters."
            : "Could not spin. Try again.",
      );
    },
  });
  useEffect(() => {
    return () => clearSpinWatchdog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const thumbsUp = useMutation({
    mutationFn: async () => {
      if (!result) return;
      await api.post("/api/spin/validate", {
        food_ref: result.food._id,
        food_name: result.food.name,
      });
    },
    onSuccess: () => toast.success("Added to your preferences"),
    onError: () => toast.error("Something went wrong, please try again."),
  });

  const flagMeal = useMutation({
    mutationFn: async () => {
      if (!result) return;
      await api.post("/api/spin/flag", {
        food_ref: result.food._id,
        food_name: result.food.name,
      });
    },
    onSuccess: () => {
      toast.success("Meal flagged. It will not appear again.");
      queryClient.invalidateQueries({ queryKey: ["spin-flagged"] });
    },
    onError: () => toast.error("Something went wrong, please try again."),
  });

  const handleLogMeal = () => {
    if (!result) return;
    goToLogMeal(navigate, {
      food_ref: result.food._id,
      food_name: result.food.name,
    });
  };

  const maxNutrition = result
    ? Math.max(
        result.food.calories_per_100g,
        result.food.protein_g,
        result.food.carbs_g,
        result.food.fat_g,
        1,
      )
    : 100;

  // Frame width shrinks a step at tablet so the frame plus bars row
  // does not crowd the page now that the right column also needs room.
  const frameWrapperClass =
    tier === "tablet"
      ? "w-full max-w-[220px] min-w-[190px]"
      : tier === "mobile"
        ? "w-full max-w-[300px] min-w-[150px]"
        : tier === "desktop"
          ? "w-full max-w-[300px] min-w-[180px]"
          : "w-full max-w-[300px] shrink-0";

  const nutritionBarsClass =
    tier === "mobile"
      ? "flex-1 min-w-[150px] w-full"
      : "flex-1 min-w-[190px] w-full";

  const actionButtons = (
    <div
      className={`flex items-center justify-between w-full max-w-[300px]
      ${tier === "mobile" ? "mx-auto" : ""}`}
    >
      <button
        onClick={() => thumbsUp.mutate()}
        disabled={!result || thumbsUp.isPending}
        aria-label="Like this meal"
        className="w-16 h-8 rounded-2xl flex items-center justify-center
        bg-off-white dark:bg-dark-bg
        border border-cocoa/15 dark:border-dark-white/15
        text-cocoa dark:text-dark-white
        hover:bg-surface dark:hover:bg-black-surface
        disabled:opacity-50 transition-colors"
      >
        <ThumbsUp size={16} />
      </button>
      <button
        onClick={() => flagMeal.mutate()}
        disabled={!result || flagMeal.isPending}
        aria-label="Flag this meal"
        className="w-16 h-8 rounded-2xl flex items-center justify-center
        bg-off-white dark:bg-dark-bg
        border border-cocoa/15 dark:border-dark-white/15
        text-cocoa dark:text-dark-white
        hover:bg-surface dark:hover:bg-black-surface
        disabled:opacity-50 transition-colors"
      >
        <img
          src="./images/redFlag.svg"
          alt="flag"
          className="object-contain w-[15px] flex"
        />
      </button>
      <button
        onClick={handleLogMeal}
        disabled={!result}
        className="px-2 text-xs lg:text-sm lg:font-medium h-8 rounded-2xl flex items-center justify-center
        bg-off-white dark:bg-dark-bg
        border border-cocoa/15 dark:border-dark-white/15
        text-cocoa dark:text-dark-white
        hover:bg-surface dark:hover:bg-black-surface
        disabled:opacity-50 transition-colors"
      >
        Log meal
      </button>
    </div>
  );

  const nutritionBars = (
    <div
      className={`space-y-2 lg:space-y-3 w-full ${tier === "mobile" ? "mt-5" : ""}`}
    >
      {NUTRITION_BARS.map((bar) => {
        const value = result?.food
          ? ((result.food as unknown as Record<string, number>)[bar.key] ?? 0)
          : 0;
        const pct =
          maxNutrition > 0 ? Math.min(100, (value / maxNutrition) * 100) : 0;

        return (
          <div key={bar.key}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: bar.color }}
                />
                <span
                  className={`text-cocoa dark:text-dark-white ${
                    tier === "tablet" ? "text-xs" : "text-xs lg:text-sm"
                  }`}
                >
                  {bar.label}
                </span>
              </div>
              {isSpinning ? (
                <span className="inline-block w-8 h-3.5 rounded bg-cocoa/10 dark:bg-dark-white/10 animate-pulse" />
              ) : (
                <span
                  className={`font-medium text-cocoa dark:text-dark-white ${
                    tier === "tablet" ? "text-xs" : "text-xs lg:text-sm"
                  }`}
                >
                  {value}g
                </span>
              )}
            </div>

            {isSpinning ? (
              <div className="h-1.5 rounded-full bg-cocoa/10 dark:bg-dark-white/10 animate-pulse" />
            ) : (
              <div className="h-1.5 rounded-full bg-cocoa/10 dark:bg-dark-white/10">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: result ? `${pct}%` : "0%",
                    backgroundColor: bar.color,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const nouraBox = isSpinning ? (
    <div className="h-28 rounded-2xl bg-cocoa/10 dark:bg-dark-white/10 animate-pulse w-full" />
  ) : (
    <div className="rounded-xl lg:rounded-2xl p-2 lg:p-4 bg-[rgba(47,93,75,0.14)] dark:bg-[#4d4d4d] w-full">
      <p className="font-heading text-sm md:text-xs lg:text-sm font-semibold text-cocoa dark:text-dark-white mb-2">
        Noura
      </p>
      <div className="flex gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="#E8623C"
          className="shrink-0 mt-0.5"
        >
          <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" />
        </svg>
        <p className="text-xs lg:text-sm italic text-cocoa dark:text-dark-white leading-relaxed">
          {result?.reasoning ??
            "Spin, and I will tell you why each meal was picked"}
        </p>
      </div>
    </div>
  );

  const foodNameBlock = isSpinning ? (
    <div
      className={`space-y-2 max-w-[800px] ${
        tier === "mobile" ? "mx-auto text-center" : ""
      }`}
    >
      <div className="h-6 w-36 rounded-lg bg-cocoa/10 dark:bg-dark-white/10 animate-pulse mx-auto md:mx-0" />
      <div className="h-4 w-full rounded-lg bg-cocoa/10 dark:bg-dark-white/10 animate-pulse" />
      <div className="h-4 w-3/4 rounded-lg bg-cocoa/10 dark:bg-dark-white/10 animate-pulse mx-auto md:mx-0" />
    </div>
  ) : (
    <div
      className={`max-w-[800px] ${tier === "mobile" ? "mx-auto text-center" : ""}`}
    >
      <h2 className="font-heading font-bold text-lg lg:text-xl text-cocoa dark:text-dark-white mb-1">
        {result?.food.name ?? "Spin to get a suggestion"}
      </h2>
      <p
        className={`text-sm lg:text-base text-cocoa/80 dark:text-surface/50 leading-relaxed ${tier === "mobile" ? "max-w-[310px]" : ""}`}
      >
        {result?.food.description ?? ""}
      </p>
    </div>
  );

  const spinButton = (
    <div
      ref={spinButtonRef}
      className={`w-[200px] lg:max-w-[300px] ${tier === "mobile" ? "mx-auto" : ""}`}
    >
      <button
        onClick={() => spinMutation.mutate()}
        disabled={isSpinning}
        className="w-full py-3 lg:py-4 rounded-xl text-sm font-bold
          bg-pawpaw dark:bg-black-pawpaw text-surface
          hover:opacity-90 transition-opacity
          disabled:opacity-60"
      >
        {isSpinning ? "Spinning..." : "Spin"}
      </button>
    </div>
  );

  // Order, top to bottom, exactly as specified: frame with its action
  // buttons beside the nutrition bars, then food name and description,
  // then the Noura box, then the Spin button last.
  const mainContentNode = (
    <div
      className={`flex flex-col gap-5 ${tier === "mobile" ? "mt-5" : tier === "desktop" ? "max-w-[1100px]" : ""}`}
    >
      <AnimatePresence>
        {showTips && (
          <SpinTipsPopup
            onOk={() => {
              sessionStorage.setItem(TIPS_STORAGE_KEY, "1");
              setShowTips(false);
            }}
            onDontShow={() => {
              localStorage.setItem(TIPS_STORAGE_KEY, "1");
              setShowTips(false);
            }}
          />
        )}
      </AnimatePresence>

      <div
        className={`flex gap-6 ${
          tier === "mobile"
            ? "flex-row max-[375px]:flex-col max-[375px]:items-center items-start"
            : "flex-row items-start"
        }`}
      >
        <div className={`${frameWrapperClass} flex flex-col gap-4`}>
          <SpinFrame
            isSpinning={isSpinning}
            result={result?.food ?? null}
            cycleImages={cycleImages}
            soundEnabled={spinSoundEnabled}
          />
          {actionButtons}
        </div>

        <div className={nutritionBarsClass}>{nutritionBars}</div>
      </div>

      {foodNameBlock}
      {nouraBox}
      {spinButton}
    </div>
  );

  const filtersNode = (
    <SpinFilter
      filters={filters}
      selectedMealType={selectedMealType}
      onMealTypeChange={setSelectedMealType}
      selectedTags={selectedTags}
      onTagsChange={setSelectedTags}
      userAllergies={profile?.health?.allergies ?? []}
    />
  );

  const historyNode = <SpinHistoryPanel />;

  const mobileTabs: { key: MobileSection; label: string }[] = [
    { key: "spin", label: "Spin" },
    { key: "filters", label: "Filters" },
    { key: "history", label: "Spin history" },
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
        <div className="flex-1 flex flex-col min-h-0 w-full max-w-[1700px] mx-auto lg:overflow-hidden">
          <PageTopBar title="Spin meal" />

          <div className="md:hidden">
            <MobileTopNav />
          </div>

          {/* Mobile only page title, PageTopBar hides its title below md */}
          {tier === "mobile" && (
            <p className="mt-20 px-5 font-heading font-bold text-base tracking-wide text-cocoa/70 dark:text-dark-white/70 shrink-0">
              Spin meal
            </p>
          )}

          {errorBanner && (
            <div
              className={`flex justify-center shrink-0 px-4 ${
                tier === "mobile" ? "mt-3" : "mt-3"
              }`}
            >
              <div className="flex items-center gap-2 bg-rose-500 text-white text-xs font-medium px-4 py-2 rounded-full">
                <span>{errorBanner}</span>
                <button
                  onClick={() => setErrorBanner(null)}
                  aria-label="Dismiss"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {tier === "mobile" && (
            <div className="mt-4 mx-4 shrink-0">
              <SlidingTabs
                tabs={mobileTabs}
                active={mobileSection}
                onChange={setMobileSection}
              />
            </div>
          )}

          {/* MOBILE: one section at a time, whole page scrolls, per AppLayout */}
          {tier === "mobile" && (
            <div className="flex-1 px-4 py-5">
              {mobileSection === "spin" && mainContentNode}
              {mobileSection === "filters" && filtersNode}
              {mobileSection === "history" && historyNode}
            </div>
          )}

          {/* TABLET: main column (spin content, filters below it) plus a
          right column holding only spin history, height capped to the
          remaining viewport, narrower than desktop so the left side
          keeps most of the room. */}
          {tier === "tablet" && (
            <div className="flex-1 flex gap-5 px-6 py-5 items-start">
              <div className="flex-1 min-w-0">
                {mainContentNode}
                <div className="mt-8">{filtersNode}</div>
              </div>
              <div
                className="w-[260px] shrink-0 sticky top-5 overflow-y-auto"
                style={{ maxHeight: "calc(100vh - 100px)" }}
              >
                {historyNode}
              </div>
            </div>
          )}

          {/* DESKTOP: no page scroll, right column a little wider so
          filters have room to breathe and history still gets a
          reasonable height under it. */}
          {tier === "desktop" && (
            <div className="flex-1 min-h-0 flex gap-8 px-8 pb-6">
              <div className="flex-1 min-w-0 overflow-y-auto mt-20">
                {mainContentNode}
              </div>
              <div className="max-w-[470px] shrink-1 flex flex-col min-h-0 mt-[-10px]">
                <div className="shrink-1">{filtersNode}</div>
                <div className="flex-1 min-h-0 overflow-y-auto mt-5">
                  {historyNode}
                </div>
              </div>
            </div>
          )}
          {showFloatingSpin && (
            <div className="fixed bottom-4 right-4 z-50 max-w-[200px] sm:max-w-[220px]">
              <button
                onClick={() => spinMutation.mutate()}
                disabled={isSpinning}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold
        bg-pawpaw dark:bg-black-pawpaw text-surface shadow-lg
        hover:opacity-90 transition-opacity
        disabled:opacity-60"
              >
                {isSpinning ? "Spinning..." : "Spin"}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};
