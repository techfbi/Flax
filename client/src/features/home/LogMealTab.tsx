import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
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
  Top: search food catalogue with results.
  Below: list of today's logged meals.
  Each meal: food name, meal type, quantity, calories, edit/delete.
  Add meal: search result click pre-fills the form.
  Custom meal: option to add without catalogue.
*/

const MEAL_TYPES: MealType[] = [
  "breakfast",
  "brunch",
  "lunch",
  "dinner",
  "snack",
];

export const LogMealTab = () => {
  const queryClient = useQueryClient();
  const [searchQ, setSearchQ] = useState("");
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [form, setForm] = useState({
    quantity: 100,
    mealType: "breakfast" as MealType,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const debouncedQ = useDebounce(searchQ, 350);

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

  const logMeal = useMutation({
    mutationFn: async () => {
      if (!selectedFood) return;
      const { data } = await api.post<ApiResponse<{ log: MealLogEntry }>>(
        "/api/meal-logs",
        {
          food_ref: selectedFood._id,
          food_name: selectedFood.name,
          quantity_grams: form.quantity,
          meal_type: form.mealType,
        },
      );
      return data.data.log;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelectedFood(null);
      setSearchQ("");
      toast.success("Meal logged");
    },
    onError: () => toast.error("Could not log meal. Try again."),
  });

  const updateMeal = useMutation({
    mutationFn: async ({
      id,
      quantity,
      mealType,
    }: {
      id: string;
      quantity: number;
      mealType: MealType;
    }) => {
      await api.patch(`/api/meal-logs/${id}`, {
        quantity_grams: quantity,
        meal_type: mealType,
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

  return (
    <div className="p-5">
      <h2 className="font-heading font-bold text-lg text-cocoa dark:text-dark-white mb-4">
        Log meal
      </h2>

      {/* Search */}
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

        {/* Results */}
        {debouncedQ.length >= 2 && (
          <div
            className="absolute top-full mt-1 left-0 right-0 z-20
            bg-surface dark:bg-black-surface rounded-xl shadow-lg
            border border-cocoa/10 dark:border-dark-white/10 overflow-hidden"
          >
            {searching && (
              <p className="px-4 py-3 text-sm text-cocoa-faded">Searching...</p>
            )}
            {!searching && (!searchResults || searchResults.length === 0) && (
              <p className="px-4 py-3 text-sm text-cocoa-faded">No results</p>
            )}
            {searchResults?.map((food) => (
              <div
                key={food._id}
                onClick={() => {
                  setSelectedFood(food);
                  setSearchQ("");
                }}
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
                    setSelectedFood(food);
                    setSearchQ("");
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

      {/* Selected food form */}
      {selectedFood && (
        <div
          className="mb-6 p-4 rounded-2xl bg-cocoa/5 dark:bg-dark-white/5
          border border-cocoa/10 dark:border-dark-white/10"
        >
          <p className="text-sm font-semibold text-cocoa dark:text-dark-white mb-3">
            {selectedFood.name}
          </p>
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="text-xs text-cocoa-faded block mb-1">
                Quantity (g)
              </label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    quantity: parseInt(e.target.value) || 0,
                  }))
                }
                min={10}
                max={3000}
                className="w-full bg-surface dark:bg-black-surface
                  border border-cocoa/20 dark:border-dark-white/20
                  rounded-lg px-3 py-2 text-base lg:text-sm outline-none
                  text-cocoa dark:text-dark-white
                  focus:border-pawpaw dark:focus:border-black-pawpaw"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-cocoa-faded block mb-1">
                Meal type
              </label>
              <select
                value={form.mealType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mealType: e.target.value as MealType,
                  }))
                }
                className="w-full bg-surface dark:bg-black-surface
                  border border-cocoa/20 dark:border-dark-white/20
                  rounded-lg px-3 py-2 text-sm outline-none
                  text-cocoa dark:text-dark-white capitalize
                  focus:border-pawpaw dark:focus:border-black-pawpaw"
              >
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => logMeal.mutate()}
              disabled={logMeal.isPending}
              className="flex-1 py-2.5 rounded-xl bg-moringa dark:bg-moringa-faded
                text-surface text-sm font-semibold
                hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {logMeal.isPending ? "Logging..." : "Save meal"}
            </button>
            <button
              onClick={() => setSelectedFood(null)}
              className="px-4 py-2.5 rounded-xl border border-cocoa/20
                dark:border-dark-white/20 text-sm text-cocoa dark:text-dark-white
                hover:bg-cocoa/5 dark:hover:bg-dark-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Logged meals list */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl
              bg-cocoa/10 dark:bg-dark-white/10 animate-pulse"
            />
          ))}
        </div>
      )}

      {!isLoading && (!logs || logs.length === 0) && !selectedFood && (
        <p className="text-sm text-cocoa-faded text-center py-8">
          No meals logged today. Search above to log your first meal.
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
              /* Inline edit */
              <div className="flex-1 flex gap-2 items-center">
                <input
                  type="number"
                  defaultValue={log.quantity_grams}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      quantity: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-20 bg-surface dark:bg-black-surface
                    border border-cocoa/20 rounded-lg px-2 py-1 text-base lg:text-xs outline-none
                    text-cocoa dark:text-dark-white"
                />
                <span className="text-xs text-cocoa-faded">g</span>
                <select
                  defaultValue={log.meal_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      mealType: e.target.value as MealType,
                    }))
                  }
                  className="bg-surface dark:bg-black-surface
                    border border-cocoa/20 rounded-lg px-2 py-1 text-xs outline-none
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
                      quantity: form.quantity,
                      mealType: form.mealType,
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
                      setForm({
                        quantity: log.quantity_grams,
                        mealType: log.meal_type,
                      });
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
