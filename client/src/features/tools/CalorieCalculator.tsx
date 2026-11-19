"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ACTIVITY_OPTIONS,
  GOAL_OPTIONS,
  calculateBmr,
  calculateCaloricTarget,
  calculateMaintenance,
  calculateWaterTarget,
  type ActivityLevel,
  type BiologicalSex,
  type HealthGoal,
} from "@/lib/calculations";

/*
  Public calorie and water target calculator. Runs entirely in the
  browser, nothing is sent anywhere. Uses the same formulas the app uses
  at onboarding (lib/calculations.ts mirrors the server), so the number
  a visitor sees here is the number Flax would assign after sign up.
*/

const LIMITS = {
  age: { min: 16, max: 100 },
  heightCm: { min: 50, max: 300 },
  weightKg: { min: 10, max: 500 },
};

const parse = (value: string): number | null => {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const inRange = (n: number | null, { min, max }: { min: number; max: number }) =>
  n !== null && n >= min && n <= max;

const inputClass =
  "w-full rounded-xl border border-cocoa/15 dark:border-dark-white/15 bg-off-white dark:bg-dark-bg px-4 py-3 text-sm text-cocoa dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-pawpaw dark:focus:ring-black-pawpaw";

const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) => (
  <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-off-white dark:bg-dark-bg p-1 gap-1">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        role="radio"
        aria-checked={value === o.value}
        onClick={() => onChange(o.value)}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
          value === o.value
            ? "bg-moringa dark:bg-moringa-faded text-surface"
            : "text-cocoa-faded hover:text-cocoa dark:hover:text-dark-white"
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const Field = ({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: string }) => (
  <div>
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-cocoa dark:text-dark-white mb-2">
      {label}
    </label>
    {children}
    {hint && <p className="text-[11px] text-cocoa-faded mt-1">{hint}</p>}
  </div>
);

export const CalorieCalculator = () => {
  const id = useId();
  const [sex, setSex] = useState<BiologicalSex>("female");
  const [age, setAge] = useState("");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">("cm");
  const [heightCm, setHeightCm] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState<ActivityLevel>("lightly_active");
  const [goal, setGoal] = useState<HealthGoal>("maintenance");

  const ageN = parse(age);
  const heightCmN =
    heightUnit === "cm"
      ? parse(heightCm)
      : (() => {
          const ft = parse(heightFt);
          const inch = parse(heightIn) ?? 0;
          return ft === null ? null : Math.round((ft * 12 + inch) * 2.54);
        })();
  const weightRaw = parse(weight);
  const weightKgN =
    weightRaw === null ? null : weightUnit === "kg" ? weightRaw : Math.round(weightRaw * 0.45359237 * 10) / 10;

  const valid =
    inRange(ageN, LIMITS.age) && inRange(heightCmN, LIMITS.heightCm) && inRange(weightKgN, LIMITS.weightKg);

  const results = valid
    ? {
        target: calculateCaloricTarget(sex, weightKgN!, heightCmN!, ageN!, activity, goal),
        maintenance: calculateMaintenance(sex, weightKgN!, heightCmN!, ageN!, activity),
        bmr: Math.round(calculateBmr(sex, weightKgN!, heightCmN!, ageN!)),
        water: calculateWaterTarget(sex, activity),
      }
    : null;

  const anyTouched = age !== "" || heightCm !== "" || heightFt !== "" || weight !== "";

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-5">
      <form
        className="bg-surface dark:bg-black-surface rounded-2xl p-5 md:p-7 shadow-sm grid gap-5"
        onSubmit={(e) => e.preventDefault()}
        aria-describedby={`${id}-privacy`}
      >
        <Field label="Sex">
          <Segmented
            label="Sex"
            value={sex}
            onChange={setSex}
            options={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ]}
          />
        </Field>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            {/* Same row height as the Height label row with its unit
                toggle, so the two inputs line up. */}
            <div className="flex items-center min-h-8 mb-2">
              <label htmlFor={`${id}-age`} className="text-xs font-semibold text-cocoa dark:text-dark-white">
                Age <span className="font-normal text-cocoa-faded">(16 to 100 years)</span>
              </label>
            </div>
            <input
              id={`${id}-age`}
              type="number"
              inputMode="numeric"
              min={LIMITS.age.min}
              max={LIMITS.age.max}
              placeholder="e.g. 28"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between min-h-8 mb-2">
              <span className="text-xs font-semibold text-cocoa dark:text-dark-white">Height</span>
              <Segmented
                label="Height unit"
                value={heightUnit}
                onChange={setHeightUnit}
                options={[
                  { value: "cm", label: "cm" },
                  { value: "ft", label: "ft / in" },
                ]}
              />
            </div>
            {heightUnit === "cm" ? (
              <input
                aria-label="Height in centimetres"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 168"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className={inputClass}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <input
                  aria-label="Height, feet"
                  type="number"
                  inputMode="numeric"
                  placeholder="ft"
                  value={heightFt}
                  onChange={(e) => setHeightFt(e.target.value)}
                  className={inputClass}
                />
                <input
                  aria-label="Height, inches"
                  type="number"
                  inputMode="numeric"
                  placeholder="in"
                  value={heightIn}
                  onChange={(e) => setHeightIn(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between min-h-8 mb-2">
            <span className="text-xs font-semibold text-cocoa dark:text-dark-white">Weight</span>
            <Segmented
              label="Weight unit"
              value={weightUnit}
              onChange={setWeightUnit}
              options={[
                { value: "kg", label: "kg" },
                { value: "lb", label: "lb" },
              ]}
            />
          </div>
          <input
            aria-label={weightUnit === "kg" ? "Weight in kilograms" : "Weight in pounds"}
            type="number"
            inputMode="decimal"
            placeholder={weightUnit === "kg" ? "e.g. 70" : "e.g. 154"}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={inputClass}
          />
        </div>

        <Field label="Activity level" htmlFor={`${id}-activity`}>
          <select
            id={`${id}-activity`}
            value={activity}
            onChange={(e) => setActivity(e.target.value as ActivityLevel)}
            className={inputClass}
          >
            {ACTIVITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}: {o.description}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Goal" htmlFor={`${id}-goal`}>
          <select
            id={`${id}-goal`}
            value={goal}
            onChange={(e) => setGoal(e.target.value as HealthGoal)}
            className={inputClass}
          >
            {GOAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <p id={`${id}-privacy`} className="text-[11px] text-cocoa-faded">
          Calculated in your browser. Nothing you enter here is sent or stored.
        </p>
      </form>

      <aside
        aria-live="polite"
        className="bg-moringa dark:bg-moringa-faded/50 rounded-2xl p-6 md:p-7 text-surface flex flex-col"
      >
        <h2 className="font-heading font-bold text-base mb-5">Your daily targets</h2>
        {results ? (
          <>
            <p className="text-xs text-surface/75">Calorie target</p>
            <p className="font-heading font-bold text-4xl mb-1">
              {results.target.toLocaleString()} <span className="text-base font-semibold">kcal</span>
            </p>
            <p className="text-xs text-surface/75 mb-5">
              Maintenance {results.maintenance.toLocaleString()} kcal · BMR {results.bmr.toLocaleString()} kcal
            </p>
            <p className="text-xs text-surface/75">Water target</p>
            <p className="font-heading font-bold text-3xl mb-1">
              {(results.water / 1000).toFixed(1)} <span className="text-base font-semibold">litres</span>
            </p>
            <p className="text-xs text-surface/75 mb-6">
              {results.water.toLocaleString()} ml, about {Math.round(results.water / 250)} glasses of 250 ml
            </p>
            <p className="text-xs text-surface/80 leading-relaxed mb-5">
              These are the exact targets Flax would set for you. Track them every day, log Nigerian
              and West African dishes, and let Noura scan your plate.
            </p>
            <Link
              href="/register"
              className="mt-auto inline-flex justify-center px-6 py-3 rounded-lg bg-pawpaw dark:bg-black-pawpaw text-surface font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Track these targets free
            </Link>
          </>
        ) : (
          <p className="text-sm text-surface/80 leading-relaxed">
            {anyTouched
              ? "Check your age (16 to 100), height and weight to see your targets."
              : "Enter your age, height and weight to see your daily calorie and water targets."}
          </p>
        )}
      </aside>
    </div>
  );
};
