import { useQuery } from "@tanstack/react-query";
import { X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
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

const MEAL_TYPES: MealType[] = [
  "breakfast",
  "brunch",
  "lunch",
  "dinner",
  "snack",
];

const STORAGE_KEY = "spin_tags_data";
const EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

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

  // ---- localStorage persistence with auto‑expiry ----
  const timeoutRef = useRef<number | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  // 1. Restore tags from storage on mount (if not expired)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const { tags, timestamp } = JSON.parse(stored);
        const now = Date.now();
        if (now - timestamp < EXPIRY_MS) {
          // Still valid → restore to parent
          if (JSON.stringify(tags) !== JSON.stringify(selectedTags)) {
            onTagsChange(tags);
          }
        } else {
          // Expired → clean up
          localStorage.removeItem(STORAGE_KEY);
          if (selectedTags.length > 0) {
            onTagsChange([]);
          }
        }
      } catch (_) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } else {
      // No stored tags → ensure parent is empty (optional)
      if (selectedTags.length > 0) {
        onTagsChange([]);
      }
    }
    setIsRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Update storage and reset expiry timer whenever tags change
  useEffect(() => {
    if (!isRestored) return; // prevent overriding on initial restore

    // Clear existing timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (selectedTags.length === 0) {
      // No tags → remove storage and do not schedule expiry
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Save tags with current timestamp
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tags: selectedTags,
        timestamp: Date.now(),
      }),
    );

    // Schedule auto‑clear after EXPIRY_MS
    timeoutRef.current = window.setTimeout(() => {
      localStorage.removeItem(STORAGE_KEY);
      // Clear tags from parent state (so UI updates immediately)
      onTagsChange([]);
      toast.info(
        "Your selected tags have expired. Please re‑select if needed.",
      );
    }, EXPIRY_MS);

    // Cleanup on unmount or when tags change again
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [selectedTags, isRestored, onTagsChange]);

  // 3. When the component unmounts, clear the pending timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);
  // ---------------------------------------------------------

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
    <div className="rounded-lg p-5 bg-surface-two dark:bg-dark-bg mt-5 md:mt-7 lg:mt-10">
      <h3 className="font-heading font-semibold text-sm lg:text-base text-cocoa/70 dark:text-dark-sec mb-5">
        Filters
      </h3>

      {/* Desktop: two column layout */}
      <div className="flex flex-col gap-5">
        {/* Left column */}
        <div className="flex-1">
          {/* Meal types */}
          <div className="mb-4">
            <p className="text-sm lg:text-base font-semibold text-cocoa dark:text-dark-white mb-2.5">
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
                    px-2 md:px-4 py-1.5 rounded-full text-xs md:text-sm capitalize
                    transition-colors duration-150
                    ${
                      selectedMealType === type
                        ? "bg-moringa dark:bg-moringa-faded border-moringa dark:border-moringa-faded text-surface"
                        : "bg-off-white  dark:bg-dark-white/10 text-cocoa dark:text-dark-white"
                    }
                  `}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-cocoa/10 dark:bg-dark-white/10 mb-4" />

          {/* Allergies, read only */}
          <div>
            <p className="text-xs lg:text-sm italic text-cocoa-faded mb-1.5">
              Your allergies will not be included in your spin results
            </p>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm lg:text-base font-semibold text-cocoa dark:text-dark-white">
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
                <p className="text-xs lg:text-sm text-cocoa-faded">
                  No allergies set
                </p>
              ) : (
                userAllergies.map((allergy) => (
                  <span
                    key={allergy}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-xs
                      bg-cocoa/8 dark:bg-dark-white/8 mb-2
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

        {/* Right column */}
        <div className="flex-1">
          {/* Pantry items */}
          <div className="mb-4">
            <p className="text-sm lg:text-base font-semibold text-cocoa dark:text-dark-white mb-2.5">
              Pantry items
            </p>
            <div className="flex flex-wrap gap-2">
              {!pantry || pantry.length === 0 ? (
                <p className="text-xs lg:text-sm text-cocoa-faded mb-3">
                  Your pantry items will appear here
                </p>
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
            <p className="text-xs lg:text-sm text-cocoa-faded mb-1.5">
              You can add maximum of 3 tags
            </p>
            <div className="flex items-center gap-2 mb-2.5">
              <p className="text-sm lg:text-base font-semibold text-cocoa dark:text-dark-white">
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
                  className="flex items-center gap-1.5 rounded-full text-xs
                    text-cocoa dark:text-dark-white
                    border border-cocoa/15 dark:border-dark-white/15 px-4 py-1.5
                    bg-surface-two  dark:bg-dark-white/10"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                    className="text-cocoa/40 dark:text-dark-white/40
                      hover:text-cocoa dark:hover:text-dark-white"
                  >
                    <X size={15} />
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
