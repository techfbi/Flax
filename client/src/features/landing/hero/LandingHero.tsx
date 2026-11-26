"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { preload } from "react-dom";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DEMO_STEPS, FlaxAppDemo, PLATE_IMG } from "./FlaxAppDemo";
import { montserrat } from "./fonts";
import "./hero.css";


/* ── Typing animation ────────────────────────────────────────── */
const PHRASES = ["Figuring what to eat", "Staying hydrated", "Tracking your diet"];
const TYPE_SPEED = 60;
const DELETE_SPEED = 35;
const PAUSE_AFTER = 2200;

const useTypedPhrase = () => {
  const [displayed, setDisplayed] = useState("");
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = PHRASES[index];
    if (!deleting && displayed === current) {
      const t = setTimeout(() => setDeleting(true), PAUSE_AFTER);
      return () => clearTimeout(t);
    }
    if (deleting && displayed === "") {
      const t = setTimeout(() => {
        setDeleting(false);
        setIndex((i) => (i + 1) % PHRASES.length);
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setDisplayed((p) => (deleting ? p.slice(0, -1) : current.slice(0, p.length + 1))),
      deleting ? DELETE_SPEED : TYPE_SPEED,
    );
    return () => clearTimeout(t);
  }, [displayed, deleting, index]);

  return displayed;
};

// Its own component so each typed letter re-renders only this line, never
// the running demo beside it.
const TypedPhrase = () => (
  <span className="relative inline-block min-h-[1.1em] whitespace-nowrap text-pawpaw dark:text-black-pawpaw">
    {useTypedPhrase()}
    <span className="typing-cursor" />
    <svg
      className="absolute -bottom-[0.17em] left-0 h-[0.26em] w-full text-pawpaw/40"
      viewBox="0 0 300 12"
      preserveAspectRatio="none"
    >
      <path d="M2 9 C 60 2, 140 2, 298 7" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  </span>
);

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

// The app window, with a quiet step line below.
const Demo = () => {
  const [step, setStep] = useState(0);
  return (
    <div className="hero-demo">
      <FlaxAppDemo onStep={setStep} />
      <ol style={delay(750)} className="hero-in mt-6 flex items-center justify-center gap-1" aria-label="What Flax does">
        {DEMO_STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-1">
            <span
              className={`hero-step inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 font-semibold transition-colors duration-300 sm:px-3 ${
                i === step
                  ? "bg-moringa text-white dark:bg-moringa-faded dark:text-cocoa"
                  : i < step
                    ? "text-moringa dark:text-moringa-faded"
                    : "text-cocoa/40 dark:text-dark-white/40"
              }`}
            >
              {label}
            </span>
            {i < DEMO_STEPS.length - 1 && <span aria-hidden className="h-px w-2 bg-cocoa/15 dark:bg-white/15 sm:w-7" />}
          </li>
        ))}
      </ol>
    </div>
  );
};

/* ── Hero, sizes live in hero.css ────────────────────────────── */
export const LandingHero = () => {
  // The demo mounts after hydration, this starts its photo with the HTML.
  preload(PLATE_IMG, { as: "image", fetchPriority: "high" });
  return (
    <section className="hero relative flex items-center overflow-hidden bg-off-white dark:bg-dark-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[820px] bg-page-gradient dark:bg-page-gradient-dark lg:h-full"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(47,93,75,0.16)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)] dark:bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)]"
      />

      <div className="hero-grid">
        <div>
          <h1
            className={`${montserrat.className} hero-title font-extrabold leading-[1.1] tracking-[-0.035em] text-cocoa dark:text-dark-white`}
          >
            {/* The typed phrase starts empty, so screen readers and search
                engines get the full phrases as text. */}
            <span className="sr-only">
              Figuring what to eat, staying hydrated and tracking your diet doesn&apos;t have to be complicated
            </span>
            {/* Sized so the longest phrase always fits on one line. */}
            <span aria-hidden className="hero-in-title hero-title-lines flex">
              <TypedPhrase />
            </span>
            <span aria-hidden style={delay(100)} className="hero-in-title mt-[0.26em] block">
              doesn&apos;t have to be complicated
            </span>
          </h1>

          <p style={delay(220)} className="hero-in hero-text leading-relaxed text-cocoa/70 dark:text-dark-white/70">
            Flax learns your goal and keeps you on track, meal by meal, glass by glass. Log local dishes in
            seconds, snap your plate for instant calories, and ask Noura anything.
          </p>

          <div style={delay(340)} className="hero-in hero-actions">
            <Link
              href="/register"
              className="hero-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-cocoa font-semibold text-white shadow-lg shadow-cocoa/20 transition hover:bg-black dark:bg-dark-white dark:text-cocoa dark:hover:bg-white"
            >
              Get started free <ArrowRight size="1.2em" aria-hidden />
            </Link>
            <Link
              href="/tools/calorie-calculator"
              className="hero-btn inline-flex items-center justify-center whitespace-nowrap rounded-full border border-cocoa/10 bg-white/60 font-semibold text-cocoa backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-dark-white dark:hover:bg-white/10"
            >
              Calculate your calories
            </Link>
          </div>
        </div>

        <Demo />
      </div>
    </section>
  );
};
