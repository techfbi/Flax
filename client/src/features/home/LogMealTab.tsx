import { useState, useEffect, useRef, forwardRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import { useSpinStore } from "@/store/spinStore";
import api from "@/lib/api";
import type {
  ApiResponse,
  MealLogEntry,
  Food,
  MealType,
  FoodSearchData,
} from "@/types/apiTypes";

/*
  Log meal tab.
  Two modes: catalogue (search and pick a food) and custom (type your own
  meal name with optional per 100g nutrition values). Both modes share the
  same quantity and meal type controls and post to the same endpoint,
  the backend decides which path to take based on which fields are present.

  Catalogue selection can arrive three ways: search result click, a spin
  result "Log meal" button, or a spin history "Log" button. The last two
  arrive through spinStore rather than local state, since they happen on
  a different page.
*/

const MEAL_TYPES: MealType[] = [
  "breakfast",
  "brunch",
  "lunch",
  "dinner",
  "snack",
];

// A lightweight stand in for a catalogue food. Search results give us
// the full Food object, but a spin prefill only ever gives us a ref and
// a name, so the form only ever needs these two fields to submit.
interface CatalogueSelection {
  food_ref: string;
  food_name: string;
  calories_per_100g?: number;
}

// Picks a sensible default meal type from the current hour so the form
// is never opened on the wrong meal without the user asking for it.
const defaultMealTypeForNow = (): MealType => {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "brunch";
  if (hour < 21) return "dinner";
  return "snack";
};

// Keeps the quantity field digits only and strips leading zeros as the
// user types, so "0" followed by "6" becomes "6" instead of "06", and
// the field never gets stuck showing a stray leading zero.
const sanitizeQuantity = (raw: string): string => {
  const digitsOnly = raw.replace(/[^0-9]/g, "");
  if (digitsOnly === "") return "";
  return digitsOnly.replace(/^0+(?=\d)/, "");
};

const QuantityInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (val: string) => void;
    className: string;
  }
>(({ value, onChange, className }, ref) => (
  <input
    ref={ref}
    type="text"
    inputMode="numeric"
    value={value}
    onChange={(e) => onChange(sanitizeQuantity(e.target.value))}
    onFocus={(e) => e.target.select()}
    placeholder="100"
    className={className}
  />
));
QuantityInput.displayName = "QuantityInput";

export const LogMealTab = () => {
  const queryClient = useQueryClient();
  const { prefillMeal, clearPrefillMeal } = useSpinStore();

  const [mode, setMode] = useState<"catalogue" | "custom">("catalogue");
  const [searchQ, setSearchQ] = useState("");
  const [selectedFood, setSelectedFood] = useState<CatalogueSelection | null>(
    null,
  );
  const [customName, setCustomName] = useState("");
  const [customNutrition, setCustomNutrition] = useState({
    calories_per_100g: "",
    protein_g: "",
    carbs_g: "",
    fat_g: "",
  });
  const [quantityInput, setQuantityInput] = useState("100");
  const [mealType, setMealType] = useState<MealType>(defaultMealTypeForNow());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("100");
  const [editMealType, setEditMealType] = useState<MealType>("breakfast");

  const debouncedQ = useDebounce(searchQ, 350);
  const quantityRef = useRef<HTMLInputElement>(null);

  // Consumes a prefill coming from the Spin page or spin history.
  // Runs once per prefill, then clears the store so navigating back to
  // this tab later does not resubmit stale data.
  useEffect(() => {
    if (!prefillMeal) return;
    setMode("catalogue");
    setSelectedFood({
      food_ref: prefillMeal.food_ref,
      food_name: prefillMeal.food_name,
    });
    if (prefillMeal.meal_type) setMealType(prefillMeal.meal_type);
    setQuantityInput("100");
    clearPrefillMeal();
    // Autofocus the quantity field so the user can type straight away,
    // this is the whole point of the prefill flow.
    requestAnimationFrame(() => {
      quantityRef.current?.focus();
      quantityRef.current?.select();
    });
  }, [prefillMeal, clearPrefillMeal]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["meal-logs", "today"],
    queryFn: async () => {
      const { data } =
        await api.get<ApiResponse<{ logs: MealLogEntry[]; date: string }>>(
          "/api/meal-logs",
        );
      return data.data.logs;
    },
    staleTime: 30 * 1000,
  });

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["food-search", debouncedQ],
    queryFn: async () => {
      if (!debouncedQ.trim()) return [];
      const { data } = await api.get<ApiResponse<FoodSearchData>>(
        `/api/foods/search?q=${encodeURIComponent(debouncedQ)}&limit=8`,
      );
      return data.data.results;
    },
    enabled: debouncedQ.length >= 2,
    staleTime: 30 * 1000,
  });

  const selectCatalogueFood = (food: Food) => {
    setSelectedFood({
      food_ref: food._id,
      food_name: food.name,
      calories_per_100g: food.calories_per_100g,
    });
    setSearchQ("");
    requestAnimationFrame(() => {
      quantityRef.current?.focus();
      quantityRef.current?.select();
    });
  };

  const resetForm = () => {
    setSelectedFood(null);
    setCustomName("");
    setCustomNutrition({
      calories_per_100g: "",
      protein_g: "",
      carbs_g: "",
      fat_g: "",
    });
    setQuantityInput("100");
    setMealType(defaultMealTypeForNow());
  };

  const logMeal = useMutation({
    mutationFn: async () => {
      const quantity = parseInt(quantityInput, 10) || 0;

      if (mode === "catalogue") {
        if (!selectedFood) return;
        const { data } = await api.post<ApiResponse<{ log: MealLogEntry }>>(
          "/api/meal-logs",
          {
            food_ref: selectedFood.food_ref,
            food_name: selectedFood.food_name,
            quantity_grams: quantity,
            meal_type: mealType,
          },
        );
        return data.data.log;
      }

      // Custom meal path. Nutrition fields are optional, empty strings
      // are left out of the body entirely rather than sent as 0, so the
      // backend's own defaulting applies consistently.
      const body: Record<string, unknown> = {
        custom_name: customName.trim(),
        quantity_grams: quantity,
        meal_type: mealType,
      };
      if (customNutrition.calories_per_100g)
        body.calories_per_100g = Number(customNutrition.calories_per_100g);
      if (customNutrition.protein_g)
        body.protein_g = Number(customNutrition.protein_g);
      if (customNutrition.carbs_g)
        body.carbs_g = Number(customNutrition.carbs_g);
      if (customNutrition.fat_g) body.fat_g = Number(customNutrition.fat_g);

      const { data } = await api.post<ApiResponse<{ log: MealLogEntry }>>(
        "/api/meal-logs",
        body,
      );
      return data.data.log;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      resetForm();
      toast.success("Meal logged");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not log meal. Try again.";
      toast.error(message);
    },
  });

  const updateMeal = useMutation({
    mutationFn: async ({
      id,
      quantity,
      type,
    }: {
      id: string;
      quantity: number;
      type: MealType;
    }) => {
      await api.patch(`/api/meal-logs/${id}`, {
        quantity_grams: quantity,
        meal_type: type,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditingId(null);
      toast.success("Meal updated");
    },
    onError: () => toast.error("Could not update meal. Try again."),
  });

  const deleteMeal = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/meal-logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Meal removed");
    },
    onError: () => toast.error("Could not remove meal. Try again."),
  });

  const canSubmit =
    mode === "catalogue"
      ? !!selectedFood && (parseInt(quantityInput, 10) || 0) >= 10
      : customName.trim().length > 0 &&
        (parseInt(quantityInput, 10) || 0) >= 10;

  const inputClass =
    "w-full bg-surface dark:bg-black-surface border border-cocoa/20 " +
    "dark:border-dark-white/20 rounded-lg px-3 py-2 text-base lg:text-sm " +
    "outline-none text-cocoa dark:text-dark-white " +
    "focus:border-pawpaw dark:focus:border-black-pawpaw";

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-bold text-base text-cocoa dark:text-dark-white">
          Log meal
        </h2>

        {/* Catalogue vs custom toggle */}
        <div className="flex bg-cocoa/5 dark:bg-dark-white/5 rounded-full p-1">
          {(["catalogue", "custom"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors
                ${
                  mode === m
                    ? "bg-moringa dark:bg-moringa-faded text-surface"
                    : "text-cocoa/60 dark:text-dark-white/60"
                }`}
            >
              {m === "catalogue" ? "From catalogue" : "Custom meal"}
            </button>
          ))}
        </div>
      </div>

      {mode === "catalogue" ? (
        <div className="relative mb-4">
          <div
            className="flex items-center gap-2 border border-cocoa/20
            dark:border-dark-white/20 rounded-xl px-4 py-2.5"
          >
            <Search size={15} className="text-cocoa-faded shrink-0" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search food catalogue..."
              className="flex-1 bg-transparent outline-none text-base lg:text-sm
                text-cocoa dark:text-dark-white placeholder:text-cocoa-faded"
            />
          </div>

          {debouncedQ.length >= 2 && (
            <div
              className="absolute top-full mt-1 left-0 right-0 z-20
              bg-surface dark:bg-black-surface rounded-xl shadow-lg
              border border-cocoa/10 dark:border-dark-white/10 overflow-hidden"
            >
              {searching && (
                <p className="px-4 py-3 text-sm text-cocoa-faded">
                  Searching...
                </p>
              )}
              {!searching && (!searchResults || searchResults.length === 0) && (
                <p className="px-4 py-3 text-sm text-cocoa-faded">No results</p>
              )}
              {searchResults?.map((food) => (
                <div
                  key={food._id}
                  onClick={() => selectCatalogueFood(food)}
                  className="flex items-center justify-between px-4 py-3
                    cursor-pointer hover:bg-cocoa/5 dark:hover:bg-dark-white/5
                    border-b border-cocoa/5 dark:border-dark-white/5 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-cocoa dark:text-dark-white">
                      {food.name}
                    </p>
                    <p className="text-[10px] text-cocoa-faded">
                      {food.calories_per_100g} kcal/100g · click to log
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectCatalogueFood(food);
                    }}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-full
                      bg-moringa dark:bg-moringa-faded text-surface
                      hover:opacity-90 shrink-0 ml-3"
                  >
                    Log
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4">
          <label className="text-xs text-cocoa-faded block mb-1">
            Meal name
          </label>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="e.g. Mum's jollof rice"
            maxLength={100}
            className={inputClass}
          />
        </div>
      )}

      {/* Shared form: only shows once a catalogue food is picked, or
      always in custom mode since the name field above is the trigger */}
      {(selectedFood || mode === "custom") && (
        <div
          className="mb-6 p-4 rounded-2xl bg-cocoa/5 dark:bg-dark-white/5
          border border-cocoa/10 dark:border-dark-white/10"
        >
          {selectedFood && (
            <p className="text-sm font-semibold text-cocoa dark:text-dark-white mb-3">
              {selectedFood.food_name}
            </p>
          )}

          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="text-xs text-cocoa-faded block mb-1">
                Quantity (g)
              </label>
              <QuantityInput
                ref={quantityRef}
                value={quantityInput}
                onChange={setQuantityInput}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-cocoa-faded block mb-1">
                Meal type
              </label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className={`${inputClass} capitalize`}
              >
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional nutrition, custom mode only */}
          {mode === "custom" && (
            <div className="mb-3">
              <p className="text-xs text-cocoa-faded mb-2">
                Nutrition per 100g, optional. Leave blank if unknown.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["calories_per_100g", "Calories"],
                    ["protein_g", "Protein g"],
                    ["carbs_g", "Carbs g"],
                    ["fat_g", "Fat g"],
                  ] as const
                ).map(([key, label]) => (
                  <input
                    key={key}
                    type="text"
                    inputMode="decimal"
                    value={customNutrition[key]}
                    onChange={(e) =>
                      setCustomNutrition((prev) => ({
                        ...prev,
                        [key]: e.target.value.replace(/[^0-9.]/g, ""),
                      }))
                    }
                    placeholder={label}
                    className={inputClass}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => logMeal.mutate()}
              disabled={!canSubmit || logMeal.isPending}
              className="flex-1 py-2.5 rounded-xl bg-moringa dark:bg-moringa-faded
                text-surface text-sm font-semibold
                hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {logMeal.isPending ? "Logging..." : "Save meal"}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2.5 rounded-xl border border-cocoa/20
                dark:border-dark-white/20 text-sm text-cocoa dark:text-dark-white
                hover:bg-cocoa/5 dark:hover:bg-dark-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-cocoa/10 dark:bg-dark-white/10 animate-pulse"
            />
          ))}
        </div>
      )}

      {!isLoading && (!logs || logs.length === 0) && !selectedFood && (
        <p className="text-sm text-cocoa-faded text-center py-8">
          No meals logged today. Search above or add a custom meal.
        </p>
      )}

      <div className="space-y-2">
        {logs?.map((log) => (
          <div
            key={log.id}
            className="flex items-center justify-between px-4 py-3
              rounded-xl bg-cocoa/5 dark:bg-dark-white/5
              border border-cocoa/5 dark:border-dark-white/5"
          >
            {editingId === log.id ? (
              <div className="flex-1 flex gap-2 items-center">
                <QuantityInput
                  value={editQuantity}
                  onChange={setEditQuantity}
                  className="w-20 bg-surface dark:bg-black-surface border
                    border-cocoa/20 rounded-lg px-2 py-1 text-base lg:text-xs
                    outline-none text-cocoa dark:text-dark-white"
                />
                <span className="text-xs text-cocoa-faded">g</span>
                <select
                  value={editMealType}
                  onChange={(e) => setEditMealType(e.target.value as MealType)}
                  className="bg-surface dark:bg-black-surface border
                    border-cocoa/20 rounded-lg px-2 py-1 text-xs outline-none
                    text-cocoa dark:text-dark-white"
                >
                  {MEAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    updateMeal.mutate({
                      id: log.id,
                      quantity: parseInt(editQuantity, 10) || 0,
                      type: editMealType,
                    })
                  }
                  disabled={updateMeal.isPending}
                  className="text-xs font-semibold text-moringa dark:text-moringa-faded
                    hover:opacity-70"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-xs text-cocoa-faded hover:text-cocoa"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium text-cocoa dark:text-dark-white">
                    {log.food_name ?? log.custom_name}
                  </p>
                  <p className="text-[11px] text-cocoa-faded capitalize">
                    {log.meal_type} · {log.quantity_grams}g ·{" "}
                    {Math.round(log.calories)} kcal
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingId(log.id);
                      setEditQuantity(String(log.quantity_grams));
                      setEditMealType(log.meal_type);
                    }}
                    aria-label="Edit meal"
                    className="text-cocoa/30 dark:text-dark-white/30
                      hover:text-cocoa dark:hover:text-dark-white transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteMeal.mutate(log.id)}
                    disabled={deleteMeal.isPending}
                    aria-label="Delete meal"
                    className="text-cocoa/30 dark:text-dark-white/30
                      hover:text-rose-500 transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
