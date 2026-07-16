import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
} from "react";
import type { SpinResult } from "@/types/apiTypes";
import { toThumbnail } from "@/lib/images";

interface SpinFrameProps {
  isSpinning: boolean;
  result: SpinResult | null;
  landingImage: string | null;
  cycleImages: string[];
  soundEnabled: boolean;
  onLandingComplete: () => void;
}

export interface SpinFrameHandle {
  primeAudio: () => void;
}

const TICK_MS = 130;
const MIN_PHASE_ONE_MS = 900;
const FINAL_TRANSITION_MS = 1800;
const BLUR_CLEAR_MS = 1300;

export const SpinFrame = forwardRef<SpinFrameHandle, SpinFrameProps>(
  (
    {
      isSpinning,
      result,
      landingImage,
      cycleImages,
      soundEnabled,
      onLandingComplete,
    },
    ref,
  ) => {
    const [reel, setReel] = useState<string[]>(["/images/randomImage.png"]);
    const [targetIndex, setTargetIndex] = useState(0);
    const [transitionMs, setTransitionMs] = useState(0);
    const [blurred, setBlurred] = useState(false);
    const [landed, setLanded] = useState(false);

    const reelRef = useRef<HTMLDivElement | null>(null);
    const spinSoundRef = useRef<HTMLAudioElement | null>(null);
    const landSoundRef = useRef<HTMLAudioElement | null>(null);
    const tickIntervalRef = useRef<number | null>(null);
    const phaseOneStartRef = useRef(0);
    const committedRef = useRef(false);
    const wasSpinningRef = useRef(isSpinning);

    useEffect(() => {
      spinSoundRef.current = new Audio("/sounds/spinning.mp3");
      landSoundRef.current = new Audio("/sounds/matchFound.mp3");
      spinSoundRef.current.loop = true;
      spinSoundRef.current.muted = !soundEnabled;
      landSoundRef.current.muted = !soundEnabled;
      spinSoundRef.current.preload = "auto";
      landSoundRef.current.preload = "auto";
      spinSoundRef.current.load();
      landSoundRef.current.load();
    }, []);

    useEffect(() => {
      if (spinSoundRef.current) spinSoundRef.current.muted = !soundEnabled;
      if (landSoundRef.current) landSoundRef.current.muted = !soundEnabled;
    }, [soundEnabled]);

    useImperativeHandle(ref, () => ({
      primeAudio: () => {
        // Play then pause immediately, synchronously, without waiting for
        // the promise to resolve. Waiting for it and pausing inside .then
        // is what broke this, that resolution can land after the real
        // spin sound has already started playing on this same element,
        // silently pausing it mid playback a moment in. Pausing right
        // away here means there is nothing left pending that could ever
        // interfere with a real play call later.
        [spinSoundRef.current, landSoundRef.current].forEach((audio) => {
          if (!audio) return;
          const playPromise = audio.play();
          audio.pause();
          audio.currentTime = 0;
          playPromise?.catch(() => {});
        });
      },
    }));

    const clearTick = () => {
      if (tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };

    // Phase one, starts the instant a spin begins.
    useEffect(() => {
      if (
        isSpinning &&
        tickIntervalRef.current === null &&
        cycleImages.length > 0 &&
        !committedRef.current
      ) {
        phaseOneStartRef.current = Date.now();
        setBlurred(true);
        setReel([cycleImages[0]]);
        setTargetIndex(0);
        setTransitionMs(0);

        spinSoundRef.current!.currentTime = 0;
        spinSoundRef.current?.play().catch(() => {});

        let i = 0;
        tickIntervalRef.current = window.setInterval(() => {
          i++;
          setReel((prev) => [...prev, cycleImages[i % cycleImages.length]]);
          setTargetIndex(i);
          setTransitionMs(TICK_MS);
        }, TICK_MS);
      }

      if (!isSpinning) clearTick();
    }, [isSpinning, cycleImages]);

    // Preload the real landing image the instant it is known.
    useEffect(() => {
      if (!landingImage) return;
      const preload = new Image();
      preload.src = toThumbnail(landingImage, 300);
    }, [landingImage]);

    // Phase two, commit to the real answer.
    useEffect(() => {
      if (
        isSpinning &&
        landingImage &&
        !committedRef.current &&
        tickIntervalRef.current !== null
      ) {
        const elapsed = Date.now() - phaseOneStartRef.current;
        const wait = Math.max(0, MIN_PHASE_ONE_MS - elapsed);

        const timeoutId = window.setTimeout(() => {
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

        return () => window.clearTimeout(timeoutId);
      }
    }, [isSpinning, landingImage, cycleImages]);

    // The real landing moment, driven by the CSS transition actually
    // finishing, not a guessed timer. This is what removes the stall
    // and double landing, the parent only reveals the result once this
    // fires, it can never cut the animation off early again.
    useEffect(() => {
      const el = reelRef.current;
      if (!el) return;

      const handleTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName !== "transform" || !committedRef.current) return;

        setLanded(true);
        spinSoundRef.current?.pause();
        if (spinSoundRef.current) spinSoundRef.current.currentTime = 0;
        landSoundRef.current?.play().catch(() => {});
        onLandingComplete();
        setTimeout(() => setLanded(false), 800);
      };

      el.addEventListener("transitionend", handleTransitionEnd);
      return () => el.removeEventListener("transitionend", handleTransitionEnd);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Resets once the parent confirms the spin is fully over.
    useEffect(() => {
      if (wasSpinningRef.current === true && isSpinning === false) {
        committedRef.current = false;
        clearTick();
        setBlurred(false);
        setTransitionMs(0);
        setTargetIndex(0);
        setReel([result?.food.image_url ?? "/images/randomImage.png"]);
        // Always stop the spin sound here, not only in the landing
        // handler. If the spin errored or timed out before ever
        // committing to a real landing, transitionend never fires, and
        // this sound had nothing else that would ever pause it.
        spinSoundRef.current?.pause();
        if (spinSoundRef.current) spinSoundRef.current.currentTime = 0;
      }
      wasSpinningRef.current = isSpinning;
    }, [isSpinning, result]);

    // Preload cycle images the moment they are available, not only when
    // a spin starts. This gives the browser the entire time between page
    // load and the first tap to fetch and cache them, so the very first
    // spin does not show blank frames while they are still downloading.
    useEffect(() => {
      cycleImages.forEach((src) => {
        const preload = new Image();
        preload.src = toThumbnail(src, 300);
      });
    }, [cycleImages]);

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
          ref={reelRef}
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
  },
);

SpinFrame.displayName = "SpinFrame";
