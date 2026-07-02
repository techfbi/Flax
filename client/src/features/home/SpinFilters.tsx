import { useQuery } from "@tanstack/react-query";
import { X, Pencil } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import type {
  ApiResponse,
  SpinFilters,
  PantryItem,
  MealType,
} from "@/types/apiTypes";

interface SpinFiltersProps {
  filters: SpinFilters | undefined;
  selectedMealType: MealType | null;
  onMealTypeChange: (t: MealType | null) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  userAllergies: string[];
}

const MEAL_TYPES: MealType[] = ["breakfast", "brunch", "lunch", "dinner"];

/*
  Filters section below the spin frame.
  Off-white bg on light, dark-bg on dark.
  Left: meal types (toggles), allergies (read-only display with pencil edit icon).
  Right: pantry items display, tags dropdown (max 3).
  Allergies pencil: navigates to profile health settings to edit.
  Each edit reflects on the next spin.
*/
export const SpinFilter = ({
  filters,
  selectedMealType,
  onMealTypeChange,
  selectedTags,
  onTagsChange,
  userAllergies,
}: SpinFiltersProps) => {
  const { data: pantry } = useQuery({
    queryKey: ["pantry"],
    queryFn: async () => {
      const { data } =
        await api.get<ApiResponse<{ pantry_items: PantryItem[] }>>(
          "/api/pantry",
        );
      return data.data.pantry_items;
    },
    staleTime: 5 * 60 * 1000,
  });

  const availableTags = filters?.tags ?? [];
  const MAX_TAGS = 3;

  const addTag = (tag: string) => {
    if (selectedTags.includes(tag)) return;
    if (selectedTags.length >= MAX_TAGS) {
      toast.error("Maximum 3 tags allowed");
      return;
    }
    onTagsChange([...selectedTags, tag]);
  };

  const removeTag = (tag: string) => {
    onTagsChange(selectedTags.filter((t) => t !== tag));
  };

  return (
    <div className="rounded-2xl p-5 bg-off-white dark:bg-dark-bg mt-4">
      <h3
        className="font-heading font-semibold text-sm text-pawpaw
        dark:text-black-pawpaw mb-4"
      >
        Filters
      </h3>

      {/* Desktop: two column layout */}
      <div className="flex flex-col md:flex-row gap-5">
        {/* Left column */}
        <div className="flex-1">
          {/* Meal types */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-cocoa dark:text-dark-white mb-2.5">
              Meal types
            </p>
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() =>
                    onMealTypeChange(selectedMealType === type ? null : type)
                  }
                  className={`
                    px-4 py-1.5 rounded-full text-sm capitalize
                    border transition-colors duration-150
                    ${
                      selectedMealType === type
                        ? "bg-pawpaw dark:bg-black-pawpaw border-pawpaw dark:border-black-pawpaw text-surface"
                        : "border-cocoa/20 dark:border-dark-white/20 text-cocoa dark:text-dark-white"
                    }
                  `}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-cocoa/10 dark:bg-dark-white/10 mb-4" />

          {/* Allergies — read only */}
          <div>
            <p className="text-xs italic text-cocoa-faded mb-1.5">
              Your allergies will not be included in your spin results
            </p>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-semibold text-cocoa dark:text-dark-white">
                Allergies
              </p>
              <button
                onClick={() => (window.location.href = "/profile")}
                aria-label="Edit allergies in profile"
                className="text-cocoa/40 dark:text-dark-white/40
                  hover:text-cocoa dark:hover:text-dark-white transition-colors"
              >
                <Pencil size={13} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {userAllergies.length === 0 ? (
                <p className="text-xs text-cocoa-faded">No allergies set</p>
              ) : (
                userAllergies.map((allergy) => (
                  <span
                    key={allergy}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-xs
                      bg-cocoa/8 dark:bg-dark-white/8
                      text-cocoa dark:text-dark-white
                      border border-cocoa/15 dark:border-dark-white/15"
                  >
                    {allergy}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Divider — desktop only */}
        <div className="hidden md:block w-px bg-cocoa/10 dark:bg-dark-white/10" />

        {/* Right column */}
        <div className="flex-1">
          {/* Pantry items */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-cocoa dark:text-dark-white mb-2.5">
              Pantry items
            </p>
            <div className="flex flex-wrap gap-2">
              {!pantry || pantry.length === 0 ? (
                <p className="text-xs text-cocoa-faded">No pantry items</p>
              ) : (
                pantry.map((item) => (
                  <span
                    key={item.id}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs
                      bg-cocoa/8 dark:bg-dark-white/8
                      text-cocoa dark:text-dark-white
                      border border-cocoa/15 dark:border-dark-white/15"
                  >
                    {item.name}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="h-px bg-cocoa/10 dark:bg-dark-white/10 mb-4" />

          {/* Tags */}
          <div>
            <p className="text-xs text-cocoa-faded mb-1.5">
              You can add maximum of 3 tags
            </p>
            <div className="flex items-center gap-2 mb-2.5">
              <p className="text-sm font-semibold text-cocoa dark:text-dark-white">
                Tags
              </p>
              <select
                onChange={(e) => {
                  addTag(e.target.value);
                  e.target.value = "";
                }}
                defaultValue=""
                className="flex-1 bg-surface dark:bg-black-surface
                  border border-cocoa/20 dark:border-dark-white/20
                  rounded-lg px-3 py-1.5 text-sm text-cocoa dark:text-dark-white
                  outline-none appearance-none cursor-pointer"
              >
                <option value="" disabled>
                  Select tags
                </option>
                {availableTags
                  .filter((t) => !selectedTags.includes(t))
                  .map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs
                    bg-cocoa/8 dark:bg-dark-white/8
                    text-cocoa dark:text-dark-white
                    border border-cocoa/15 dark:border-dark-white/15"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                    className="text-cocoa/40 dark:text-dark-white/40
                      hover:text-cocoa dark:hover:text-dark-white"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
