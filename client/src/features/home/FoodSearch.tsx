import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import api from "@/lib/api";
import type { ApiResponse, Food, FoodSearchData } from "@/types/apiTypes";

interface FoodSearchProps {
  onSelectFood: (food: Food) => void;
}

/*
  Catalogue food search bar (desktop header).
  Debounced 350ms. Shows dropdown with results.
  Each result: food name + calories per 100g + "Log" button.
  Clicking anywhere on the result row also selects it.
  "click to log" note shown as tiny text below each result.
  On selection: calls onSelectFood, parent switches to log meal tab
  and pre-fills the form.
*/
export const FoodSearch = ({ onSelectFood }: FoodSearchProps) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 350);

  const { data: results, isFetching } = useQuery({
    queryKey: ["food-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const { data } = await api.get<ApiResponse<FoodSearchData>>(
        `/api/foods/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`,
      );
      return data.data.results;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30 * 1000,
  });

  const handleSelect = useCallback(
    (food: Food) => {
      onSelectFood(food);
      setQuery("");
      setOpen(false);
    },
    [onSelectFood],
  );

  return (
    <div className="relative md:w-64 lg:w-[324px]">
      <div
        className="flex items-center gap-2 bg-surface-two dark:bg-black-surface
        border border-cocoa/15 dark:border-dark-white/10
        rounded-full px-4 py-2 lg:py-2.5 shadow-sm "
      >
        <Search size={14} className="text-cocoa-faded shrink-0 " />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search catalogue"
          className="flex-1 bg-transparent outline-none text-base lg:text-sm 
            text-cocoa dark:text-dark-white
            placeholder:text-cocoa-faded"
        />
      </div>

      {/* Results dropdown */}
      {open && debouncedQuery.length >= 2 && (
        <div
          className="absolute top-full mt-2 left-0 right-0 z-50
          bg-surface-two dark:bg-black-surface rounded-2xl shadow-xl
          border border-cocoa/10 dark:border-dark-white/10 overflow-hidden"
        >
          {isFetching && (
            <div className="px-4 py-3 text-sm text-cocoa-faded">
              Searching...
            </div>
          )}

          {!isFetching && (!results || results.length === 0) && (
            <div className="px-4 py-3 text-sm text-cocoa-faded">
              No results found
            </div>
          )}

          {results?.map((food) => (
            <div
              key={food._id}
              onClick={() => handleSelect(food)}
              className="flex items-center justify-between px-4 py-3 cursor-pointer
                hover:bg-cocoa/5 dark:hover:bg-dark-white/5 transition-colors
                border-b border-cocoa/5 dark:border-dark-white/5 last:border-b-0"
            >
              <div>
                <p className="font-heading text-sm font-medium text-cocoa dark:text-dark-white">
                  {food.name}
                </p>
                <p className="text-[10px] text-cocoa-faded">
                  {food.calories_per_100g} kcal/100g · click to log
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
