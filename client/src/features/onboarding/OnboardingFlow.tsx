import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type {
  HealthGoal,
  DietaryStyle,
  ActivityLevel,
  BiologicalSex,
  AgeRange,
} from "@/types/apiTypes";

/**
 * OnboardingFlow — 4-step health profile setup shown after first registration.
 * Uses the same two-panel layout as auth screens but:
 *   - Left panel heading: "Getting started" on two lines
 *   - Left panel has same conveyor items (static for now, animated in phase 2)
 *   - Progress bar lives at the top of the RIGHT panel
 *   - Back arrow from step 2 onward
 *   - Step 1 only has "Skip for now"
 *   - Final step button says "Done"
 *
 * Mobile: no left panel. White card on gradient bg.
 *   "Getting started..." heading + progress bar at top of card, then form.
 *
 * On Done: PATCH /api/users/health → navigate to /dashboard.
 * On Skip (step 1): navigate to /dashboard directly.
 */

/* ── Types ───────────────────────────────────────────────────── */
interface OnboardingData {
  healthGoal: HealthGoal | null;
  dietaryStyle: DietaryStyle | null;
  activityLevel: ActivityLevel | null;
  biologicalSex: BiologicalSex | null;
  ageRange: AgeRange | null;
  region: string;
  heightCm: number;
  weightKg: number;
}

const TOTAL_STEPS = 4;

/* ── Progress bar ────────────────────────────────────────────── */
const ProgressBar = ({ step }: { step: number }) => (
  <div className="flex gap-1.5 mb-3">
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
      <div
        key={i}
        className="h-1.5 flex-1 rounded-full transition-colors duration-300"
        style={{
          backgroundColor: i < step ? "#E8623C" : "rgba(156,163,175,0.35)",
        }}
      />
    ))}
  </div>
);

/* ── Custom checkbox row ─────────────────────────────────────── */
const CheckRow = ({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className="flex items-center gap-3 w-full py-3 text-left group"
  >
    {/* Square checkbox — pawpaw filled when checked */}
    <span
      className={`
        w-5 h-5 rounded-sm border-2 flex items-center justify-center shrink-0
        transition-colors duration-150
        ${
          checked
            ? "bg-pawpaw border-pawpaw dark:bg-black-pawpaw dark:border-black-pawpaw"
            : "border-cocoa/30 dark:border-dark-white/30 bg-transparent"
        }
      `}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path
            d="M1 4L3.5 6.5L9 1"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
    <span className="text-sm text-cocoa dark:text-dark-white">{label}</span>
  </button>
);

/* ── Stepper input (height / weight) ─────────────────────────── */
const StepperInput = ({
  label,
  unit,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) => (
  <div className="flex-1">
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-sm font-medium text-cocoa dark:text-dark-white">
        {label}
      </span>
      {/* Unit badge — small grey pill */}
      <span
        className="text-[10px] px-1.5 py-0.5 rounded bg-cocoa/10 dark:bg-dark-white/10
        text-cocoa-faded font-medium"
      >
        {unit}
      </span>
    </div>
    <div
      className="flex items-center border border-cocoa/20 dark:border-dark-white/20
      rounded-lg overflow-hidden bg-[#F2F2F2] dark:bg-[#1E1E1E]"
    >
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="
          flex-1 px-3 py-3 text-sm font-semibold
          text-cocoa dark:text-dark-white
          bg-transparent outline-none
          [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
        "
      />
      {/* Up/down stepper arrows */}
      <div className="flex flex-col border-l border-cocoa/10 dark:border-dark-white/10">
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="px-2 py-1.5 text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white
            transition-colors"
          aria-label={`Increase ${label}`}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path
              d="M1 5L5 1L9 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="px-2 py-1.5 text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white
            transition-colors border-t border-cocoa/10 dark:border-dark-white/10"
          aria-label={`Decrease ${label}`}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
);

/* ── Select dropdown (age range + region) ────────────────────── */
const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <div>
    <label className="block text-sm font-medium text-cocoa dark:text-dark-white mb-1.5">
      {label}
    </label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full px-4 py-3 rounded-lg
          border border-cocoa/20 dark:border-dark-white/20
          bg-[#F2F2F2] dark:bg-[#1E1E1E]
          text-sm text-cocoa dark:text-dark-white
          appearance-none outline-none
          focus:border-pawpaw focus:ring-1 focus:ring-pawpaw
          dark:focus:border-black-pawpaw dark:focus:ring-black-pawpaw
          transition-colors
        "
      >
        <option value="" disabled>
          {label}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {/* Chevron */}
      <span
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none
        text-cocoa-faded"
      >
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path
            d="M1 1L6 7L11 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  </div>
);

/* ── Main component ──────────────────────────────────────────── */
const OnboardingFlow = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { user, setAuth } = useAuthStore();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  // All step data accumulated here — sent together on Done
  const [data, setData] = useState<OnboardingData>({
    healthGoal: null,
    dietaryStyle: null,
    activityLevel: null,
    biologicalSex: null,
    ageRange: null,
    region: "",
    heightCm: 170,
    weightKg: 70,
  });

  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeIndex = useRef(0);

  // Same image list as AuthLayout
  const AUTH_IMAGES = [
    "/images/auth/auth1.webp",
    "/images/auth/auth2.webp",
    "/images/auth/auth3.webp",
  ];

  // Preload and start crossfade — same mechanic as AuthLayout
  useEffect(() => {
    let loaded = 0;
    const imgs = AUTH_IMAGES.map((src) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        loaded++;
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
      }, 4000);
    };

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      imgs.forEach((img) => {
        img.onload = null;
      });
    };
    // AUTH_IMAGES is stable — defined inside component but never changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const goNext = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));

  /* Skip for now — goes straight to dashboard without saving */
  const handleSkip = () => navigate("/dashboard", { replace: true });

  /* Final submit — PATCH /api/users/health */
  const handleDone = async () => {
    setApiError("");
    setSubmitting(true);
    try {
      await api.patch("/api/users/health", {
        health_goal: data.healthGoal,
        dietary_style: data.dietaryStyle,
        activity_level: data.activityLevel,
        biological_sex: data.biologicalSex,
        age_range: data.ageRange,
        region: data.region || undefined,
        height_cm: data.heightCm,
        weight_kg: data.weightKg,
      });
      // Mark onboarding complete in store
      if (user) {
        setAuth({ ...user, hasCompletedOnboarding: true }, "");
      }
      navigate("/dashboard", { replace: true });
    } catch {
      setApiError("Something went wrong, please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Conveyor items (static, animated in phase 2) ── */
  const panelItems = [
    "This will take just a minute...",
    "Start your journey with Flax",
    "Tell us a little about yourself",
    "Get recommendations tailored to you",
    "Set goals that fit your lifestyle",
    "Track your progress over time",
  ];

  /* ── Step content ─────────────────────────────────── */
  const GOAL_OPTIONS: { label: string; value: HealthGoal }[] = [
    { label: "Lose weight", value: "weight_loss" },
    { label: "Gain muscle", value: "muscle_gain" },
    { label: "Gain weight", value: "weight_gain" },
    { label: "Stay the same", value: "maintenance" },
    { label: "Eat better generally", value: "general_health" },
  ];

  const DIET_OPTIONS: { label: string; value: DietaryStyle | null }[] = [
    { label: "No", value: null },
    { label: "omnivore 🥩", value: "omnivore" },
    { label: "vegetarian 🥦", value: "vegetarian" },
    { label: "vegan 🌿", value: "vegan" },
    { label: "pescatarian 🐟 (Fish-based diet)", value: "pescatarian" },
    { label: "keto 🥑", value: "keto" },
    { label: "paleo 🍖", value: "paleo" },
    { label: "halal ☪️", value: "halal" },
    { label: "kosher ✡️", value: "kosher" },
  ];

  const ACTIVITY_OPTIONS: {
    label: string;
    description: string;
    value: ActivityLevel;
  }[] = [
    {
      label: "Sedentary",
      description: "Sit a lot, move a little",
      value: "sedentary",
    },
    {
      label: "Lightly active",
      description: "Desk job, but I walk",
      value: "lightly_active",
    },
    {
      label: "Moderately active",
      description: "I exercise + stay busy",
      value: "moderately_active",
    },
    {
      label: "Very active",
      description: "Physical job and I train hard",
      value: "very_active",
    },
    {
      label: "Extremely active",
      description: "Move all day, train 2x/day",
      value: "extremely_active",
    },
  ];

  const AGE_OPTIONS = [
    { value: "18-24", label: "18 - 24" },
    { value: "25-34", label: "25 - 34" },
    { value: "35-44", label: "35 - 44" },
    { value: "45-54", label: "45 - 54" },
    { value: "55-64", label: "55 - 64" },
    { value: "65+", label: "65+" },
  ];

  // Region list — commonly used, expandable
  const REGION_OPTIONS = [
    { value: "nigeria", label: "Nigeria" },
    { value: "ghana", label: "Ghana" },
    { value: "kenya", label: "Kenya" },
    { value: "south_africa", label: "South Africa" },
    { value: "uk", label: "United Kingdom" },
    { value: "usa", label: "United States" },
    { value: "canada", label: "Canada" },
    { value: "india", label: "India" },
    { value: "other", label: "Other" },
  ];

  /* Right panel content per step */
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <p className="text-xs text-cocoa-faded mb-2">
              A few details to personalize your suggestions
            </p>
            <h2 className="font-heading text-xl font-bold text-cocoa dark:text-dark-white mb-6">
              Whats your{" "}
              <span className="text-pawpaw dark:text-black-pawpaw">goal?</span>
            </h2>
            <div className="flex flex-col divide-y divide-cocoa/5 dark:divide-dark-white/5 mb-8">
              {GOAL_OPTIONS.map((opt) => (
                <CheckRow
                  key={opt.value}
                  label={opt.label}
                  checked={data.healthGoal === opt.value}
                  onSelect={() => update({ healthGoal: opt.value })}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={goNext}
              className="
                w-full flex items-center justify-center gap-3
                py-4 rounded-xl
                bg-moringa dark:bg-moringa-faded
                text-surface font-semibold text-sm
                hover:opacity-90 transition-opacity mb-3
              "
            >
              Continue <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="w-full text-sm text-cocoa dark:text-dark-white
                text-center py-2 hover:opacity-60 transition-opacity"
            >
              Skip for now
            </button>
          </>
        );

      case 2:
        return (
          <>
            <p className="text-xs text-cocoa-faded mb-2">
              A few details to personalize your suggestions
            </p>
            <h2 className="font-heading text-xl font-bold text-cocoa dark:text-dark-white mb-6">
              Are you currently following a{" "}
              <span className="text-pawpaw dark:text-black-pawpaw">
                pattern?
              </span>
            </h2>
            <div className="flex flex-col divide-y divide-cocoa/5 dark:divide-dark-white/5 mb-8">
              {DIET_OPTIONS.map((opt) => (
                <CheckRow
                  key={String(opt.value)}
                  label={opt.label}
                  checked={data.dietaryStyle === opt.value}
                  onSelect={() => update({ dietaryStyle: opt.value })}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={goNext}
              className="
                w-full flex items-center justify-center gap-3
                py-4 rounded-xl
                bg-moringa dark:bg-moringa-faded
                text-surface font-semibold text-sm
                hover:opacity-90 transition-opacity
              "
            >
              Continue <ArrowRight size={16} />
            </button>
          </>
        );

      case 3:
        return (
          <>
            <p className="text-xs text-cocoa-faded mb-2">
              A few details to personalize your suggestions
            </p>
            <h2 className="font-heading text-xl font-bold text-cocoa dark:text-dark-white mb-6">
              Activity status
            </h2>
            <div className="flex flex-col divide-y divide-cocoa/5 dark:divide-dark-white/5 mb-8">
              {ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update({ activityLevel: opt.value })}
                  className="flex items-center gap-3 w-full py-3 text-left"
                >
                  {/* Square checkbox */}
                  <span
                    className={`
                    w-5 h-5 rounded-sm border-2 flex items-center justify-center shrink-0
                    transition-colors duration-150
                    ${
                      data.activityLevel === opt.value
                        ? "bg-pawpaw border-pawpaw dark:bg-black-pawpaw dark:border-black-pawpaw"
                        : "border-cocoa/30 dark:border-dark-white/30 bg-transparent"
                    }
                  `}
                  >
                    {data.activityLevel === opt.value && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  {/* Bold label + italic description */}
                  <span className="text-sm text-cocoa dark:text-dark-white">
                    <span className="font-semibold">{opt.label}</span> -{" "}
                    <span className="italic text-cocoa-faded">
                      {opt.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={goNext}
              className="
                w-full flex items-center justify-center gap-3
                py-4 rounded-xl
                bg-moringa dark:bg-moringa-faded
                text-surface font-semibold text-sm
                hover:opacity-90 transition-opacity
              "
            >
              Continue <ArrowRight size={16} />
            </button>
          </>
        );

      case 4:
        return (
          <>
            <p className="text-xs text-cocoa-faded mb-2">
              A few details to personalize your suggestions
            </p>
            <h2 className="font-heading text-xl font-bold text-cocoa dark:text-dark-white mb-1">
              A bit about you
            </h2>

            {/* Top-level error */}
            {apiError && (
              <p
                className="text-sm text-rose-500 dark:text-rose-700 mb-3"
                role="alert"
              >
                {apiError}
              </p>
            )}

            {/* Sex toggle */}
            <div className="flex gap-2 mb-5 mt-3">
              {(["male", "female"] as BiologicalSex[]).map((sex) => (
                <button
                  key={sex}
                  type="button"
                  onClick={() => update({ biologicalSex: sex })}
                  className={`
                    flex-1 py-2.5 rounded-full text-sm font-semibold capitalize
                    border transition-colors duration-150
                    ${
                      data.biologicalSex === sex
                        ? "bg-pawpaw dark:bg-black-pawpaw border-pawpaw dark:border-black-pawpaw text-surface"
                        : "border-cocoa/20 dark:border-dark-white/20 text-cocoa dark:text-dark-white bg-transparent"
                    }
                  `}
                >
                  {sex.charAt(0).toUpperCase() + sex.slice(1)}
                </button>
              ))}
            </div>

            {/* Age range */}
            <div className="mb-4">
              <SelectField
                label="Age range"
                value={data.ageRange ?? ""}
                onChange={(v) => update({ ageRange: v as AgeRange })}
                options={AGE_OPTIONS}
              />
            </div>

            {/* Region */}
            <div className="mb-4">
              <SelectField
                label="Region"
                value={data.region}
                onChange={(v) => update({ region: v })}
                options={REGION_OPTIONS}
              />
            </div>

            {/* Height + Weight side by side */}
            <div className="flex gap-4 mb-5">
              <StepperInput
                label="Height"
                unit="cm"
                value={data.heightCm}
                onChange={(v) => update({ heightCm: v })}
                min={50}
                max={300}
              />
              <StepperInput
                label="Weight"
                unit="kg"
                value={data.weightKg}
                onChange={(v) => update({ weightKg: v })}
                min={10}
                max={500}
              />
            </div>

            {/* Exact age note */}
            <p className="text-xs text-cocoa-faded leading-relaxed mb-6">
              We use this to estimate your daily calorie and water needs. You
              can add your exact age later for a more precise number.
            </p>

            <button
              type="button"
              onClick={handleDone}
              disabled={submitting}
              className="
                w-full flex items-center justify-center gap-3
                py-4 rounded-xl
                bg-moringa dark:bg-moringa-faded
                text-surface font-semibold text-sm
                hover:opacity-90 transition-opacity
                disabled:opacity-50
              "
            >
              {submitting ? "Saving..." : "Done"}
            </button>
          </>
        );
    }
  };

  /* ── Shared inner layout ─────────────────────────────────────
     Desktop: two-panel card (left plain + right form)
     Mobile: single card, heading + progress + form stacked
  ──────────────────────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 md:p-8"
      style={{
        background:
          resolvedTheme === "dark"
            ? "linear-gradient(145deg, #2F5D4B 0%, #2F5D4B 8%, #171410 30%, #171410 100%)"
            : "linear-gradient(145deg, #7FB096 0%, #7FB096 10%, #F6F1E7 35%, #F6F1E7 100%)",
      }}
    >
      <div className="w-full max-w-[900px] flex flex-col md:flex-row rounded-2xl overflow-hidden shadow-2xl">
        {/* ── LEFT PANEL — desktop only ─────────────────────────
    Same mechanic as all auth screens: rotating bg images
    with crossfade, color overlay on top, heading + conveyor
    items aligned to bottom half of the panel.
──────────────────────────────────────────────────────── */}
        <div
          className="hidden md:flex md:w-[45%] flex-col relative overflow-hidden
  bg-off-white dark:bg-black-surface"
        >
          {/* Rotating background images — same AUTH_IMAGES as AuthLayout */}
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
                 transition-opacity duration-700 ease-in-out"
              style={{ opacity: i === 0 ? 1 : 0 }}
              draggable={false}
            />
          ))}

          {/* Color overlay — off-white at 0.45 (light) / black-surface at 0.55 (dark) */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor:
                resolvedTheme === "dark"
                  ? "rgba(34,30,24,0.55)"
                  : "rgba(246,241,231,0.45)",
            }}
          />

          {/* Content sits above the overlay */}
          <div className="relative z-10 flex flex-col h-full p-8">
            {/* Logo top-left */}
            <a href="/" aria-label="Flax home">
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
            </a>

            {/* Heading + conveyor items pushed to bottom half */}
            <div className="flex flex-col justify-end flex-1 pb-4">
              <h1
                className="font-heading text-[2.25rem] font-bold leading-tight
        text-moringa dark:text-dark-white mb-6"
              >
                Getting
                <br />
                started
              </h1>
              <div className="flex flex-col gap-1.5">
                {panelItems.map((item) => (
                  <p
                    key={item}
                    className="text-sm text-cocoa dark:text-dark-white/70 conveyor-item"
                    style={{ opacity: 0.75 }}
                  >
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* ── RIGHT PANEL ──────────────────────────────────────
            White (light) / black-box (dark)
            Mobile: takes full width, shows "Getting started..." heading at top
        ──────────────────────────────────────────────────────── */}
        <div className="flex-1 bg-surface dark:bg-black-box px-7 py-8 md:px-10">
          {/* Mobile-only heading */}
          <div className="md:hidden mb-4">
            <h1 className="font-heading text-2xl font-bold text-cocoa dark:text-dark-white">
              Getting started...
            </h1>
          </div>

          {/* Progress bar — always at top of right panel */}
          <ProgressBar step={step} />

          {/* Back arrow — step 2 onward */}
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              className="flex items-center text-cocoa dark:text-dark-white
                hover:opacity-60 transition-opacity mb-4 mt-1"
              aria-label="Go back"
            >
              ←
            </button>
          )}

          {/* Step content */}
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;
