import { useRef, useEffect, useState } from "react";
import type { Food } from "@/types/apiTypes";

interface SpinFrameProps {
  isSpinning: boolean;
  result: Food | null;
  cycleImages: string[];
}

/*
  Slot machine frame.
  Fixed square frame with moringa-faded border.
  During spin: images cycle rapidly, blurring at high speed, sharpening as they slow.
  On land: scale-up + glow pulse animation fires.
  Default (never spun): shows "Spin to get a suggestion" placeholder text.

  cycleImages: array of image URLs to cycle through during spin.
  These are pre-loaded food images from the backend.
  result: the final landed food. Its image is shown after spin completes.

  Sound: spinStart.mp3 plays on spin start, loops during cycling.
         spinLand.mp3 plays on landing.
  Place sounds at: public/sounds/spinStart.mp3 and public/sounds/spinLand.mp3.
  Duration: cycling ~3 seconds total, decelerating over the last ~1 second.
*/

const FRAME_SIZE = 300;
const SPIN_DURATION_MS = 3000;
const CYCLE_START_INTERVAL = 80;
const CYCLE_END_INTERVAL = 500;

export const SpinFrame = ({
  isSpinning,
  result,
  cycleImages,
}: SpinFrameProps) => {
  const [displayImage, setDisplayImage] = useState<string | null>(
    "./images/randomImage.png",
  );
  const [blur, setBlur] = useState(0);
  const [landed, setLanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRef = useRef(0);
  const spinSoundRef = useRef<HTMLAudioElement | null>(null);
  const landSoundRef = useRef<HTMLAudioElement | null>(null);

  //Added this ref to track previous spinning state
  const wasSpinningRef = useRef(isSpinning);

  // Create audio objects for the spin and landing sounds.
  useEffect(() => {
    spinSoundRef.current = new Audio("/sounds/spinning.mp3");
    landSoundRef.current = new Audio("/sounds/matchFound.mp3");
    spinSoundRef.current.loop = true;
  }, []);

  /* Preload sounds. */
  useEffect(() => {
    if (isSpinning && cycleImages.length > 0) {
      setLanded(false);
      frameRef.current = 0;

      spinSoundRef.current?.play().catch(() => {
        // Autoplay may be blocked by the browser.
      });

      const startTime = Date.now();
      let currentInterval = CYCLE_START_INTERVAL;

      const cycle = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / SPIN_DURATION_MS, 1);

        // Gradually increase the interval to simulate deceleration.
        currentInterval =
          CYCLE_START_INTERVAL +
          (CYCLE_END_INTERVAL - CYCLE_START_INTERVAL) * progress;

        // Blur is strongest at the start and fades as the spin slows.
        const blurPx = Math.round((1 - progress) * 6);
        setBlur(blurPx);

        frameRef.current = (frameRef.current + 1) % cycleImages.length;
        setDisplayImage(cycleImages[frameRef.current]);

        if (progress < 1) {
          intervalRef.current = setTimeout(cycle, currentInterval);
        }
      };

      intervalRef.current = setTimeout(cycle, currentInterval);
    }

    // Determine whether the spin has just ended. This is true when the previous
    // state was spinning and the current state is not.
    const justEnded = wasSpinningRef.current === true && isSpinning === false;

    if (!isSpinning) {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      setBlur(0);

      // Only play the landing sound and trigger the landing animation if the
      // spin has genuinely finished and a result is available.
      if (result && justEnded) {
        setDisplayImage(result.image_url);
        setLanded(true);
        spinSoundRef.current?.pause();
        if (spinSoundRef.current) spinSoundRef.current.currentTime = 0;
        landSoundRef.current?.play().catch(() => {});

        // Clear the landing animation state after it completes.
        setTimeout(() => setLanded(false), 800);
      }
    }

    // Update the ref to the current spinning state for the next render.
    wasSpinningRef.current = isSpinning;

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [isSpinning, result, cycleImages]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden w-full max-w-[300px] aspect-square shrink-0"
      style={{
        border: "3px solid #7FB096",
        transition: landed
          ? "transform 0.3s ease, box-shadow 0.3s ease"
          : undefined,
        transform: landed ? "scale(1.03)" : "scale(1)",
        boxShadow: landed
          ? "0 0 32px rgba(127,176,150,0.6)"
          : "0 0 0 rgba(0,0,0,0)",
      }}
    >
      {displayImage ? (
        <img
          src={displayImage}
          alt="Food suggestion"
          className="w-full h-full object-cover"
          style={{
            filter: blur > 0 ? `blur(${blur}px)` : "none",
            transition: "filter 0.1s linear",
          }}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center
          bg-moringa/10 dark:bg-moringa-faded/10"
        >
          <p className="text-sm text-cocoa-faded text-center px-6">
            Spin to get a suggestion
          </p>
        </div>
      )}
    </div>
  );
};
