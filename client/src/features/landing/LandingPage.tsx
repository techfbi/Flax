import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  MessageSquare,
  Sparkles,
  Brain,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Navbar } from "@/components/layout/Navbar";
import { line, curveMonotoneX } from "d3-shape";
import {
  ScrollReveal,
  ScrollRevealGroup,
  ScrollRevealItem,
} from "@/components/ui/ScrollReveal";

/**
 * Landing page — the only scrollable page.
 * Every section, color, fill, card, chart, and badge matches the design exactly
 * Streak cards contain inline SVG charts — donut + macro bars (left),
 * area line chart (right). No library needed for these static display elements.
 */

/* ── Typing animation hook ───────────────────────────────────── */
const PHRASES = [
  "Figuring what to eat",
  "Staying hydrated",
  "Tracking your diet",
];
const TYPE_SPEED = 60;
const DELETE_SPEED = 35;
const PAUSE_AFTER = 2200;

const useTypingAnimation = () => {
  const [displayed, setDisplayed] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = PHRASES[phraseIndex];
    if (!isDeleting && displayed === current) {
      const t = setTimeout(() => setIsDeleting(true), PAUSE_AFTER);
      return () => clearTimeout(t);
    }
    if (isDeleting && displayed === "") {
      setIsDeleting(false);
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
      return;
    }
    const delay = isDeleting ? DELETE_SPEED : TYPE_SPEED;
    const t = setTimeout(() => {
      setDisplayed((prev) =>
        isDeleting ? prev.slice(0, -1) : current.slice(0, prev.length + 1),
      );
    }, delay);
    return () => clearTimeout(t);
  }, [displayed, isDeleting, phraseIndex]);

  return displayed;
};

/* ── Donut chart — goal streak card ─────────────────────────── */
const DonutChart = () => {
  const { resolvedTheme } = useTheme();

  // 1564 / 2900 kcal = ~54% consumed. Stroke arcs: protein moringa, carbs pawpaw, fat yellow
  const r = 54;
  const cx = 70;
  const cy = 70;
  const circ = 2 * Math.PI * r;

  // Segments: protein 40%, carbs 50%, fat 10%, remaining 0%
  const protein = circ * 0.4;
  const carbs = circ * 0.5;
  const fat = circ * 0.1;
  const remain = circ * 0.0;

  return (
    <svg
      viewBox="0 0 140 140"
      className="shrink-0 h-[150px] w-[120px] md:h-[180px] md:w-[150px] lg:h-[200px] lg:w-[180px] "
    >
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="16"
        className="dark:stroke-[#2a2a2a]"
      />
      {/* Remaining grey */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#d1d5db"
        strokeWidth="16"
        strokeDasharray={`${remain} ${circ - remain}`}
        strokeDashoffset={-(protein + carbs + fat) * 1}
        className="dark:stroke-[#333]"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Fat — yellow */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#EAB308"
        strokeWidth="16"
        strokeDasharray={`${fat} ${circ - fat}`}
        strokeDashoffset={-(protein + carbs)}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Carbs — pawpaw */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={resolvedTheme === "dark" ? "#D4522E" : "#E8623C"}
        strokeWidth="16"
        strokeDasharray={`${carbs} ${circ - carbs}`}
        strokeDashoffset={-protein}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Protein — moringa */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={resolvedTheme === "dark" ? "#7FB096" : "#2F5D4B"}
        strokeWidth="16"
        strokeDasharray={`${protein} ${circ - protein}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Center text */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        className="font-heading font-bold"
        fontSize="18"
        fill="currentColor"
      >
        1564
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#9CA3AF">
        / 2900 Kcal
      </text>
    </svg>
  );
};

/* ── Area line chart — water streak card ─────────────────────── */
const WaterChart = () => {
  const { resolvedTheme } = useTheme();
  // Points matching the design curve shape
  const points: [number, number][] = [
    [0, 80],
    [60, 40],
    [120, 55],
    [180, 20],
    [240, 35],
    [300, 10],
  ];
  const svgW = 300;
  const svgH = 100;

  const pathD =
    line<[number, number]>()
      .x((d: [number, number]) => d[0])
      .y((d: [number, number]) => d[1])
      .curve(curveMonotoneX)(points) ?? "";

  const areaD = `${pathD} L${svgW},${svgH} L0,${svgH} Z`;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="h-36 md:h-48"
      preserveAspectRatio="none"
    >
      {/* Filled area */}
      <path d={areaD} fill="rgba(232,98,60,0.12)" />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={resolvedTheme === "dark" ? "#D4522E" : "#E8623C"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dots at key points */}
      {[
        [60, 40],
        [180, 20],
        [240, 35],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="3.5"
          fill="white"
          stroke="#E8623C"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
};

/* ── Noura capability thread data ────────────────────────────── */
// Four things Noura actually does inside the app, in the order a user
// would naturally discover them. Icons render with currentColor via
// lucide, so they pick up the text color classes applied where used.
const NOURA_CAPABILITIES = [
  {
    icon: Camera,
    title: "Scan a plate",
    description:
      "Point your camera at what's in front of you. Noura identifies every item and works out the calories and macros before you've picked up a fork.",
  },
  {
    icon: MessageSquare,
    title: "Ask anything",
    description:
      "Wondering if a dish fits your goal, or how your week's gone. Noura already knows your profile, so the answer is actually about you.",
  },
  {
    icon: Sparkles,
    title: "Estimate on the fly",
    description:
      "No dish is too local or too homemade. Describe it and Noura works out the nutrition, no database required.",
  },
  {
    icon: Brain,
    title: "Explain the why",
    description:
      "Every meal Noura suggests comes with a reason, so you're never just trusting a random pick.",
  },
];

/* ── Main component ──────────────────────────────────────────── */
const LandingPage = () => {
  const navigate = useNavigate();
  const typedText = useTypingAnimation();
  const { resolvedTheme } = useTheme();

  return (
    <div className="min-h-screen bg-off-white dark:bg-dark-bg font-body">
      <Navbar />

      {/* ══ HERO ════════════════════════════════════════════════
          Gradient: light = off-white body, green enters from top-left corner slanting.
          Dark = dark-bg body, green enters from top-left corner edge slanting.
          The navbar floats above so we add pt to clear it (fixed nav = 56px + 12px gap).
      ══════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden min-h-[100vh] md:min-h-[70vh] lg:min-h-[90vh] flex items-center"
        style={{
          background:
            resolvedTheme === "dark"
              ? /* Dark: dark-bg dominates, moringa bleeds from top-left corner edge */
                "linear-gradient(170deg, #405245 10%, #2A3129 45%, #2A3129 10%, #171410 100%)"
              : /* Light: off-white dominates, moringa-faded bleeds from top-left */
                "linear-gradient(170deg, #9DAFA1 15%, #EAE8DE 45%, #EAE8DE 30%, #F6F1E7 100%)",
        }}
      >
        <div className="w-full max-w-7xl mx-auto px-6 pt-20 md:pt-24 pb-0 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          {/* Left: text + CTA */}
          <div className=" w-full md:max-w-[520px] flex flex-col items-center text-center md:items-start md:text-left">
            {/* Line 1: animated phrase in pawpaw */}
            <h1
              className="font-heading font-bold leading-tight text-cocoa dark:text-dark-white"
              style={{ fontSize: "clamp(1.7rem, 3vw, 3rem)" }}
            >
              <span className="text-pawpaw dark:text-black-pawpaw whitespace-nowrap">
                {typedText}
                <span className="typing-cursor" aria-hidden="true" />
              </span>
              {/* Line 2: static, always visible */}
              <br />
              <span>doesn't have to be complicated</span>
            </h1>

            <p className="mt-5 text-sm md:text-base text-cocoa dark:text-dark-white leading-relaxed max-w-md">
              <strong>Flax</strong> learns your goal and helps you stay on track
              with it, meal by meal, glass by glass. Log what you eat, keep tabs
              on your water, and build the kind of consistency that actually
              sticks. And whenever you're unsure,
              <strong> Noura</strong>, your AI nutrition assistant, is right
              there with an answer built around you.
            </p>

            {/* Get Started — moringa filled, no bottom margin so it touches the section edge */}
            <div className="mt-8">
              <button
                onClick={() => navigate("/register")}
                className="
                  inline-flex items-center gap-3 px-7 py-3 rounded-lg
                  bg-moringa dark:bg-moringa-faded
                  text-surface font-semibold text-sm
                  hover:opacity-90 transition-opacity
                "
              >
                Get Started
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          {/* Hero Image */}
          <div className="flex-shrink-0 flex items-end justify-center md:justify-end md:self-end">
            <img
              src="/images/heroImage1.png"
              alt="Diet plate and water bottle"
              className="w-[380px] md:w-[380px] lg:w-[500px] object-contain object-bottom "
              draggable={false}
            />
          </div>
        </div>
      </section>

      {/* ══ WHY THE BASICS MATTER ═══════════════════════════════
          Section bg: surface (light) / black-surface (dark)
          Cards: moringa filled (dark green) with white text
      ══════════════════════════════════════════════════════════ */}
      <section className="bg-surface dark:bg-black-surface py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <h2 className="font-heading text-1xl md:text-3xl font-bold text-center text-cocoa dark:text-dark-white mb-4 max-w-80 md:max-w-2xl mx-auto">
              Most nutrition advice{" "}
              <span className="text-pawpaw dark:text-black-pawpaw">fails</span>{" "}
              because it ignores the{" "}
              <span className="text-pawpaw dark:text-black-pawpaw">habits</span>{" "}
              people struggle with every day.
            </h2>
            <p className="text-center text-xs md:text-sm font-bold text-cocoa-faded mb-12">
              Why the basics matter
            </p>
          </ScrollReveal>

          {/* Two moringa-filled cards */}
          <ScrollRevealGroup className="grid md:grid-cols-2 gap-6">
            <ScrollRevealItem className="bg-moringa dark:bg-moringa-faded/50 rounded-2xl p-8 shadow-sm">
              {/* Card 1 */}
              <div>
                {/* Icon circle — amber/yellow bg */}
                <div className="w-14 h-14 rounded-full bg-[#D89A2D] flex items-center justify-center mb-6 shadow-sm">
                  <img
                    src="/images/forkKnife.png"
                    alt="cutlery"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <h3 className="font-heading font-bold text-base text-surface mb-3">
                  What you eat adds up faster than you think
                </h3>
                <p className="text-sm text-surface/80 leading-relaxed">
                  A meal here, a snack there, it's easy to lose track. Log from
                  a regional catalogue, describe something custom, or let Noura
                  estimate it for you, whichever way you actually eat.
                </p>
              </div>
            </ScrollRevealItem>

            <ScrollRevealItem className="bg-moringa dark:bg-moringa-faded/50 rounded-2xl p-8 shadow-sm">
              {/* Card 2 */}
              <div>
                <div className="w-14 h-14 rounded-full bg-[#D89A2D] flex items-center justify-center mb-6 shadow-sm">
                  <img
                    src="/images/cupWhite.svg"
                    alt="water drop"
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>
                <h3 className="font-heading font-bold text-base text-surface mb-3">
                  Hydration is the part everyone forgets
                </h3>
                <p className="text-sm text-surface/80 leading-relaxed">
                  Water affects energy, appetite, and how your body actually
                  uses what you eat. Flax calculates a target built for your
                  body, so you're working toward a real number, not a guess.
                </p>
              </div>
            </ScrollRevealItem>
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ══ HOW FLAX ACTUALLY HELPS ═════════════════════════════
          Section bg: off-white (light) / dark-bg (dark) — normal body bg, no fill
          "Tell flax..." box: surface (light) / black-surface (dark)
      ══════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <ScrollReveal>
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="font-heading text-1xl md:text-3xl max-w-80 md:max-w-xl font-bold mb-4 mx-auto">
              <span className="text-pawpaw dark:text-black-pawpaw">
                It connects what you eat
              </span>{" "}
              <span className="text-cocoa dark:text-dark-white">
                to where you're headed
              </span>
            </h2>
            <p className="text-xs md:text-sm font-bold text-cocoa-faded mb-8">
              This is how flax actually helps
            </p>

            {/* Content box */}
            <div className="bg-surface dark:bg-black-surface rounded-2xl p-8 max-w-2xl mx-auto text-left">
              <p className="text-sm md:text-base text-cocoa dark:text-dark-white leading-relaxed text-center">
                Tell flax your goal once,{" "}
                <strong>lose weight, gain muscle, eat better</strong>, whatever
                it is, and every target, every log, every streak is calculated
                around getting you there. No spreadsheets, no guesswork, just
                numbers that actually apply to you.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ══ BUILT TO KEEP YOU GOING ═════════════════════════════
          Section bg: normal body bg — no fill
          Cards: surface (light) / black-surface (dark)
          Badge top-right: moringa-faded border pill + moringa-deep dot + label text
      ══════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <h2 className="font-heading text-1xl md:text-3xl font-bold text-center text-cocoa dark:text-dark-white mb-3">
              Two streaks, two reasons to come back
            </h2>
            <p className="text-center text-xs md:text-sm font-bold text-cocoa-faded mb-12">
              Built to keep you going
            </p>
          </ScrollReveal>

          <ScrollRevealGroup className="grid md:grid-cols-2 gap-6">
            {/* ── Goal streak card ── */}
            <ScrollRevealItem className="bg-surface dark:bg-black-surface rounded-2xl p-6 shadow-sm">
              <div>
                {/* Card header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    {/* Flame icon circle — amber bg */}
                    <div className="w-12 h-12 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                      <span className="text-2xl">
                        <img
                          src="/images/fire.png"
                          alt="fie"
                          width={32}
                          height={32}
                          className="object-contain"
                        />
                      </span>
                    </div>
                    <div>
                      <p className="font-heading text-[14px] text-cocoa-faded font-semibold">
                        Goal streak
                      </p>
                      <p className="font-heading font-bold text-lg text-cocoa dark:text-dark-white">
                        25 days
                      </p>
                    </div>
                  </div>
                  {/* Badge — moringa-faded border, moringa-deep dot */}
                  <div className="flex items-center gap-1.5 bg-moringa-faded rounded-full px-3">
                    <span className="text-xs font-medium text-cocoa dark:text-dark-white">
                      Healthy
                    </span>
                  </div>
                </div>

                {/* Today's intake label */}
                <p className="text-sm font-bold text-cocoa dark:text-dark-white mb-3">
                  Today's intake
                </p>

                {/* Donut + macro rows side by side */}
                <div className="flex items-center gap-5 mb-7">
                  <DonutChart />
                  <div className="flex-1 flex flex-col gap-2.5">
                    {/* Protein */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-moringa dark:bg-moringa-faded shrink-0" />
                        <span className="text-xs text-cocoa-faded">
                          Protein
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-cocoa-faded">
                        94g
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-cocoa/10 dark:bg-dark-white/10">
                      <div
                        className="h-full rounded-full bg-moringa dark:bg-moringa-faded"
                        style={{ width: "65%" }}
                      />
                    </div>
                    {/* Carbs */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-pawpaw dark:bg-black-pawpaw shrink-0" />
                        <span className="text-xs text-cocoa-faded">Carbs</span>
                      </div>
                      <span className="text-xs font-semibold text-cocoa-faded">
                        140g
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-cocoa/10 dark:bg-dark-white/10">
                      <div
                        className="h-full rounded-full bg-pawpaw dark:bg-black-pawpaw"
                        style={{ width: "85%" }}
                      />
                    </div>
                    {/* Fat */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#EAB308] shrink-0" />
                        <span className="text-xs text-cocoa-faded">Fat</span>
                      </div>
                      <span className="text-xs font-semibold text-cocoa-faded">
                        21g
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-cocoa/10 dark:bg-dark-white/10">
                      <div
                        className="h-full rounded-full bg-[#EAB308]"
                        style={{ width: "30%" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Goal progress bar */}
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-cocoa dark:text-dark-white">
                      Goal progress
                    </span>
                    <span className="text-xs font-semibold text-cocoa-faded">
                      61%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-cocoa/10 dark:bg-dark-white/10">
                    <div
                      className="h-full rounded-full bg-moringa dark:bg-moringa-faded"
                      style={{ width: "61%" }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-cocoa-faded">
                      Breakfast
                    </span>
                    <span className="text-[10px] text-cocoa-faded">Brunch</span>
                    <span className="text-[10px] text-moringa dark:text-moringa-faded font-medium mr-20">
                      80% 🔥
                    </span>
                  </div>
                </div>

                <p className="text-xs md:text-sm text-cocoa-faded leading-relaxed mt-4">
                  Hit 80% of your calorie goal, for days running. Not perfect,
                  just consistent, which is what actually works.
                </p>
              </div>
            </ScrollRevealItem>

            <ScrollRevealItem className="bg-surface dark:bg-black-surface rounded-2xl p-6 shadow-sm">
              {/* ── Water streak card ── */}
              <div>
                {/* Card header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#2852C5]/35 flex items-center justify-center">
                      <span className="text-2xl">💧</span>
                    </div>
                    <div>
                      <p className="font-heading text-[14px] text-cocoa-faded font-semibold">
                        Water streak
                      </p>
                      <p className="font-heading font-bold text-lg text-cocoa dark:text-dark-white">
                        8 days
                      </p>
                    </div>
                  </div>
                  {/* Badge */}
                  <div className="flex items-center gap-1.5 bg-moringa-faded rounded-full px-3">
                    <span className="text-xs font-medium text-cocoa dark:text-dark-white">
                      Hydrated
                    </span>
                  </div>
                </div>

                {/* Target label */}
                <div className="flex justify-end mb-1">
                  <span className="text-xs text-pawpaw dark:text-black-pawpaw font-bold">
                    Target: 1850{" "}
                    <span className="text-cocoa-faded">/ 2900ml</span>
                  </span>
                </div>

                {/* Water area chart */}
                <div className="mb-5 rounded-lg overflow-hidden bg-cocoa/5 dark:bg-dark-white/5 px-2 pt-2 pb-1">
                  {/* Y axis labels */}
                  <div className="flex justify-between text-[10px] text-cocoa-faded mb-1 px-1">
                    {["700", "560", "420", "280", "140", "0"].map((v) => (
                      <span key={v}>{v}</span>
                    ))}
                  </div>
                  <WaterChart />
                  {/* X axis labels */}
                  <div className="flex justify-between text-[10px] text-cocoa-faded mt-1 px-1">
                    {["6:00", "8:38", "11:10", "13:50", "18:00"].map((v) => (
                      <span key={v}>{v}</span>
                    ))}
                  </div>
                  <p className="text-center text-[10px] text-cocoa-faded mt-0.5">
                    &lt; Today &gt;
                  </p>
                </div>

                {/* Daily hydration progress */}
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-cocoa dark:text-dark-white">
                      Daily hydration progress
                    </span>
                    <span className="text-xs font-semibold text-cocoa-faded">
                      73%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-cocoa/10 dark:bg-dark-white/10">
                    <div
                      className="h-full rounded-full bg-pawpaw dark:bg-black-pawpaw"
                      style={{ width: "73%" }}
                    />
                  </div>
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-moringa dark:text-moringa-faded font-medium mr-20">
                      80% 🔥
                    </span>
                  </div>
                </div>

                <p className="text-xs md:text-sm text-cocoa-faded leading-relaxed mt-4">
                  Hydration tracked separately, because staying full isn't the
                  same as staying hydrated.
                </p>
              </div>
            </ScrollRevealItem>
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ══ MEET NOURA ══════════════════════════════════════════
          Section bg: moringa (light) / moringa (dark) same dark green both
          Logo: white circle, pawpaw 4-point star inside
          Underline accent below "Meet Noura" in pawpaw

          Below the logo: a single threaded diagram carries all four
          Noura capabilities. Horizontal on md+ (icons in a row, line
          running left to right through their centers). Vertical on
          mobile (icons stacked, line running top to bottom). A soft
          pulse rides the line on a loop in both orientations, built
          with native SVG animateMotion, no animation library needed.
      ══════════════════════════════════════════════════════════ */}
      <section
        id="noura"
        className="bg-moringa dark:bg-moringa-faded/50 py-16 px-6 my-10 overflow-hidden"
      >
        <ScrollReveal>
          <div className="max-w-6xl mx-auto">
            {/* Logo + title centered */}
            <div className="flex flex-col items-center mb-10">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-surface flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#E8623C">
                  <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" />
                </svg>
              </div>
              <h2 className="font-heading text-1xl md:text-2xl font-bold text-surface mb-1">
                Meet Noura
              </h2>
              <div className="w-16 h-1 rounded-full bg-pawpaw dark:bg-black-pawpaw" />
            </div>

            {/* Big centered headline + one-line subhead */}
            <div className="text-center max-w-xl mx-auto mb-16 md:mb-20">
              <h3 className="font-heading text-1xl md:text-3xl font-bold text-surface leading-snug mb-4">
                One assistant,{" "}
                <span className="text-pawpaw dark:text-black-pawpaw">
                  different capabilities
                </span>
              </h3>
              <p className="text-sm md:text-base text-surface/75 leading-relaxed">
                Noura sees your profile and your logs, so every answer,
                estimate, and suggestion is actually about you.
              </p>
            </div>

            {/* ── Threaded capability diagram ─────────────────────── */}
            <ScrollRevealGroup className="relative">
              {/* Desktop / tablet — horizontal thread */}
              <div className="hidden md:grid grid-cols-4 relative">
                <svg
                  className="hidden md:block absolute left-0 right-0 top-7 w-full h-1 pointer-events-none"
                  viewBox="0 0 100 4"
                  preserveAspectRatio="none"
                >
                  {/* Faint static thread, always visible */}
                  <line
                    x1="12.5"
                    y1="2"
                    x2="87.5"
                    y2="2"
                    strokeWidth="1.5"
                    className="stroke-surface/25"
                  />
                  {/* Invisible motion path, same coordinates as the line above */}
                  <path
                    id="nouraFlowDesktop"
                    d="M12.5,2 L87.5,2"
                    fill="none"
                    stroke="none"
                  />
                  {/* Soft trailing glow */}
                  <circle
                    r="2.4"
                    className="fill-pawpaw/30 dark:fill-black-pawpaw/30"
                  >
                    <animateMotion
                      dur="4.5s"
                      repeatCount="indefinite"
                      begin="-0.2s"
                    >
                      <mpath href="#nouraFlowDesktop" />
                    </animateMotion>
                  </circle>
                  {/* Bright leading pulse */}
                  <circle
                    r="1.3"
                    className="fill-pawpaw dark:fill-black-pawpaw"
                  >
                    <animateMotion dur="4.5s" repeatCount="indefinite">
                      <mpath href="#nouraFlowDesktop" />
                    </animateMotion>
                  </circle>
                </svg>

                {NOURA_CAPABILITIES.map(
                  ({ icon: Icon, title, description }) => (
                    <ScrollRevealItem
                      key={title}
                      className="flex flex-col items-center text-center px-3"
                    >
                      <div className="w-14 h-14 rounded-full bg-surface/15 border border-surface/25 backdrop-blur-sm flex items-center justify-center mb-4 relative z-10 transition-transform duration-300 hover:scale-110 hover:bg-surface/25">
                        <Icon
                          size={24}
                          className="text-surface"
                          strokeWidth={1.75}
                        />
                      </div>
                      <p className="font-heading font-bold text-sm text-surface mb-1.5">
                        {title}
                      </p>
                      <p className="text-xs text-surface/70 leading-relaxed max-w-[200px]">
                        {description}
                      </p>
                    </ScrollRevealItem>
                  ),
                )}
              </div>

              {/* Mobile — vertical thread */}
              <div className="md:hidden relative">
                <svg
                  className="md:hidden absolute top-0 bottom-0 left-7 w-1 h-full pointer-events-none"
                  viewBox="0 0 4 100"
                  preserveAspectRatio="none"
                >
                  <line
                    x1="2"
                    y1="12.5"
                    x2="2"
                    y2="87.5"
                    strokeWidth="0.5"
                    className="stroke-surface/25"
                  />
                  <path
                    id="nouraFlowMobile"
                    d="M2,12.5 L2,87.5"
                    fill="none"
                    stroke="none"
                  />
                  <circle
                    r="2.4"
                    className="fill-pawpaw/30 dark:fill-black-pawpaw/30"
                  >
                    <animateMotion
                      dur="4.5s"
                      repeatCount="indefinite"
                      begin="-0.2s"
                    >
                      <mpath href="#nouraFlowMobile" />
                    </animateMotion>
                  </circle>
                  <circle
                    r="1.3"
                    className="fill-pawpaw dark:fill-black-pawpaw"
                  >
                    <animateMotion dur="4.5s" repeatCount="indefinite">
                      <mpath href="#nouraFlowMobile" />
                    </animateMotion>
                  </circle>
                </svg>

                <div className="flex flex-col gap-10">
                  {NOURA_CAPABILITIES.map(
                    ({ icon: Icon, title, description }) => (
                      <ScrollRevealItem
                        key={title}
                        className="flex items-start gap-5 relative"
                      >
                        <div className="w-14 h-14 shrink-0 rounded-full bg-surface/15 border border-surface/25 backdrop-blur-sm flex items-center justify-center relative z-10">
                          <Icon
                            size={22}
                            className="text-surface"
                            strokeWidth={1.75}
                          />
                        </div>
                        <div className="pt-2">
                          <p className="font-heading font-bold text-sm text-surface mb-1">
                            {title}
                          </p>
                          <p className="text-xs text-surface/70 leading-relaxed">
                            {description}
                          </p>
                        </div>
                      </ScrollRevealItem>
                    ),
                  )}
                </div>
              </div>
            </ScrollRevealGroup>
          </div>
        </ScrollReveal>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════
          Section bg: off-white (light) / dark-bg (dark) — normal body, no fill
          Four cards: surface (light) / black-surface (dark)
          Each card: rounded icon circle (its own color) + bold title + body text
      ══════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-heading text-1xl md:text-3xl font-bold text-center text-cocoa dark:text-dark-white mb-3">
            How it works
          </h2>
          <p className="text-center text-xs md:text-sm font-bold text-cocoa-faded mb-12">
            From sign up to your first streak
          </p>

          <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {/* Card 1 — Set your goal, moringa circle */}
            <div className="bg-surface dark:bg-black-surface rounded-2xl p-6 flex gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-moringa-faded flex items-center justify-center shrink-0">
                <img
                  src="/images/targetHit.png"
                  alt="target hit"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <div>
                <p className="font-heading font-bold text-sm md:text-[16px] text-cocoa dark:text-dark-white mb-1">
                  Set your goal
                </p>
                <p className="text-sm text-cocoa-faded leading-relaxed">
                  Region, diet, allergies, and what you're working toward. Two
                  minutes, skip anything you're not ready to share.
                </p>
              </div>
            </div>

            {/* Card 2 — Get a suggestion, pawpaw circle */}
            <div className="bg-surface dark:bg-black-surface rounded-2xl p-6 flex gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-pawpaw dak:bg-black-pawpaw flex items-center justify-center shrink-0">
                <img
                  src="/images/arrowSpin.png"
                  alt="spin"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <div>
                <p className="font-heading font-bold text-sm md:text-[16px] text-cocoa dark:text-dark-white mb-1">
                  Get a suggestion
                </p>
                <p className="text-sm text-cocoa-faded leading-relaxed">
                  Spin for a meal that fits your goal and what's already in your
                  kitchen. Noura also tells you why the meal was picked.
                </p>
              </div>
            </div>

            {/* Card 3 — Log it in seconds, black circle */}
            <div className="bg-surface dark:bg-black-surface rounded-2xl p-6 flex gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-cocoa dark:bg-dark-bg flex items-center justify-center shrink-0">
                <img
                  src="/images/log.png"
                  alt="log"
                  width={30}
                  height={30}
                  className="object-contain"
                />
              </div>
              <div>
                <p className="font-heading font-bold text-sm md:text-[16px] text-cocoa dark:text-dark-white mb-1">
                  Log it in seconds
                </p>
                <p className="text-sm text-cocoa-faded leading-relaxed">
                  From the catalogue, your own custom entry, or a quick photo
                  Noura reads for you. No nutrition database memorized required.
                </p>
              </div>
            </div>

            {/* Card 4 — Watch your streak grow, yellow circle */}
            <div className="bg-surface dark:bg-black-surface rounded-2xl p-6 flex gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-[#FEF3C7] flex items-center justify-center shrink-0">
                <span className="text-2xl">
                  <img
                    src="/images/fire.png"
                    alt="fire"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </span>
              </div>
              <div>
                <p className="font-heading font-bold text-sm md:text-[16px] text-cocoa dark:text-dark-white mb-1">
                  Watch your streak grow
                </p>
                <p className="text-sm text-cocoa-faded leading-relaxed">
                  Every day you hit your goal counts. Consistency, not
                  perfection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CTA ═════════════════════════════════════════════════
          Section bg: surface (light) / black-surface (dark)
          "suggestion" in heading: pawpaw (light) / black-pawpaw (dark)
          Body text: faded
          Button: pawpaw filled (light) / black-pawpaw filled (dark)
      ══════════════════════════════════════════════════════════ */}
      <section className="bg-surface dark:bg-black-surface py-20 px-6 text-center">
        <ScrollReveal>
          <h2 className="font-heading text-1xl md:text-3xl font-bold text-cocoa dark:text-dark-white mb-3">
            Your first{" "}
            <span className="text-pawpaw dark:text-black-pawpaw">
              suggestion
            </span>{" "}
            is one spin away
          </h2>
          <p className="text-sm text-cocoa-faded mb-8">
            Set up your profile in under two minutes.
            <br />
            Flax handles the rest.
          </p>
          <button
            onClick={() => navigate("/register")}
            className="
            inline-flex items-center gap-3 px-8 py-4 rounded-xl
            bg-pawpaw dark:bg-black-pawpaw
            text-surface font-semibold text-sm
            hover:opacity-90 transition-opacity
          "
          >
            Get Started
            <ArrowRight size={18} />
          </button>
        </ScrollReveal>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════
          Plain body background — no fill
          Back to top underlined with arrow icon
      ══════════════════════════════════════════════════════════ */}
      <footer className="py-10 px-6 text-center">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="text-sm text-cocoa dark:text-dark-white underline underline-offset-2 hover:opacity-70 transition-opacity mb-6 inline-flex items-center gap-1"
        >
          Back to top ↗
        </button>
        <p className="text-sm text-cocoa-faded">
          Copyright © {new Date().getFullYear()} Tech FBI
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
