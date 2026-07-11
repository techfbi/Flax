import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { handleApiError } from "@/utils/handleApiError";
import api from "@/lib/api";
import type {
  HealthGoal,
  DietaryStyle,
  ActivityLevel,
  BiologicalSex,
  AgeRange,
} from "@/types/apiTypes";
import { ConveyorTicker } from "@/components/ui/ConveyorTicker";

/**
 * OnboardingFlow 4-step health profile setup after first registration.
 *
 * Step 1: Health goal, skippable (goal stays null, moves to step 2)
 * Step 2: Dietary pattern, mandatory
 * Step 3: Activity level, mandatory
 * Step 4: Body stats, mandatory, sends PATCH /api/users/health on Done
 *
 * Persistence: current step saved to localStorage so if user closes
 * mid-onboarding and logs back in, they resume from where they left off.
 * Cleared on successful Done.
 *
 * Left panel: same rotating bg image mechanic as all auth screens.
 * Mobile: no left panel, single white card with heading + progress + form.
 */

/* ── Constants ───────────────────────────────────────────────── */
const TOTAL_STEPS = 4;
const STEP_STORAGE_KEY = "flax-onboarding-step";

const AUTH_IMAGES = [
  "/images/auth/auth1.webp",
  "/images/auth/auth2.webp",
  "/images/auth/auth3.webp",
];

const PANEL_ITEMS = [
  "This will take just a minute...",
  "Start your journey with Flax",
  "Tell us a little about yourself",
  "Get recommendations tailored to you",
  "Set goals that fit your lifestyle",
  "Track your progress over time",
];

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

const REGION_OPTIONS = [
  { value: "Nigeria", label: "Nigeria" },
  { value: "Ghana", label: "Ghana" },
  { value: "Kenya", label: "Kenya" },
  { value: "South Africa", label: "South Africa" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "United States", label: "United States" },
  { value: "Canada", label: "Canada" },
  { value: "India", label: "India" },
  { value: "Other", label: "Other" },
];

/* ── Types ───────────────────────────────────────────────────── */
interface OnboardingData {
  healthGoal: HealthGoal | null;
  dietaryStyle: DietaryStyle | null | undefined;
  activityLevel: ActivityLevel | null;
  biologicalSex: BiologicalSex | null;
  ageRange: AgeRange | null;
  region: string;
  heightCm: number;
  weightKg: number;
}

/* ── Sub-components ──────────────────────────────────────────── */

/* Progress bar — 4 segments, pawpaw fills left to right */
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

/* Square checkbox row, single select behaviour */
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
    className="flex items-center gap-3 w-full py-3 text-left"
  >
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

/*
  Conversion helpers.
  All values stored in metric internally and sent to backend in metric.
  Display value converts on the fly based on selected unit.
*/
const ftToCm = (ft: number, inches: number) =>
  Math.round(ft * 30.48 + inches * 2.54);
const cmToFt = (cm: number) => {
  const totalInches = cm / 2.54;
  return {
    ft: Math.floor(totalInches / 12),
    inches: Math.round(totalInches % 12),
  };
};
const lbsToKg = (lbs: number) => Math.round(lbs * 0.453592);
const kgToLbs = (kg: number) => Math.round(kg * 2.20462);

type HeightUnit = "cm" | "ft";
type WeightUnit = "kg" | "lbs";

const HeightInput = ({
  valueCm,
  onChange,
}: {
  valueCm: number;
  onChange: (cm: number) => void;
}) => {
  const [unit, setUnit] = useState<HeightUnit>("cm");
  const [ftVal, setFtVal] = useState(5);
  const [inVal, setInVal] = useState(7);
  const [cmVal, setCmVal] = useState(valueCm === 0 ? "" : String(valueCm));
  const [error, setError] = useState("");

  const handleUnitChange = (u: HeightUnit) => {
    setUnit(u);
    setError("");
    if (u === "ft") {
      const { ft, inches } = cmToFt(valueCm || 0);
      setFtVal(ft);
      setInVal(inches);
    } else {
      setCmVal(valueCm === 0 ? "" : String(valueCm));
    }
  };

  const handleCmChange = (raw: string) => {
    setCmVal(raw);
    setError("");
    if (raw === "" || raw === "-") return;
    const n = parseInt(raw);
    if (isNaN(n)) {
      setError("Enter a valid number");
      return;
    }
    if (n < 50) {
      setError("Height must be at least 50cm");
      return;
    }
    if (n > 300) {
      setError("Height must be under 300cm");
      return;
    }
    onChange(n);
  };

  const handleFtChange = (ft: number, inches: number) => {
    setFtVal(ft);
    setInVal(inches);
    const cm = ftToCm(ft, inches);
    if (cm < 50 || cm > 300) {
      setError("Enter a valid height");
      return;
    }
    setError("");
    onChange(cm);
  };

  const inputClass = `
    flex-1 min-w-0
    px-3 py-3 text-base lg:text-sm font-semibold
    text-cocoa dark:text-dark-white bg-[#F6F6F6] dark:bg-[#121212] outline-none
    [appearance:textfield]
    [&::-webkit-inner-spin-button]:appearance-none
    [&::-webkit-outer-spin-button]:appearance-none
  `;

  const containerClass = `
    flex items-center rounded-lg overflow-hidden
    border border-cocoa/20 dark:border-dark-white/20
    bg-[#F2F2F2] dark:bg-[#1E1E1E]
  `;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm font-medium text-cocoa dark:text-dark-white">
          Height
        </span>
        <select
          value={unit}
          onChange={(e) => handleUnitChange(e.target.value as HeightUnit)}
          className="text-[10px] px-1.5 py-0.5 rounded
            bg-cocoa/10 dark:bg-dark-white/10
            text-cocoa-faded border-none outline-none cursor-pointer"
        >
          <option value="cm">cm</option>
          <option value="ft">ft</option>
        </select>
      </div>

      {unit === "cm" ? (
        <div className={containerClass}>
          <input
            type="number"
            value={cmVal}
            placeholder="170"
            onChange={(e) => handleCmChange(e.target.value)}
            className={inputClass}
          />
          <Stepper
            onUp={() => {
              const n = parseInt(cmVal || "0") + 1;
              if (n <= 300) handleCmChange(String(n));
            }}
            onDown={() => {
              const n = parseInt(cmVal || "0") - 1;
              if (n >= 50) handleCmChange(String(n));
            }}
            label="Height"
          />
        </div>
      ) : (
        <div className="flex gap-1.5">
          <div className={`${containerClass} flex-1`}>
            <input
              type="number"
              value={ftVal}
              onChange={(e) =>
                handleFtChange(parseInt(e.target.value) || 0, inVal)
              }
              className={inputClass}
              placeholder="5"
            />
            <span className="pr-2 text-xs text-cocoa-faded">ft</span>
          </div>
          <div className={`${containerClass} flex-1`}>
            <input
              type="number"
              value={inVal}
              onChange={(e) =>
                handleFtChange(ftVal, parseInt(e.target.value) || 0)
              }
              className={inputClass}
              placeholder="7"
            />
            <span className="pr-2 text-xs text-cocoa-faded">in</span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-500 dark:text-rose-700 mt-1">{error}</p>
      )}
    </div>
  );
};

const WeightInput = ({
  valueKg,
  onChange,
}: {
  valueKg: number;
  onChange: (kg: number) => void;
}) => {
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [inputVal, setInputVal] = useState(
    valueKg === 0 ? "" : String(valueKg),
  );
  const [error, setError] = useState("");

  const handleUnitChange = (u: WeightUnit) => {
    setUnit(u);
    setError("");
    if (u === "lbs") {
      setInputVal(valueKg === 0 ? "" : String(kgToLbs(valueKg)));
    } else {
      setInputVal(valueKg === 0 ? "" : String(valueKg));
    }
  };

  const handleChange = (raw: string) => {
    setInputVal(raw);
    setError("");
    if (raw === "" || raw === "-") return;
    const n = parseInt(raw);
    if (isNaN(n)) {
      setError("Enter a valid number");
      return;
    }

    const kg = unit === "lbs" ? lbsToKg(n) : n;
    if (kg < 10) {
      setError("Weight must be at least 10kg");
      return;
    }
    if (kg > 500) {
      setError("Weight must be under 500kg");
      return;
    }
    onChange(kg);
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm font-medium text-cocoa dark:text-dark-white">
          Weight
        </span>
        <select
          value={unit}
          onChange={(e) => handleUnitChange(e.target.value as WeightUnit)}
          className="text-[10px] px-1.5 py-0.5 rounded
            bg-cocoa/10 dark:bg-dark-white/10
            text-cocoa-faded border-none outline-none cursor-pointer"
        >
          <option value="kg">kg</option>
          <option value="lbs">lbs</option>
        </select>
      </div>

      <div
        className="flex items-center rounded-lg overflow-hidden
        border border-cocoa/20 dark:border-dark-white/20
        bg-[#F2F2F2] dark:bg-[#1E1E1E]"
      >
        <input
          type="number"
          value={inputVal}
          placeholder={unit === "kg" ? "70" : "154"}
          onChange={(e) => handleChange(e.target.value)}
          className="
            flex-1 min-w-0
            px-3 py-3 text-base lg:text-sm font-semibold
            text-cocoa dark:text-dark-white bg-[#F6F6F6] dark:bg-[#121212] outline-none
            [appearance:textfield]
            [&::-webkit-inner-spin-button]:appearance-none
            [&::-webkit-outer-spin-button]:appearance-none
          "
        />
        <Stepper
          onUp={() => {
            const n = parseInt(inputVal || "0") + 1;
            handleChange(String(n));
          }}
          onDown={() => {
            const n = parseInt(inputVal || "0") - 1;
            if (n >= 0) handleChange(String(n));
          }}
          label="Weight"
        />
      </div>

      {error && (
        <p className="text-xs text-rose-500 dark:text-rose-700 mt-1">{error}</p>
      )}
    </div>
  );
};

/*
  Stepper arrows extracted so both inputs share the same arrow UI.
*/
const Stepper = ({
  onUp,
  onDown,
  label,
}: {
  onUp: () => void;
  onDown: () => void;
  label: string;
}) => (
  <div className="flex flex-col border-l border-cocoa/10 dark:border-dark-white/10 shrink-0">
    <button
      type="button"
      onClick={onUp}
      aria-label={`Increase ${label}`}
      className="px-2 py-1.5 text-cocoa-faded
        hover:text-cocoa dark:hover:text-dark-white transition-colors min-w-10"
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
      onClick={onDown}
      aria-label={`Decrease ${label}`}
      className="px-2 py-1.5 text-cocoa-faded
        hover:text-cocoa dark:hover:text-dark-white transition-colors
        border-t border-cocoa/10 dark:border-dark-white/10"
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
);

/* Dropdown, age range and region */
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
    <label className="font-heading block text-sm font-medium text-cocoa dark:text-dark-white mb-1.5">
      {label}
    </label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full px-4 py-3 rounded-lg appearance-none outline-none
          border border-cocoa/20 dark:border-dark-white/20
          bg-[#F6F6F6] dark:bg-[#121212]
          text-sm text-cocoa dark:text-dark-white
          focus:border-moringa-faded focus:ring-1 focus:ring-moringa-faded/50
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
      <span
        className="absolute right-3 top-1/2 -translate-y-1/2
        pointer-events-none text-cocoa-faded"
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

  /* Resume from saved step if user closed mid-onboarding */
  const [step, setStep] = useState<number>(() => {
    const saved = localStorage.getItem(STEP_STORAGE_KEY);
    const parsed = saved ? parseInt(saved) : 1;
    return parsed >= 1 && parsed <= TOTAL_STEPS ? parsed : 1;
  });

  /* Accumulated form data across all steps */
  const [data, setData] = useState<OnboardingData>({
    healthGoal: null,
    dietaryStyle: undefined, // undefined = not yet touched, null = "No pattern"
    activityLevel: null,
    biologicalSex: null,
    ageRange: null,
    region: "",
    heightCm: 0,
    weightKg: 0,
  });

  const [stepError, setStepError] = useState("");
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* Image rotation refs */
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeIndex = useRef(0);

  /* Preload images then start crossfade cycle */
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
      }, 5000);
    };

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      imgs.forEach((img) => {
        img.onload = null;
      });
    };
    // AUTH_IMAGES is a module-level constant. safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Helpers */
  const update = (patch: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const saveStep = (s: number) => {
    setStep(s);
    localStorage.setItem(STEP_STORAGE_KEY, String(s));
  };

  const goBack = () => {
    setStepError("");
    saveStep(Math.max(1, step - 1));
  };

  /* Step 1 skip. goal stays null, advances to step 2 */
  const handleSkip = () => {
    update({ healthGoal: null });
    setStepError("");
    saveStep(2);
  };

  /* Step 2 continue, dietary style is mandatory */
  const handleStep2Continue = () => {
    if (data.dietaryStyle === undefined) {
      setStepError("Please select an option to continue.");
      return;
    }
    setStepError("");
    saveStep(3);
  };

  /* Step 3 continue, activity level is mandatory */
  const handleStep3Continue = () => {
    if (!data.activityLevel) {
      setStepError("Please select your activity level to continue.");
      return;
    }
    setStepError("");
    saveStep(4);
  };

  /* Step 4 done, all fields mandatory, sends to backend */
  const handleDone = async () => {
    if (!data.biologicalSex || !data.ageRange || !data.region) {
      setApiError("Please complete all fields before continuing.");
      return;
    }
    setApiError("");
    setSubmitting(true);
    try {
      await api.patch("/api/users/health", {
        /*
    Only include health_goal if user selected one.
    Sending null causes backend enum validation to fail.
    Omitting the key entirely means backend leaves it unchanged.
  */
        ...(data.healthGoal ? { health_goal: data.healthGoal } : {}),
        ...(data.dietaryStyle ? { dietary_style: data.dietaryStyle } : {}),
        activity_level: data.activityLevel,
        biological_sex: data.biologicalSex,
        age_range: data.ageRange,
        region: data.region,
        height_cm: data.heightCm,
        weight_kg: data.weightKg,
      });
      /* Clear saved step, onboarding complete */
      localStorage.removeItem(STEP_STORAGE_KEY);
      // No flag to update, onboarding completion is determined by
      // whether health profile exists (checked via resolvePostAuthRoute on login)
      navigate("/", { replace: true });
    } catch (err) {
      setApiError(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Step content ────────────────────────────────────────────── */
  const renderStep = () => {
    switch (step) {
      /* ── Step 1: Goal ── */
      case 1:
        return (
          <>
            <p className="text-xs text-cocoa-faded mb-5">
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
              onClick={() => saveStep(2)}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl mb-3  bg-moringa dark:bg-moringa-faded  text-surface font-semibold text-sm  hover:opacity-90 transition-opacity"
            >
              Continue <ArrowRight size={16} />
            </button>

            {/* Skip, advances to step 2, goal stays null */}
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

      /* ── Step 2: Dietary pattern, mandatory ── */
      case 2:
        return (
          <>
            <p className="text-xs text-cocoa-faded mb-1">
              A few details to personalize your suggestions
            </p>
            <h2 className="font-heading text-xl font-bold text-cocoa dark:text-dark-white mb-6">
              Are you currently following a{" "}
              <span className="text-pawpaw dark:text-black-pawpaw">
                pattern?
              </span>
            </h2>

            <div
              className="flex flex-col divide-y
              divide-cocoa/5 dark:divide-dark-white/5 mb-6"
            >
              {DIET_OPTIONS.map((opt) => (
                <CheckRow
                  key={String(opt.value)}
                  label={opt.label}
                  checked={data.dietaryStyle === opt.value}
                  onSelect={() => {
                    update({ dietaryStyle: opt.value });
                    setStepError("");
                  }}
                />
              ))}
            </div>

            {stepError && (
              <p
                className="text-sm text-rose-500 dark:text-rose-700 mb-3"
                role="alert"
              >
                {stepError}
              </p>
            )}

            <button
              type="button"
              onClick={handleStep2Continue}
              className="w-full flex items-center justify-center gap-3
                py-4 rounded-xl
                bg-moringa dark:bg-moringa-faded
                text-surface font-semibold text-sm
                hover:opacity-90 transition-opacity"
            >
              Continue <ArrowRight size={16} />
            </button>
          </>
        );

      /* ── Step 3: Activity level mandatory ── */
      case 3:
        return (
          <>
            <p className="text-xs text-cocoa-faded mb-2">
              A few details to personalize your suggestions
            </p>
            <h2 className="font-heading text-xl font-bold text-cocoa dark:text-dark-white mb-6">
              Activity status
            </h2>

            <div
              className="flex flex-col divide-y
              divide-cocoa/5 dark:divide-dark-white/5 mb-6"
            >
              {ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    update({ activityLevel: opt.value });
                    setStepError("");
                  }}
                  className="flex items-center gap-3 w-full py-3 text-left"
                >
                  <span
                    className={`
                    w-5 h-5 rounded-sm border-2 flex items-center
                    justify-center shrink-0 transition-colors duration-150
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
                  {/* Bold label, italic description */}
                  <span className="text-sm text-cocoa dark:text-dark-white">
                    <span className="font-semibold">{opt.label}</span>
                    {" - "}
                    <span className="text-[13px] md:text-sm italic text-cocoa-faded">
                      {opt.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {stepError && (
              <p
                className="text-sm text-rose-500 dark:text-rose-700 mb-3"
                role="alert"
              >
                {stepError}
              </p>
            )}

            <button
              type="button"
              onClick={handleStep3Continue}
              className="w-full flex items-center justify-center gap-3
                py-4 rounded-xl
                bg-moringa dark:bg-moringa-faded
                text-surface font-semibold text-sm
                hover:opacity-90 transition-opacity"
            >
              Continue <ArrowRight size={16} />
            </button>
          </>
        );

      /* ── Step 4: Body stats, mandatory ── */
      case 4:
        return (
          <>
            <p className="text-xs text-cocoa-faded mb-2">
              A few details to personalize your suggestions
            </p>
            <h2 className="font-heading text-xl font-bold text-cocoa dark:text-dark-white mb-6">
              A bit about you
            </h2>

            {apiError && (
              <p
                className="text-xs text-rose-500 dark:text-rose-700 mb-3 mt-1 break-words"
                role="alert"
              >
                {apiError}
              </p>
            )}

            {/* Biological sex toggle */}
            <div className="flex gap-2 mt-3 mb-5">
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
                        ? "bg-pawpaw dark:bg-black-pawpaw border-pawpaw dark:border-black-pawpaw text-surface font-bold"
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
            <div className="flex gap-3 mb-5">
              <HeightInput
                valueCm={data.heightCm}
                onChange={(v) => update({ heightCm: v })}
              />
              <WeightInput
                valueKg={data.weightKg}
                onChange={(v) => update({ weightKg: v })}
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
              className="w-full flex items-center justify-center
                py-4 rounded-xl
                bg-moringa dark:bg-moringa-faded
                text-surface font-semibold text-sm
                hover:opacity-90 transition-opacity
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving..." : "Done"}
            </button>
          </>
        );

      default:
        return null;
    }
  };

  /* ── Layout ──────────────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 md:p-8"
      style={{
        background:
          resolvedTheme === "dark"
            ? "linear-gradient(170deg, #405245 10%, #2A3129 45%, #2A3129 10%, #171410 100%)"
            : "linear-gradient(170deg, #9DAFA1 15%, #EAE8DE 45%, #EAE8DE 30%, #F6F1E7 100%)",
      }}
    >
      <div
        className="w-full max-w-[900px] flex flex-col md:flex-row
        rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* ── LEFT PANEL, desktop only ──────────────────────────
            Rotating bg images with crossfade + color overlay.
            Same mechanic as all other auth screens.
            Heading "Getting started" on two lines, items at bottom.
        ────────────────────────────────────────────────────────── */}
        <div
          className="hidden md:flex md:w-[45%] md:min-w-[200px] md:max-w-[45%] flex-col relative
          overflow-hidden bg-off-white dark:bg-black-surface shrink-0"
        >
          {/* Rotating images */}
          {AUTH_IMAGES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden="true"
              ref={(el) => {
                imgRefs.current[i] = el;
              }}
              className="absolute inset-0 w-full h-full object-cover
                object-center transition-opacity duration-700 ease-in-out"
              style={{ opacity: i === 0 ? 1 : 0 }}
              draggable={false}
            />
          ))}

          {/* Color overlay */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor:
                resolvedTheme === "dark"
                  ? "rgba(34,30,24,0.87)"
                  : "rgba(246,241,231,0.84)",
            }}
          />

          {/* Content above overlay */}
          <div className="relative z-10 flex flex-col h-full p-8">
            {/* Logo */}
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

            {/* Heading + items pushed to bottom */}
            <div className="flex flex-col justify-end flex-1 pb-4">
              <h1
                className="font-heading text-[2.8rem] font-bold leading-tight
                text-moringa dark:text-dark-white mb-6"
              >
                Getting
                <br />
                started
              </h1>
              <ConveyorTicker items={PANEL_ITEMS} />
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────
            White (light) / black-box (dark).
            Mobile: full width, shows "Getting started..." heading
            at the top above the progress bar.
        ────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-surface dark:bg-black-box px-5 py-8 md:px-8 overflow-y-auto">
          {/* Mobile-only heading */}
          <div className="md:hidden mb-4">
            <h1
              className="font-heading text-2xl font-bold leading-tight
              text-moringa dark:text-dark-white"
            >
              Getting started...
            </h1>
          </div>

          {/* Progress bar, always at top of right panel */}
          <ProgressBar step={step} />

          {/* Back arrow, step 2 onward */}
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              className="flex items-center text-cocoa dark:text-dark-white
                hover:opacity-60 transition-opacity mb-4 mt-1 text-base"
            >
              ←
            </button>
          )}

          {/* Active step content */}
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;
