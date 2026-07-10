import { useState, useCallback } from "react";

const STORAGE_KEY = "flax-spin-sound-enabled";

// Client only preference. Does not play anything itself, SpinFrame
// owns the actual audio elements and sounds, this hook only tracks
// whether they should be audible, and persists that choice.
export const useSpinSound = () => {
  const [enabled, setEnabledState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // storage unavailable, preference just will not persist
    }
  }, []);

  return { enabled, setEnabled };
};