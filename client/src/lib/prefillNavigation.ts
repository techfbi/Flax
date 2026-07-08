import type { NavigateFunction } from "react-router-dom";
import { useSpinStore, type PrefillMeal } from "@/store/spinStore";

// Sends a food from the Spin page or spin history straight into the Log meal tab on the homepage. Stores the food in spinStore so
// LogMealTab can read it after the navigation, and forces the
// homepage tab bar to open on Log intake so the user lands right on the form instead of the Goal tab.
export const goToLogMeal = (
  navigate: NavigateFunction,
  meal: PrefillMeal,
) => {
  useSpinStore.getState().setPrefillMeal(meal);
  try {
    sessionStorage.setItem("homepage-active-tab", JSON.stringify("logintake"));
  } catch {
    // sessionStorage unavailable, homepage will just open on its default tab
  }
  navigate("/");
};