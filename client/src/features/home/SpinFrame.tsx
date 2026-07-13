import { useRef, useEffect, useState } from "react";
import type { SpinResult } from "@/types/apiTypes";
import { toThumbnail } from "@/lib/images";

interface SpinFrameProps {
  isSpinning: boolean;
  result: SpinResult | null;
  landingImage: string | null;
  cycleImages: string[];
  soundEnabled: boolean;
}

/*
  Slot machine frame, two phases.

  Phase one starts the instant isSpinning goes true, sound included,
  a fast constant tick through cycleImages, since the real answer is
  not known yet, this is intentionally indeterminate.

  Phase two begins once landingImage actually arrives from the API,
  and only after a minimum phase one duration has passed so it never
  looks like it barely started. It appends the true landing image to
  the end of the same growing strip and plays one long, decelerating
  transition from wherever phase one left off straight onto it. No
  restart, no swap, the strip is one continuous motion the whole time.
*/

const TICK_MS = 130; // phase one, speed per frame
const MIN_PHASE_ONE_MS = 900; // never commit to landing before this
const FINAL_TRANSITION_MS = 1800; // phase two, the decelerating glide
const BLUR_CLEAR_MS = 1300; // sharpens before phase two fully stops

export const SpinFrame = ({
  isSpinning,
  result,
  landingImage,
  cycleImages,
  soundEnabled,
}: SpinFrameProps) => {
  const [reel, setReel] = useState<string[]>(["/images/randomImage.png"]);
  const [targetIndex, setTargetIndex] = useState(0);
  const [transitionMs, setTransitionMs] = useState(0);
  const [blurred, setBlurred] = useState(false);
  const [landed, setLanded] = useState(false);

  const spinSoundRef = useRef<HTMLAudioElement | null>(null);
  const landSoundRef = useRef<HTMLAudioElement | null>(null);
  const wasSpinningRef = useRef(isSpinning);
  const tickIntervalRef = useRef<number | null>(null);
  const phaseOneStartRef = useRef(0);
  const committedRef = useRef(false);

  useEffect(() => {
    spinSoundRef.current = new Audio("/sounds/spinning.mp3");
    landSoundRef.current = new Audio("/sounds/matchFound.mp3");
    spinSoundRef.current.loop = true;
    spinSoundRef.current.muted = !soundEnabled;
    landSoundRef.current.muted = !soundEnabled;
  }, []);

  useEffect(() => {
    if (spinSoundRef.current) spinSoundRef.current.muted = !soundEnabled;
    if (landSoundRef.current) landSoundRef.current.muted = !soundEnabled;
  }, [soundEnabled]);

  const clearTick = () => {
    if (tickIntervalRef.current !== null) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  };

  // Phase one, starts the instant a spin begins, does not wait on
  // anything from the network.
  useEffect(() => {
    if (
      isSpinning &&
      tickIntervalRef.current === null &&
      cycleImages.length > 0
    ) {
      committedRef.current = false;
      phaseOneStartRef.current = Date.now();
      setBlurred(true);
      cycleImages.forEach((src) => {
        const preload = new Image();
        preload.src = toThumbnail(src, 300);
      });
      setReel([cycleImages[0]]);
      setTargetIndex(0);
      setTransitionMs(0);

      spinSoundRef.current!.currentTime = 0;
      spinSoundRef.current?.play().catch(() => {
        // Autoplay may still be blocked in rare cases, nothing to do.
      });

      let i = 0;
      tickIntervalRef.current = window.setInterval(() => {
        i++;
        setReel((prev) => [...prev, cycleImages[i % cycleImages.length]]);
        setTargetIndex(i);
        setTransitionMs(TICK_MS);
      }, TICK_MS);
    }

    if (!isSpinning) {
      clearTick();
    }

    return () => {
      if (!isSpinning) clearTick();
    };
  }, [isSpinning, cycleImages]);

  // Phase two, commits to the real landing image once it is known and
  // enough time has passed for phase one to have felt real.
  useEffect(() => {
    if (
      isSpinning &&
      landingImage &&
      !committedRef.current &&
      tickIntervalRef.current !== null
    ) {
      const elapsed = Date.now() - phaseOneStartRef.current;
      const wait = Math.max(0, MIN_PHASE_ONE_MS - elapsed);

      window.setTimeout(() => {
        if (!isSpinning) return;
        committedRef.current = true;
        clearTick();

        setReel((prev) => {
          const finalReel = [...prev, ...cycleImages, landingImage];
          setTargetIndex(finalReel.length - 1);
          return finalReel;
        });
        setTransitionMs(FINAL_TRANSITION_MS);
        setTimeout(() => setBlurred(false), BLUR_CLEAR_MS);
      }, wait);
    }
  }, [isSpinning, landingImage, cycleImages]);

  // Start downloading the real landing image the instant we know what
  // it is, well before phase two ever needs to show it. By the time
  // the transition actually reaches that frame, it is already sitting
  // in the browser's cache instead of racing the animation.
  useEffect(() => {
    if (!landingImage) return;
    const preload = new Image();
    preload.src = toThumbnail(landingImage, 300);
  }, [landingImage]);

  // Landing.
  useEffect(() => {
    const justEnded = wasSpinningRef.current === true && isSpinning === false;

    if (justEnded && result) {
      setLanded(true);
      spinSoundRef.current?.pause();
      if (spinSoundRef.current) spinSoundRef.current.currentTime = 0;
      landSoundRef.current?.play().catch(() => {});
      setTimeout(() => setLanded(false), 800);
    }

    if (!isSpinning) {
      clearTick();
      setBlurred(false);
      setTransitionMs(0);
      setTargetIndex(0);
      setReel([result?.food.image_url ?? "/images/randomImage.png"]);
    }

    wasSpinningRef.current = isSpinning;
  }, [isSpinning, result]);

  const frameCount = reel.length;
  const restingTranslate = `-${(targetIndex / frameCount) * 100}%`;

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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: `${frameCount * 100}%`,
          transform: `translateY(${restingTranslate})`,
          transition:
            transitionMs > 0
              ? `transform ${transitionMs}ms ${
                  transitionMs === FINAL_TRANSITION_MS
                    ? "cubic-bezier(0.12, 0.83, 0.34, 1)"
                    : "linear"
                }`
              : "none",
          filter: blurred ? "blur(8px)" : "blur(0px)",
          willChange: "transform, filter",
        }}
      >
        {reel.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={toThumbnail(src, 300)}
            alt=""
            className="w-full object-cover"
            style={{ height: `${100 / frameCount}%`, flexShrink: 0 }}
          />
        ))}
      </div>
    </div>
  );
};
