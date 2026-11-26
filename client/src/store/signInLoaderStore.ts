import { create } from "zustand";

/*
  The full screen logo animation shown right after someone signs in
  (email and password, or Google). It plays exactly SIGN_IN_LOADER_LOOPS
  loops while the app moves to home behind it, then fades away. Opening
  the app with a saved session is not a sign in and never shows it.
*/
export const LOADER_LOOP_MS = 4600; // one loop of the logo animation, see FlaxLoader.css
export const SIGN_IN_LOADER_LOOPS = 2;

interface SignInLoaderState {
  visible: boolean;
  /** Changes on every start, so a new sign in restarts the animation. */
  runId: number;
  start: () => void;
  stop: () => void;
}

export const useSignInLoader = create<SignInLoaderState>((set) => ({
  visible: false,
  runId: 0,
  start: () => set((s) => ({ visible: true, runId: s.runId + 1 })),
  stop: () => set({ visible: false }),
}));
