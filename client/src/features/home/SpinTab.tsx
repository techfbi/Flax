import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { SpinFrame } from "./SpinFrame";
import { SpinFilter } from "./SpinFilters";
import { SpinTipsPopup } from "./SpinTipsPopup";
import api from "@/lib/api";
import type {
  ApiResponse,
  SpinResult,
  SpinFilters as SpinFiltersType,
  MealType,
} from "@/types/apiTypes";
import { AppLayout } from "@/components/layout/AppLayout";

const TIPS_STORAGE_KEY = "flax-spin-tips-dismissed";

/*
  Spin tab content.
  Shows the slot machine frame, food result details, Noura suggestion,
  nutrition bars, spin button, and filters section below.

  First click on Spin tab shows the tips popup (unless dismissed permanently).
  "Ok": session dismiss (sessionStorage key). "Do not show again": localStorage.

  Spin mechanic: POST /api/spin, then cycle images for ~3 seconds, then land on result.
  Pre-fetch a few food images to cycle through during spin animation.
*/

const NUTRITION_BARS = [
  { key: "calories_per_100g", label: "Calories per 100g", color: "#2F5D4B" },
  { key: "protein_g", label: "Protein", color: "#F43F5E" },
  { key: "carbs_g", label: "Carbs", color: "#EAB308" },
  { key: "fat_g", label: "Fat", color: "#F59E0B" },
] as const;

export const SpinTab = () => {
  const queryClient = useQueryClient();
  const [showTips, setShowTips] = useState(false);
  const [tipsChecked, setTipsChecked] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(
    null,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  /* Check tips on mount */
  useEffect(() => {
    if (!tipsChecked) {
      setTipsChecked(true);
      const dismissed = localStorage.getItem(TIPS_STORAGE_KEY);
      const sessionDismissed = sessionStorage.getItem(TIPS_STORAGE_KEY);
      if (!dismissed && !sessionDismissed) {
        setShowTips(true);
      }
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

  /* Fetch spin history images to cycle through during animation */
  //   const { data: spinHistory } = useQuery({
  //     queryKey: ["spin-history", "recent"],
  //     queryFn: async () => {
  //       const { data } = await api.get<
  //         ApiResponse<{ history: SpinHistoryEntry[]; days: number }>
  //       >("/api/spin/history?days=2");
  //       return data.data.history;
  //     },
  //     staleTime: 5 * 60 * 1000,
  //   });

  const cycleImages: string[] = [];

  const spinMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (selectedMealType) body.meal_type = selectedMealType;
      if (selectedTags.length) body.tags = selectedTags;
      const { data } = await api.post<ApiResponse<SpinResult>>(
        "/api/spin",
        body,
      );
      return data.data;
    },
    onMutate: () => {
      setIsSpinning(true);
    },
    onSuccess: (data) => {
      /* Let animation run for at least 3s before showing result */
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
      setIsSpinning(false);
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 404) {
        toast.error(
          "No meals found for your filters. Try adjusting your filters.",
        );
      } else {
        toast.error("Could not spin. Try again.");
      }
    },
  });

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
    onSuccess: () => toast.success("Meal flagged. It will not appear again."),
    onError: () => toast.error("Something went wrong, please try again."),
  });

  /* Get max value for nutrition bar scaling */
  const maxNutrition = result
    ? Math.max(
        result.food.calories_per_100g,
        result.food.protein_g,
        result.food.carbs_g,
        result.food.fat_g,
        1,
      )
    : 100;

  return (
    <AppLayout>
      <div className="p-5 overflow-y-auto ">
        {/* Tips popup */}
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

        {/* "Spin" label at top */}
        <p
          className="text-xs lg:text-sm font-semibold uppercase tracking-wide
        text-cocoa/50 dark:text-dark-white/40"
        >
          Spin
        </p>

        {/* Main spin area: frame left + details right */}
        <div className="mt-3 flex flex-col md:flex-row gap-6">
          {/* Left: frame + actions */}
          <div className="flex flex-col items-start gap-4 ">
            <SpinFrame
              isSpinning={isSpinning}
              result={result?.food ?? null}
              cycleImages={cycleImages}
            />

            {/* Action buttons */}
            <div className="flex items-center justify-between w-full max-w-[300px] ">
              <button
                onClick={() => thumbsUp.mutate()}
                disabled={!result || thumbsUp.isPending}
                aria-label="Like this meal"
                className="w-16 h-8 rounded-2xl flex items-center justify-center
                bg-off-white dark:bg-dark-bg
                border border-cocoa/15 dark:border-dark-white/15
                text-cocoa dark:text-dark-white
                hover:bg-suface dark:hover:bg-black-surface
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
                hover:bg-suface dark:hover:bg-black-surface
                disabled:opacity-50 transition-colors"
              >
                <img
                  src="./images/redFlag.svg"
                  alt="fire"
                  className="object-contain w-[15px] flex"
                />
              </button>
              <button
                disabled={!result}
                className="px-2 text-xs lg:text-sm lg:font-medium h-8 rounded-2xl flex items-center justify-center
                bg-off-white dark:bg-dark-bg
                border border-cocoa/15 dark:border-dark-white/15
                text-cocoa dark:text-dark-white
                hover:bg-suface dark:hover:bg-black-surface
                disabled:opacity-50 transition-colors"
              >
                Log meal
              </button>
            </div>
          </div>

          {/* Right: Noura + nutrition bars + spin button */}
          <div className="flex-1 flex flex-col gap-4 min-w-[270px]">
            {/* Noura suggestion box */}
            {isSpinning ? (
              <div className="h-28 rounded-2xl bg-cocoa/10 dark:bg-dark-white/10 animate-pulse" />
            ) : (
              <div
                className="rounded-xl lg:rounded-2xl p-2 lg:p-4
              bg-[rgba(47,93,75,0.14)] dark:bg-[#4d4d4d]"
              >
                <p className="font-heading md:text-xs lg:text-sm font-semibold text-cocoa dark:text-dark-white mb-2">
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
            )}
            {/* Nutrition bars */}
            <div className="space-y-2 lg:space-y-3 mt-1">
              {NUTRITION_BARS.map((bar) => {
                const value = result?.food
                  ? ((result.food as unknown as Record<string, number>)[
                      bar.key
                    ] ?? 0)
                  : 0;
                const pct =
                  maxNutrition > 0
                    ? Math.min(100, (value / maxNutrition) * 100)
                    : 0;

                return (
                  <div key={bar.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: bar.color }}
                        />
                        {/* Label never skeletons, only the bar and value do */}
                        <span className="text-xs lg:text-sm text-cocoa dark:text-dark-white">
                          {bar.label}
                        </span>
                      </div>
                      {/* Value skeletons while spinning */}
                      {isSpinning ? (
                        <span
                          className="inline-block w-8 h-3.5 rounded
                      bg-cocoa/10 dark:bg-dark-white/10 animate-pulse"
                        />
                      ) : (
                        <span className="text-xs lg:text-sm font-medium text-cocoa dark:text-dark-white">
                          {value}g
                        </span>
                      )}
                    </div>

                    {/* Bar skeletons while spinning, animates in on land */}
                    {isSpinning ? (
                      <div
                        className="h-1.5 rounded-full
            bg-cocoa/10 dark:bg-dark-white/10 animate-pulse"
                      />
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
          </div>
        </div>
        {/* Food name + description */}
        {isSpinning ? (
          /* Skeleton during spin */
          <div className="space-y-2 max-w-[800px] mt-5">
            <div className="h-6 w-36 rounded-lg bg-cocoa/10 dark:bg-dark-white/10 animate-pulse" />
            <div className="h-4 w-full rounded-lg bg-cocoa/10 dark:bg-dark-white/10 animate-pulse" />
            <div className="h-4 w-3/4 rounded-lg bg-cocoa/10 dark:bg-dark-white/10 animate-pulse" />
          </div>
        ) : (
          <div className="max-w-[800px] mt-5">
            <h2 className=" w-full font-heading font-bold text-lg lg:text-xl text-cocoa dark:text-dark-white mb-1">
              {result?.food.name ?? "Spin to get a suggestion"}
            </h2>
            <p className="w-full text-sm lg:text-base text-cocoa dark:text-surface/70 leading-relaxed">
              {result?.food.description ?? ""}
            </p>
          </div>
        )}
        {/* Spin button */}
        <div className="max-w-[200px] lg:max-w-[300px]">
          <button
            onClick={() => spinMutation.mutate()}
            disabled={isSpinning}
            className="w-full py-3 lg:py-4 rounded-xl text-sm font-bold
              bg-pawpaw dark:bg-black-pawpaw text-surface
              hover:opacity-90 transition-opacity
              disabled:opacity-60 mt-5"
          >
            {isSpinning ? "Spinning..." : "Spin"}
          </button>
        </div>

        {/* Filters */}
        <SpinFilter
          filters={filters}
          selectedMealType={selectedMealType}
          onMealTypeChange={setSelectedMealType}
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
          userAllergies={[]} /* TRACK: pull from user profile health.allergies */
        />
      </div>
    </AppLayout>
  );
};
