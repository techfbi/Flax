import { type ReactNode, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { ConveyorTicker } from "@/components/ui/ConveyorTicker";

/**
 * AuthLayout — the two-panel card used on Register, Login, and OTP screens.
 *
 * Left panel: rotating background images with crossfade (CSS opacity transition).
 *   - Images are preloaded before animation starts to prevent swap flicker.
 *   - Color overlay on top: off-white (#F6F1E7) at ~0.45 opacity (light) /
 *     black-surface (#221E18) at ~0.55 opacity (dark).
 *   - Bold heading text in moringa-deep (light) / dark-white (dark).
 *   - Conveyor belt text items — deferred to animation phase but
 *     structure is in place now with static items visible.
 *
 * Right panel: white form card (dark: black-box).
 *
 * Mobile: left panel collapses to a compact header block at the top,
 *   image hidden, form shown below in a rounded card on the gradient bg.
 *
 * IMAGE SETUP:
 *   Place 2-3 auth background images at:
 *     public/images/auth/auth1.webp
 *     public/images/auth/auth2.webp
 *     public/images/auth/auth3.webp
 *   Recommended resize: 800×1100px (portrait). Crop to face/subject centered.
 *   WebP format for performance. Original JPEGs are fine as fallback.
 *   Update the AUTH_IMAGES array below to add/remove images.
 */

const AUTH_IMAGES = [
  "/images/auth/auth1.webp",
  "/images/auth/auth2.webp",
  "/images/auth/auth3.webp",
  "/images/auth/auth4.webp",
  "/images/auth/auth5.webp",
];

interface AuthLayoutProps {
  /** Bold heading on the left panel, e.g. "Let's get the journey started!" */
  panelHeading: ReactNode;
  /** Conveyor belt items (the small rotating texts below the heading) */
  panelItems: string[];
  /** The form content rendered in the right panel */
  children: ReactNode;
}

export const SecondAuthLayout = ({
  panelHeading,
  panelItems,
  children,
}: AuthLayoutProps) => {
  const imgRefs = useRef<HTMLImageElement[]>([]);
  const activeIndex = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // Preload all images before starting the rotation
    let loaded = 0;
    const imgs = AUTH_IMAGES.map((src) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        loaded++;
        // Once all are loaded, start the crossfade cycle
        if (loaded === AUTH_IMAGES.length) startCycle();
      };
      return img;
    });

    const startCycle = () => {
      intervalRef.current = setInterval(() => {
        const current = imgRefs.current[activeIndex.current];
        const next =
          imgRefs.current[(activeIndex.current + 1) % AUTH_IMAGES.length];

        if (current) current.style.opacity = "0";
        if (next) next.style.opacity = "1";

        activeIndex.current = (activeIndex.current + 1) % AUTH_IMAGES.length;
      }, 5000); // swap every 5 seconds
    };

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      imgs.forEach((img) => {
        img.onload = null;
      });
    };
  }, []);

  return (
    // Page background: brand gradient
    <div className="min-h-screen bg-brand-gradient dark:bg-brand-gradient-dark flex items-center justify-center p-4 md:p-8">
      {/* ── Outer card ────────────────────────────────────────── */}
      <div className="w-full max-w-[900px] flex flex-col md:flex-row rounded-2xl overflow-hidden shadow-2xl">
        {/* ── LEFT PANEL ────────────────────────────────────────
            Desktop: 45% width, full image with overlay + text
            Mobile: compact header block, no image
        ──────────────────────────────────────────────────────── */}
        <div className="relative md:w-[45%] bg-surface dark:bg-black-box md:bg-off-white md:dark:bg-black-surface overflow-hidden">
          {/* Rotating background images — stacked, only first visible */}
          {AUTH_IMAGES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden="true"
              ref={(el) => {
                if (el) imgRefs.current[i] = el;
              }}
              className="absolute inset-0 w-full h-full object-cover object-center
                         transition-opacity duration-700 ease-in-out hidden md:block"
              style={{ opacity: i === 0 ? 1 : 0 }}
              draggable={false}
            />
          ))}

          {/* Color overlay — dims image so text is readable
              Light: off-white at 0.45 / Dark: black-surface at 0.55 */}
          <div
            className="absolute inset-0 hidden md:block"
            style={{
              backgroundColor:
                resolvedTheme === "dark"
                  ? "rgba(34,30,24,0.87)"
                  : "rgba(246,241,231,0.84)",
            }}
          />

          {/* Panel content — visible on all sizes */}
          <div className="relative z-10 flex flex-col h-full min-h-[50px] md:min-h-[580px] px-8 md:p-8">
            {/* Logo */}
            <Link
              to="/"
              className="inline-flex items-center gap-2 order-last md:order-first md:mt-0 mb-0 md:mb-auto"
              aria-label="Back to Flax home"
            >
              <img
                src={
                  resolvedTheme === "dark"
                    ? "/images/logoDark.png"
                    : "/images/logoLight.png"
                }
                alt="Flax"
                width={72}
                height={35}
                className="h-[35px] w-auto object-contain"
              />
            </Link>

            {/* Heading — Montserrat bold */}
            <h1
              className="font-heading text-2xl pb-[2px] md:pb-0 md:text-[2.8rem] font-bold leading-tight mt-10 md:mt-auto
                           text-moringa dark:text-dark-white
                           md:text-moringa md:dark:text-dark-white"
            >
              {panelHeading}
            </h1>

            {/* Conveyor belt items — static for now, animation in phase 2
                Structure: a clipping container with items stacked.
                On animation phase, these will translate-Y one at a time. */}
            <div className="mt-4 hidden md:block">
              <ConveyorTicker items={panelItems} />
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────
            White card (light) / black-box (dark)
            Full height flex column so form sits centered
        ──────────────────────────────────────────────────────── */}
        <div className="flex-1 bg-surface dark:bg-black-box flex flex-col justify-center px-8 py-10 md:px-10">
          {children}
        </div>
      </div>
    </div>
  );
};
