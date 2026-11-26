import { useEffect, useState } from "react";
import { FlaxLoader } from "./FlaxLoader";
import { LOADER_LOOP_MS, SIGN_IN_LOADER_LOOPS, useSignInLoader } from "@/store/signInLoaderStore";

/*
  Covers the screen with the logo animation after a sign in, see
  signInLoaderStore. Mounted once above the routes so it stays put while
  the app navigates to home underneath it.

  The animation starts when this mounts, so the timer and the loops line
  up: it fades out right as the last loop ends on its empty frame. Under
  reduced motion the logo does not animate, so it only shows briefly.
*/
const FADE_MS = 400;
const REDUCED_MS = 900;

const Overlay = ({ onDone }: { onDone: () => void }) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduced ? REDUCED_MS : LOADER_LOOP_MS * SIGN_IN_LOADER_LOOPS;
    const fade = window.setTimeout(() => setLeaving(true), hold);
    const done = window.setTimeout(onDone, hold + FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      role="status"
      aria-label="Signing you in"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-off-white dark:bg-dark-bg"
      style={{ opacity: leaving ? 0 : 1, transition: `opacity ${FADE_MS}ms ease-out` }}
    >
      <FlaxLoader className="w-16 text-cocoa dark:text-white" />
    </div>
  );
};

export const SignInLoader = () => {
  const { visible, runId, stop } = useSignInLoader();
  if (!visible) return null;
  return <Overlay key={runId} onDone={stop} />;
};
