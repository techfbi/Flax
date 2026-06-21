import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { User } from "../types/apiTypes";

// ---------------------------------------------------------------------------
// Auth slice
// Holds authentication UI state only.
// The access token lives in tokenStore.ts, not here.
// This store holds the decoded user object so components
// can read display_name, role, provider etc without a network call.
// ---------------------------------------------------------------------------
interface AuthState {
  user:      User | null;
  isLoading: boolean; // true while we verify the session on app load
  setUser:   (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth:  () => void;
}

// ---------------------------------------------------------------------------
// Spin slice
// Holds the UI state of the spin reveal mechanic.
// The actual food result is fetched via a mutation, not stored here permanently.
// TanStack Query handles the network call. Zustand holds what the animation needs.
// ---------------------------------------------------------------------------
interface SpinState {
  isSpinning:  boolean;
  result:      import("../types/apiTypes").SpinResult | null;
  showResult:  boolean;
  setSpinning: (v: boolean) => void;
  setResult:   (result: import("../types/apiTypes").SpinResult | null) => void;
  setShowResult: (v: boolean) => void;
  clearSpin:   () => void;
}

// ---------------------------------------------------------------------------
// Onboarding slice
// Tracks which step of the multi-step onboarding the user is on.
// Cleared after onboarding completes.
// ---------------------------------------------------------------------------
interface OnboardingState {
  step:    number;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset:   () => void;
}

// ---------------------------------------------------------------------------
// Combined store
// All slices in one store. Zustand recommends this for small-medium apps.
// Selectors are used in components to prevent unnecessary rerenders.
// ---------------------------------------------------------------------------
interface FlaxStore extends AuthState, SpinState, OnboardingState {}

export const useStore = create<FlaxStore>()(
  devtools(
    (set) => ({
      // Auth slice
      user:      null,
      isLoading: true,
      setUser:   (user) => set({ user }, false, "auth/setUser"),
      setLoading: (isLoading) => set({ isLoading }, false, "auth/setLoading"),
      clearAuth:  () => set({ user: null, isLoading: false }, false, "auth/clear"),

      // Spin slice
      isSpinning:  false,
      result:      null,
      showResult:  false,
      setSpinning: (isSpinning) => set({ isSpinning }, false, "spin/setSpinning"),
      setResult:   (result) => set({ result }, false, "spin/setResult"),
      setShowResult: (showResult) => set({ showResult }, false, "spin/setShowResult"),
      clearSpin:   () => set({ isSpinning: false, result: null, showResult: false }, false, "spin/clear"),

      // Onboarding slice
      step:     1,
      setStep:  (step) => set({ step }, false, "onboarding/setStep"),
      nextStep: () => set((s) => ({ step: s.step + 1 }), false, "onboarding/next"),
      prevStep: () => set((s) => ({ step: Math.max(1, s.step - 1) }), false, "onboarding/prev"),
      reset:    () => set({ step: 1 }, false, "onboarding/reset"),
    }),
    { name: "FlaxStore" }
  )
);

// Typed selectors. components use these instead of selecting the whole store.
// This prevents a component from rerendering when an unrelated slice changes.
export const useUser       = () => useStore((s) => s.user);
export const useIsLoading  = () => useStore((s) => s.isLoading);
export const useSpinState  = () => useStore((s) => ({
  isSpinning: s.isSpinning,
  result:     s.result,
  showResult: s.showResult,
}));
export const useOnboarding = () => useStore((s) => ({
  step:     s.step,
  nextStep: s.nextStep,
  prevStep: s.prevStep,
  reset:    s.reset,
  setStep:  s.setStep,
}));