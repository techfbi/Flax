import { create } from "zustand";
import type { MealType } from "@/types/apiTypes";

// PrefillMeal carries just enough data to preselect a catalogue food
// in the log meal form. It intentionally does not carry nutrition
// values because the backend always recalculates those from food_ref.
export interface PrefillMeal {
  food_ref: string;
  food_name: string;
  meal_type?: MealType;
}

interface SpinStore {
  prefillMeal: PrefillMeal | null;
  setPrefillMeal: (meal: PrefillMeal) => void;
  clearPrefillMeal: () => void;
}

// Holds cross page state for the spin feature. Right now this is only used to carry a food from the Spin page or spin history into the
// Log meal form on the homepage, but it is the natural home for any future spin related state that needs to survive a navigation.
export const useSpinStore = create<SpinStore>((set) => ({
  prefillMeal: null,
  setPrefillMeal: (meal) => set({ prefillMeal: meal }),
  clearPrefillMeal: () => set({ prefillMeal: null }),
}));