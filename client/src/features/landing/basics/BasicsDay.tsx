"use client";

import { useEffect, useId, useRef } from "react";
import { area, curveMonotoneX, line } from "d3-shape";
import { montserrat } from "../hero/fonts";
import "./basics.css";

/*
  "Why the basics matter", told as one ordinary day.

  The chart runs 6 am to 8 pm. Both lines are a share of today's target:
  food climbs to the calorie goal while water barely leaves the floor,
  which is the whole argument of the section in one picture. The three
  points on the left arrive as the day reaches them.

  Desktop pins the section (see basics.css) and the scroll position draws
  the day. Phones, small windows and reduced motion do not pin: the day
  plays by itself once it is on screen, or shows finished.

  Performance: one animation frame loop, only while the section is on
  screen, writing straight to the DOM. React renders this once.

  The text is in the HTML in its final state, the script only hides what
  the day has not reached yet, so crawlers read everything.
*/

/* ── the day ─────────────────────────────────────────────────── */

const GOAL_KCAL = 2000;
const WATER_TARGET_L = 2.5;

const MEALS = [
  { h: 7.5, name: "Akara & pap", kcal: 412 },
  { h: 11, name: "Chin chin", kcal: 260 },
  { h: 13.5, name: "Jollof & chicken", kcal: 578 },
  { h: 16, name: "Waakye", kcal: 210 },
  { h: 19, name: "Amala & ewedu", kcal: 540 },
];
const DRINKS = [
  { h: 8, ml: 250 },
  { h: 14, ml: 500 },
  { h: 18, ml: 250 },
];

const cumulative = <T,>(
  items: T[],
  hour: (t: T) => number,
  amount: (t: T) => number,
) => {
  let total = 0;
  return [
    [6, 0],
    ...items.map((t) => [hour(t), (total += amount(t))]),
    [20, total],
  ] as [number, number][];
};
const FOOD_POINTS = cumulative(
  MEALS,
  (m) => m.h,
  (m) => m.kcal / GOAL_KCAL,
);
const WATER_POINTS = cumulative(
  DRINKS,
  (d) => d.h,
  (d) => d.ml / 1000 / WATER_TARGET_L,
);

/* ── chart geometry, in the SVG's own units ──────────────────── */

const W = 720;
const H = 470;
const X0 = 56;
const X1 = 704;
const Y0 = 420; // 0%
const YT = 96; // 100% of target
const xOf = (h: number) => X0 + ((h - 6) / 14) * (X1 - X0);
const yOf = (share: number) => Y0 - share * (Y0 - YT);
const shareOf = (y: number) => (Y0 - y) / (Y0 - YT);

const toXY = (pts: [number, number][]) =>
  pts.map(([h, s]) => [xOf(h), yOf(s)] as [number, number]);
const FOOD_D = line().curve(curveMonotoneX)(toXY(FOOD_POINTS)) ?? "";
const FOOD_AREA = area().curve(curveMonotoneX).y0(Y0)(toXY(FOOD_POINTS)) ?? "";
const WATER_D = line().curve(curveMonotoneX)(toXY(WATER_POINTS)) ?? "";

const TICKS = [6, 9, 12, 15, 18];
const hourLabel = (h: number) => {
  const whole = Math.floor(h);
  const mins = Math.floor(((h - whole) * 60) / 15) * 15;
  const h12 = ((whole + 11) % 12) + 1;
  return `${h12}${mins ? `:${String(mins).padStart(2, "0")}` : ""} ${whole < 12 ? "am" : "pm"}`;
};

/* ── the story ───────────────────────────────────────────────── */

// `at` is the hour of the day at which each point arrives.
const STEPS = [
  {
    at: 6.3,
    title: "What you eat adds up faster than you think",
    body: "A meal here, a snack there, it's easy to lose track. Log from a regional catalogue, describe something custom - a Nigerian, Ghanaian or any African dish, or snap your plate and Noura will identify it and estimate it for you, whichever way you actually eat.",
  },
  {
    at: 13.2,
    title: "Hydration is the part everyone forgets",
    body: "Water affects energy, appetite, and how your body actually uses what you eat. Flax calculates a target built for your body, so you're working toward a real number, not a guess.",
  },
  {
    at: 19.3,
    title: "Consistency is what actually changes things",
    body: "One good day does not move much, a run of them does. Flax keeps a streak for your calorie goal and one for water, so you can see the run you are on and want to keep it going.",
  },
];
// Big faded numerals on the chart, where each point happens.
const NUMERALS = [
  { x: 168, y: 250 },
  { x: 470, y: 300 },
  { x: 640, y: 236 },
];
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const STREAK_BEFORE = 5;

// Scroll progress p (0 to 1): the day plays over the first 80%, then the
// week fills in.
const DAY_END = 0.8;
const WEEK_FROM = 0.82;
const WEEK_TO = 0.97;
const PIN_QUERY =
  "(min-width: 1024px) and (min-height: 640px) and (min-aspect-ratio: 1/1) and (prefers-reduced-motion: no-preference)";

// "1,460". toLocaleString is slow enough to show up when run every frame.
const thousands = (n: number) =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// x to y along a drawn path, sampled once.
const sampler = (path: SVGPathElement) => {
  const total = path.getTotalLength();
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= 400; i++) {
    const pt = path.getPointAtLength((i / 400) * total);
    xs.push(pt.x);
    ys.push(pt.y);
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    let lo = 0;
    let hi = xs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < x) lo = mid;
      else hi = mid;
    }
    const t = (x - xs[lo]) / (xs[hi] - xs[lo] || 1);
    return ys[lo] + (ys[hi] - ys[lo]) * t;
  };
};

/* ── component ───────────────────────────────────────────────── */

export const BasicsDay = () => {
  const clipId = useId().replace(/:/g, "");
  const root = useRef<HTMLElement>(null);
  const els = useRef<{
    clip?: SVGRectElement | null;
    food?: SVGPathElement | null;
    water?: SVGPathElement | null;
    foodHead?: SVGGElement | null;
    waterHead?: SVGGElement | null;
    cursor?: SVGLineElement | null;
    time?: HTMLSpanElement | null;
    kcal?: HTMLSpanElement | null;
    litres?: HTMLSpanElement | null;
    streak?: HTMLSpanElement | null;
  }>({});
  const listRefs = useRef<{
    steps: (HTMLLIElement | null)[];
    labels: (HTMLDivElement | null)[];
    drops: (HTMLDivElement | null)[];
    numerals: (HTMLSpanElement | null)[];
    days: (HTMLSpanElement | null)[];
  }>({
    steps: [],
    labels: [],
    drops: [],
    numerals: [],
    days: [],
  });

  useEffect(() => {
    const section = root.current;
    const e = els.current;
    const lists = listRefs.current;
    if (!section || !e.food || !e.water) return;

    const foodY = sampler(e.food);
    const waterY = sampler(e.water);
    const last: Record<string, string> = {};
    // Writes only what changed.
    const set = (key: string, value: string, write: () => void) => {
      if (last[key] === value) return;
      last[key] = value;
      write();
    };
    const setAttr = (
      el: Element | null | undefined,
      key: string,
      name: string,
      value: string,
    ) => el && set(key, value, () => el.setAttribute(name, value));
    const setText = (
      el: Element | null | undefined,
      key: string,
      value: string,
    ) => el && set(key, value, () => (el.textContent = value));

    const render = (p: number) => {
      const day = clamp01(p / DAY_END);
      const hour = 6 + 14 * day;
      const x = xOf(hour);
      const fy = foodY(x);
      const wy = waterY(x);

      setAttr(e.clip, "clip", "width", (x - X0 + 6).toFixed(1));
      setAttr(
        e.foodHead,
        "fh",
        "transform",
        `translate(${x.toFixed(1)} ${fy.toFixed(1)})`,
      );
      setAttr(
        e.waterHead,
        "wh",
        "transform",
        `translate(${x.toFixed(1)} ${wy.toFixed(1)})`,
      );
      setAttr(e.foodHead, "fho", "opacity", day > 0 ? "1" : "0");
      setAttr(e.waterHead, "who", "opacity", day > 0 ? "1" : "0");
      setAttr(e.cursor, "cur", "transform", `translate(${x.toFixed(1)} 0)`);

      setText(e.time, "time", hourLabel(hour));
      setText(e.kcal, "kcal", thousands(Math.round(shareOf(fy) * GOAL_KCAL)));
      setText(e.litres, "litres", (shareOf(wy) * WATER_TARGET_L).toFixed(2));

      MEALS.forEach((m, i) =>
        setAttr(lists.labels[i], `l${i}`, "data-on", String(hour >= m.h)),
      );
      DRINKS.forEach((d, i) =>
        setAttr(lists.drops[i], `d${i}`, "data-on", String(hour >= d.h)),
      );

      let active = -1;
      STEPS.forEach((s, i) => {
        if (hour >= s.at) active = i;
      });
      STEPS.forEach((_, i) => {
        const state = i > active ? "hidden" : i === active ? "active" : "done";
        setAttr(lists.steps[i], `s${i}`, "data-state", state);
        setAttr(lists.numerals[i], `n${i}`, "data-on", String(i <= active));
      });
      setAttr(section, "focus", "data-focus", active === 1 ? "water" : "all");

      const filled = Math.round(
        clamp01((p - WEEK_FROM) / (WEEK_TO - WEEK_FROM)) * WEEK.length,
      );
      WEEK.forEach((_, i) =>
        setAttr(lists.days[i], `w${i}`, "data-on", String(i < filled)),
      );
      setText(e.streak, "streak", String(STREAK_BEFORE + filled));
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pin = window.matchMedia(PIN_QUERY);
    // Google renders pages in a viewport thousands of px tall, show it
    // the finished day instead of waiting for an animation.
    const stretched = window.matchMedia("(max-aspect-ratio: 1/4)");
    let stop = () => {};

    const start = () => {
      stop();
      if (reduce.matches || stretched.matches) {
        section.dataset.anim = "off";
        section.dataset.mode = "still";
        render(1);
        stop = () => {};
        return;
      }
      section.dataset.anim = "on";
      section.dataset.mode = pin.matches ? "pin" : "play";
      let frame = 0;
      let visible = false;

      if (pin.matches) {
        // Scroll drives the day, eased so wheel steps glide.
        // Position measured on resize only, each frame just reads scrollY:
        // asking for the section's box every frame forced a page layout.
        let shown = -1;
        let top = 0;
        let span = 1;
        const measure = () => {
          top = section.getBoundingClientRect().top + window.scrollY;
          span = Math.max(1, section.offsetHeight - window.innerHeight);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(section);
        ro.observe(document.body);
        const progress = () => clamp01((window.scrollY - top) / span);
        const tick = () => {
          const target = progress();
          shown = shown < 0 ? target : shown + (target - shown) * 0.16;
          if (Math.abs(target - shown) < 0.0004) shown = target;
          render(shown);
          if (visible || shown !== target) frame = requestAnimationFrame(tick);
          else frame = 0;
        };
        const io = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !frame) frame = requestAnimationFrame(tick);
        });
        render(progress());
        io.observe(section);
        stop = () => {
          io.disconnect();
          ro.disconnect();
          cancelAnimationFrame(frame);
          frame = 0;
        };
        return;
      }

      // Not pinned: the day plays once, the first time it is on screen.
      render(0);
      const PLAY_MS = 7000;
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          io.disconnect();
          const t0 = performance.now();
          const tick = (now: number) => {
            const t = clamp01((now - t0) / PLAY_MS);
            render(t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
            if (t < 1) frame = requestAnimationFrame(tick);
          };
          frame = requestAnimationFrame(tick);
        },
        { threshold: 0.35 },
      );
      io.observe(section.querySelector(".bd-chart") ?? section);
      stop = () => {
        io.disconnect();
        cancelAnimationFrame(frame);
      };
    };

    start();
    pin.addEventListener("change", start);
    reduce.addEventListener("change", start);
    return () => {
      stop();
      pin.removeEventListener("change", start);
      reduce.removeEventListener("change", start);
    };
  }, []);

  return (
    <section
      ref={root}
      className="bd relative bg-surface dark:bg-black-surface"
    >
      <div className="bd-sticky">
        <div className="bd-inner mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 md:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <h2
              className={`${montserrat.className} text-base font-bold leading-snug text-cocoa dark:text-dark-white md:text-[20px] lg:text-3xl`}
            >
              Most nutrition advice fails because it ignores the{" "}
              <span className="text-pawpaw dark:text-black-pawpaw">habits</span>{" "}
              people struggle with every day.
            </h2>
            <p className="mt-2 text-xs font-bold text-cocoa-faded md:text-sm lg:mt-4">
              Why the basics matter
            </p>
          </div>

          <div className="mt-10 grid gap-12 lg:mt-[clamp(1.75rem,4vh,3rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-14">
            {/* the three points */}
            <ol className="order-2 flex flex-col gap-8 lg:order-1 lg:gap-[clamp(1.25rem,3vh,2.25rem)]">
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  ref={(el) => {
                    listRefs.current.steps[i] = el;
                  }}
                  data-state={i === STEPS.length - 1 ? "active" : "done"}
                  className="bd-step grid grid-cols-[2rem_1fr] gap-x-3"
                >
                  <span
                    className={`bd-num ${montserrat.className} text-xl font-extrabold leading-7 text-cocoa/25 dark:text-dark-white/25`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3
                      className={`${montserrat.className} text-lg font-bold leading-7 text-cocoa dark:text-dark-white`}
                    >
                      {s.title}
                    </h3>
                    <div className="bd-body">
                      <div className="min-h-0 overflow-hidden">
                        <p className="mt-1.5 text-[15px] leading-relaxed text-cocoa/65 dark:text-dark-white/60 lg:text-[clamp(0.85rem,1.75vh,0.95rem)]">
                          {s.body}
                        </p>
                        {i === 2 && (
                          <div
                            className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2"
                            aria-hidden
                          >
                            <div className="flex gap-1.5">
                              {WEEK.map((d, j) => (
                                <span
                                  key={j}
                                  ref={(el) => {
                                    listRefs.current.days[j] = el;
                                  }}
                                  data-on="true"
                                  className="bd-day relative flex h-7 w-7 items-center justify-center rounded-lg border border-cocoa/15 text-[10px] font-semibold text-cocoa/40 dark:border-white/15 dark:text-dark-white/40"
                                >
                                  <span className="absolute -top-4 text-[10px] font-medium text-cocoa/40 dark:text-dark-white/40">
                                    {d}
                                  </span>
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 12 12"
                                    className="text-white dark:text-cocoa"
                                  >
                                    <path
                                      d="M2.5 6.2l2.3 2.3 4.7-5"
                                      stroke="currentColor"
                                      strokeWidth="1.8"
                                      fill="none"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </span>
                              ))}
                            </div>
                            <p className="whitespace-nowrap text-sm text-cocoa/60 dark:text-dark-white/60">
                              <span
                                ref={(el) => {
                                  els.current.streak = el;
                                }}
                                className="font-bold tabular-nums text-cocoa dark:text-dark-white"
                              >
                                {STREAK_BEFORE + WEEK.length}
                              </span>{" "}
                              day goal streak
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {/* the day */}
            <div
              aria-hidden
              className="bd-chart order-1 w-full justify-self-end lg:order-2"
            >
              <div className="mb-4 flex items-end justify-between gap-3 whitespace-nowrap">
                <div className="flex gap-5 sm:gap-10">
                  <div>
                    <p className="flex items-center gap-2 text-xs text-cocoa/55 dark:text-dark-white/55">
                      <span className="h-[3px] w-4 rounded-full bg-pawpaw dark:bg-black-pawpaw" />
                      Food
                    </p>
                    <p
                      className={`${montserrat.className} mt-1 text-lg font-extrabold text-cocoa dark:text-dark-white sm:text-xl`}
                    >
                      <span
                        ref={(el) => {
                          els.current.kcal = el;
                        }}
                        className="tabular-nums"
                      >
                        2,000
                      </span>{" "}
                      <span className="text-[11px] font-semibold text-cocoa/45 dark:text-dark-white/45 sm:text-xs">
                        <span className="hidden sm:inline">of 2,000 </span>kcal
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-xs text-cocoa/55 dark:text-dark-white/55">
                      <span className="h-[3px] w-4 rounded-full bg-sky-500" />
                      Water
                    </p>
                    <p
                      className={`${montserrat.className} mt-1 text-lg font-extrabold text-cocoa dark:text-dark-white sm:text-xl`}
                    >
                      <span
                        ref={(el) => {
                          els.current.litres = el;
                        }}
                        className="tabular-nums"
                      >
                        1.00
                      </span>{" "}
                      <span className="text-[11px] font-semibold text-cocoa/45 dark:text-dark-white/45 sm:text-xs">
                        <span className="hidden sm:inline">of 2.5 </span>L
                      </span>
                    </p>
                  </div>
                </div>
                <p className="text-right text-xs text-cocoa/50 dark:text-dark-white/50">
                  <span className="hidden sm:inline">An ordinary Tuesday</span>
                  <span className="sm:hidden">Tuesday</span>
                  <span
                    ref={(el) => {
                      els.current.time = el;
                    }}
                    className={`${montserrat.className} mt-1 block text-lg font-extrabold tabular-nums text-cocoa dark:text-dark-white sm:text-xl`}
                  >
                    8 pm
                  </span>
                </p>
              </div>

              <div
                className="relative"
                style={{ aspectRatio: `${W} / ${H}`, contain: "layout" }}
              >
                {/* faded numerals where each point happens */}
                {NUMERALS.map((n, i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      listRefs.current.numerals[i] = el;
                    }}
                    data-on="true"
                    className={`bd-numeral ${montserrat.className} pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none text-[clamp(3.5rem,9vw,7.5rem)] font-extrabold leading-none text-cocoa/[0.05] dark:text-white/[0.05]`}
                    style={{
                      left: `${(n.x / W) * 100}%`,
                      top: `${(n.y / H) * 100}%`,
                    }}
                  >
                    {i + 1}
                  </span>
                ))}

                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="absolute inset-0 h-full w-full overflow-visible"
                >
                  <defs>
                    <clipPath id={clipId}>
                      <rect
                        ref={(el) => {
                          els.current.clip = el;
                        }}
                        x={X0 - 6}
                        y={0}
                        width={X1 - X0 + 12}
                        height={H}
                      />
                    </clipPath>
                  </defs>

                  {/* time cursor, follows the end of the lines */}
                  <line
                    ref={(el) => {
                      els.current.cursor = el;
                    }}
                    x1={0}
                    x2={0}
                    y1={YT}
                    y2={Y0}
                    transform={`translate(${X1} 0)`}
                    className="stroke-cocoa/10 dark:stroke-white/10"
                  />

                  {/* grid */}
                  <line
                    x1={X0}
                    x2={X1}
                    y1={Y0}
                    y2={Y0}
                    className="stroke-cocoa/15 dark:stroke-white/15"
                  />
                  <line
                    x1={X0}
                    x2={X1}
                    y1={yOf(0.5)}
                    y2={yOf(0.5)}
                    strokeDasharray="2 6"
                    className="stroke-cocoa/15 dark:stroke-white/15"
                  />
                  <line
                    x1={X0}
                    x2={X1}
                    y1={YT}
                    y2={YT}
                    strokeDasharray="6 6"
                    className="stroke-cocoa/30 dark:stroke-white/30"
                  />
                  <text
                    x={X0}
                    y={YT - 10}
                    className="fill-cocoa/55 text-[22px] font-semibold dark:fill-white/55 sm:text-[15px] lg:text-[13px]"
                  >
                    Your target for today
                  </text>
                  <text
                    x={X0 - 10}
                    y={yOf(0.5) + 4}
                    textAnchor="end"
                    className="fill-cocoa/35 text-[20px] dark:fill-white/35 sm:text-[14px] lg:text-[12px]"
                  >
                    50%
                  </text>
                  <text
                    x={X0 - 10}
                    y={YT + 4}
                    textAnchor="end"
                    className="fill-cocoa/35 text-[20px] dark:fill-white/35 sm:text-[14px] lg:text-[12px]"
                  >
                    100%
                  </text>
                  {TICKS.map((h) => (
                    <text
                      key={h}
                      x={xOf(h)}
                      y={Y0 + 34}
                      textAnchor="middle"
                      className="fill-cocoa/45 text-[22px] dark:fill-white/45 sm:text-[15px] lg:text-[13px]"
                    >
                      {hourLabel(h)}
                    </text>
                  ))}

                  <g clipPath={`url(#${clipId})`}>
                    <path
                      d={FOOD_AREA}
                      className="bd-line bd-food fill-pawpaw/[0.07] dark:fill-black-pawpaw/[0.08]"
                    />
                    <path
                      ref={(el) => {
                        els.current.food = el;
                      }}
                      d={FOOD_D}
                      fill="none"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      className="bd-line bd-food stroke-pawpaw dark:stroke-black-pawpaw"
                    />
                    <path
                      ref={(el) => {
                        els.current.water = el;
                      }}
                      d={WATER_D}
                      fill="none"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      className="bd-line stroke-sky-500"
                    />
                    {MEALS.map((m) => (
                      <circle
                        key={m.name}
                        cx={xOf(m.h)}
                        cy={yOf(FOOD_POINTS.find((p) => p[0] === m.h)![1])}
                        r={5}
                        className="bd-line bd-food fill-surface stroke-pawpaw dark:fill-black-surface dark:stroke-black-pawpaw"
                        strokeWidth={2.5}
                      />
                    ))}
                  </g>

                  {/* the moving heads */}
                  <g
                    ref={(el) => {
                      els.current.foodHead = el;
                    }}
                    transform={`translate(${X1} ${YT})`}
                    className="bd-line bd-food"
                  >
                    <circle
                      r={10}
                      className="fill-pawpaw/15 dark:fill-black-pawpaw/20"
                    />
                    <circle
                      r={5.5}
                      className="fill-pawpaw dark:fill-black-pawpaw"
                    />
                  </g>
                  <g
                    ref={(el) => {
                      els.current.waterHead = el;
                    }}
                    transform={`translate(${X1} ${yOf(0.4)})`}
                  >
                    <circle r={10} className="fill-sky-500/15" />
                    <circle r={5.5} className="fill-sky-500" />
                  </g>
                </svg>

                {/* meal names, above and left of each point */}
                {MEALS.map((m, i) => (
                  <div
                    key={m.name}
                    ref={(el) => {
                      listRefs.current.labels[i] = el;
                    }}
                    data-on="true"
                    className="bd-fade bd-line bd-food absolute whitespace-nowrap text-right"
                    style={{
                      right: `${100 - ((xOf(m.h) - 10) / W) * 100}%`,
                      bottom: `${100 - ((yOf(FOOD_POINTS.find((p) => p[0] === m.h)![1]) - 8) / H) * 100}%`,
                    }}
                  >
                    <p className="text-[11px] font-semibold text-cocoa dark:text-dark-white sm:text-xs">
                      {m.name}
                    </p>
                    <p className="text-[10px] tabular-nums text-cocoa/50 dark:text-dark-white/50 sm:text-[11px]">
                      +{m.kcal} kcal
                    </p>
                  </div>
                ))}
                {/* water, below each point */}
                {DRINKS.map((d, i) => (
                  <div
                    key={d.h}
                    ref={(el) => {
                      listRefs.current.drops[i] = el;
                    }}
                    data-on="true"
                    className="bd-fade absolute hidden -translate-x-1/2 whitespace-nowrap pb-2 sm:block text-[10px] font-semibold tabular-nums text-sky-600 dark:text-sky-400 sm:text-[11px]"
                    style={{
                      left: `${(xOf(d.h) / W) * 100}%`,
                      bottom: `${100 - (yOf(WATER_POINTS.find((p) => p[0] === d.h)![1]) / H) * 100}%`,
                    }}
                  >
                    +{d.ml} ml
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
