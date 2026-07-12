import { create } from "zustand";
import type { MealType, SpinResult } from "@/types/apiTypes";

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

  // Last spin landing, held here so it survives navigating away from
  // the spin tab and back, same reasoning as prefillMeal above. No
  // persist middleware, a real refresh should clear it, spinning is
  // meant to be a fresh action each visit, not restored from storage.
  result: SpinResult | null;
  setResult: (result: SpinResult | null) => void;
}

// Holds cross page state for the spin feature. Used to carry a food
// from the Spin page or spin history into the Log meal form on the
// homepage, and to keep the last spin result on screen across
// navigation, the natural home for any future spin related state
// that needs to survive a navigation.
export const useSpinStore = create<SpinStore>((set) => ({
  prefillMeal: null,
  setPrefillMeal: (meal) => set({ prefillMeal: meal }),
  clearPrefillMeal: () => set({ prefillMeal: null }),

  result: null,
  setResult: (result) => set({ result }),
}));