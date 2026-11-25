"use client";

import { Check, Droplets, Flame, LayoutGrid, ScanLine, Send, Sparkles } from "lucide-react";
import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/*
  A self running "Flax app" window for the landing hero.

  One loop (about 20s) walks through the core flow: scan a plate, log it,
  ask Noura about it, log water. A cursor moves and clicks between steps.

  How it stays smooth: all movement is CSS on transform and opacity, which
  the browser's compositor runs without JavaScript. React only re-renders
  when the timeline crosses one of the moments in T, and the few things CSS
  cannot do (counting numbers, typing) write to their text node directly.

  The window is designed at a fixed size and scaled to its container:
  panel 800x560 (sidebar + scene + Today), compact 400x640 for phones. It
  pauses off screen and in hidden tabs, and shows one still frame under
  reduced motion.

  Numbers are consistent: jollof rice 1 cup (185 g) = 278 kcal from the Flax
  catalogue, the plate totals 578 kcal, the day goes 556 -> 1,134 of 2,000.
  The chicken and plantain values are illustrative estimates.
*/

const LOOP_MS = 19800;

// Timeline, ms from loop start. Retime the whole demo here. The cursor takes
// 680ms to travel, keep at least that between a "to" moment and its click.
const T = {
  toShutter: 500,
  capture: 1400,
  beam: 1550,
  box1: 2500,
  box2: 2800,
  box3: 3100,
  sheet: 3900,
  toLog: 5400,
  logClick: 6200,
  toNoura: 7900,
  toastOff: 8000,
  nouraClick: 8700,
  typeStart: 9100,
  typeEnd: 10500,
  send: 10900,
  thinking: 11200,
  reply: 12100,
  toWater: 14900,
  waterClick: 15700,
  toPlus: 16000,
  plus1: 16800,
  plus2: 17600,
  waterToastOff: 18900,
  fadeOut: 19250,
} as const;

const CLICK_MS = 220;
const RIPPLE_MS = 550;
const SCENE_FADE_MS = 550;
const CLICKS = [T.capture, T.logClick, T.nouraClick, T.send, T.waterClick, T.plus1, T.plus2];
const STATIC_FRAME_MS = T.logClick + 900; // shown under prefers-reduced-motion

// Every moment at which something changes, the only times React renders.
const MOMENTS = [
  ...new Set([0, ...Object.values(T), ...CLICKS.flatMap((c) => [c + CLICK_MS, c + RIPPLE_MS]), T.logClick + 150, T.plus1 + 150, T.nouraClick + SCENE_FADE_MS, T.waterClick + SCENE_FADE_MS]),
].sort((a, b) => a - b);
const momentAt = (ms: number) => {
  let m = 0;
  for (const x of MOMENTS) {
    if (x > ms) break;
    m = x;
  }
  return m;
};

const CDN = "https://res.cloudinary.com/boz7ngxm/image/upload";
const PLATE = "v1783865778/foods/jollof-rice.png";
export const PLATE_IMG = `${CDN}/f_auto,q_auto,c_fill,w_760,h_700/${PLATE}`;
// Pre-blurred and tiny, a live CSS blur is expensive to paint on phones.
const PLATE_BACKDROP = `${CDN}/f_auto,q_auto,c_fill,w_96,h_120,e_blur:900/${PLATE}`;

const ITEMS = [
  { name: "Fried chicken", labelRight: true, portion: "1 drumstick", kcal: 230, at: T.box1, color: "#E8623C", box: { l: 25, t: 9, w: 52, h: 49 } },
  { name: "Fried plantain", labelRight: true, portion: "1 slice", kcal: 70, at: T.box2, color: "#EAB308", box: { l: 65, t: 19, w: 33, h: 30 } },
  { name: "Jollof rice", labelRight: false, portion: "1 cup · 185 g", kcal: 278, at: T.box3, color: "#7FB096", box: { l: 4, t: 50, w: 58, h: 42 } },
];
const PLATE_KCAL = 578;
const DAY_BEFORE = 556;
const DAY_TARGET = 2000;

const QUESTION = "Is this plate okay for my weight loss goal?";
const REPLY =
  "Yes, it fits. That plate is about 578 kcal with roughly 32 g of protein, and you still have around 870 kcal left today. A light dinner like pepper soup keeps you right on target.";
const SUGGESTIONS = ["Ideas for a light dinner", "How much protein today?", "Water left today?"];

type Layout = "panel" | "compact";
const DIMS: Record<Layout, { w: number; h: number; main: { x: number; y: number; w: number; h: number } }> = {
  panel: { w: 800, h: 560, main: { x: 60, y: 40, w: 484, h: 520 } },
  compact: { w: 400, h: 640, main: { x: 0, y: 104, w: 400, h: 476 } },
};

/*
  Detection boxes are in % of the 760x700 photo.
  compact: the whole photo is shown (368px wide, 339 of 444px tall).
  panel: the 452x488 viewfinder covers with the photo (530px wide), anchored
  right because the plantain is there, so ~78px is cut from the left.
*/
type Box = { l: number; t: number; w: number; h: number };
const boxFor = (box: Box, layout: Layout): Box => {
  if (layout === "compact") return { ...box, t: 11.8 + box.t * 0.7635, h: box.h * 0.7635 };
  const scale = 530 / 452;
  const cut = (78 / 452) * 100;
  const l = Math.max(2, box.l * scale - cut);
  return { ...box, l, w: Math.min(98, (box.l + box.w) * scale - cut) - l };
};

type Scene = "scan" | "chat" | "water";
const sceneAt = (ms: number): Scene => (ms < T.nouraClick ? "scan" : ms < T.waterClick ? "chat" : "water");
const pressed = (ms: number, at: number) => ms >= at && ms < at + CLICK_MS;

/* ── clock ───────────────────────────────────────────────────────────── */

const useTimeline = (running: boolean, frozenAt: number | null) => {
  const [state, setState] = useState({ ms: 0, loop: 0 });
  const elapsed = useRef(0);

  useEffect(() => {
    if (frozenAt !== null || !running) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Cap the step so a stalled frame never skips part of the story.
      elapsed.current += Math.min(now - last, 100);
      last = now;
      const loop = Math.floor(elapsed.current / LOOP_MS);
      const ms = momentAt(elapsed.current % LOOP_MS);
      setState((s) => (s.ms === ms && s.loop === loop ? s : { ms, loop }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, frozenAt]);

  return frozenAt !== null ? { ms: frozenAt, loop: 0 } : state;
};

/* ── animation pieces: CSS only, so the compositor runs them ─────────── */

const SOFT = "cubic-bezier(0.22, 1, 0.36, 1)";

const KEYFRAMES = `
@keyframes fxd-fade { from { opacity: 0 } }
@keyframes fxd-rise { from { opacity: 0; transform: translate3d(0, 10px, 0) } }
@keyframes fxd-slide { from { opacity: 0; transform: translate3d(14px, 0, 0) } }
@keyframes fxd-pop { from { opacity: 0; transform: scale(1.06) } }
@keyframes fxd-bump { from { transform: scale(1.14) } }
@keyframes fxd-sheet { from { transform: translate3d(0, 112%, 0) } }
@keyframes fxd-flash { from { opacity: 0.75 } to { opacity: 0 } }
@keyframes fxd-beam { from { transform: translate3d(0, -101%, 0) } to { transform: translate3d(0, 101%, 0) } }
@keyframes fxd-ripple { from { opacity: 0.8; transform: scale(0.3) } to { opacity: 0; transform: scale(1.6) } }
@keyframes fxd-wave { to { transform: translate3d(-50%, 0, 0) } }
@keyframes fxd-dot { 0%, 100% { transform: none } 50% { transform: translate3d(0, -4px, 0) } }
`;

type EnterKind = "fade" | "rise" | "slide" | "pop" | "bump" | "sheet" | "flash" | "beam" | "ripple";
// Entrances end on the element's own style, so they hold nothing afterwards:
// the browser drops the layer and text is drawn sharp again. Only the three
// that end invisible keep their last frame.
const HOLD: EnterKind[] = ["flash", "beam", "ripple"];
const enter = (kind: EnterKind, ms: number, delay = 0, ease: string = SOFT) => ({
  animation: `fxd-${kind} ${ms}ms ${ease} ${delay}ms ${HOLD.includes(kind) ? "both" : "backwards"}`,
});
const move = (ms = 600) => `transform ${ms}ms ${SOFT}, opacity ${ms}ms ${SOFT}`;

// Press feedback for buttons the cursor clicks.
const Press = ({ on, to = 0.92, className, style, children }: { on: boolean; to?: number; className?: string; style?: CSSProperties; children?: ReactNode }) => (
  <span className={className} style={{ ...style, transform: on ? `scale(${to})` : "none", transition: "transform 180ms ease-out, background-color 250ms, color 250ms" }}>
    {children}
  </span>
);

// Writes straight to the text node each frame, React is not involved.
const Count = ({ value, from, decimals = 0, ms = 1000 }: { value: number; from?: number; decimals?: number; ms?: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(from ?? value);
  const [initial] = useState(from ?? value);
  const format = (v: number) => (decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString("en-US"));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = shown.current;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const t0 = performance.now();
    let written = 0;
    const step = (now: number) => {
      // 25 updates a second reads as continuous for digits.
      if (now - written < 40 && now - t0 < ms) {
        frame = requestAnimationFrame(step);
        return;
      }
      written = now;
      const p = instant ? 1 : Math.min(1, Math.max(0, (now - t0) / ms));
      shown.current = start + (value - start) * (1 - Math.pow(1 - p, 3));
      const next = decimals ? shown.current.toFixed(decimals) : Math.round(shown.current).toLocaleString("en-US");
      if (el.textContent !== next) el.textContent = next;
      if (p < 1) frame = requestAnimationFrame(step);
    };
    if (start !== value) frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, decimals, ms]);
  return (
    <span ref={ref} className="tabular-nums">
      {format(initial)}
    </span>
  );
};

const Bar = ({ value, className }: { value: number; className: string }) => (
  <div className="h-1.5 overflow-hidden rounded-full bg-cocoa/10 dark:bg-white/10">
    <div className={`h-full origin-left rounded-full ${className}`} style={{ transform: `scaleX(${value})`, transition: move(1000) }} />
  </div>
);

const Ring = ({ value, size, stroke }: { value: number; size: number; stroke: number }) => {
  const r = (size - stroke) / 2;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-cocoa/10 dark:stroke-white/10" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#E8623C"
        strokeWidth={stroke}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - value}
        style={{ transition: `stroke-dashoffset 1000ms ${SOFT}` }}
      />
    </svg>
  );
};

const Typed = ({ text, ms }: { text: string; ms: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const n = Math.min(text.length, Math.max(0, Math.round(((now - t0) / ms) * text.length)));
      const next = text.slice(0, n);
      if (el.textContent !== next) el.textContent = next;
      if (n < text.length) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, ms]);
  return (
    <>
      <span ref={ref} />
      <span className="ml-0.5 inline-block h-3 w-px bg-cocoa align-middle dark:bg-dark-white" />
    </>
  );
};

// The bubble has its final size from the start and words fade in over it,
// so a streaming reply never pushes or re-wraps anything.
const Streamed = ({ text, ms }: { text: string; ms: number }) => {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <span key={i} style={enter("fade", 350, Math.round((i / words.length) * ms), "ease-out")}>
          {word}{" "}
        </span>
      ))}
    </>
  );
};

/* ── cursor ──────────────────────────────────────────────────────────── */

const navPoint = (layout: Layout, index: number) =>
  layout === "compact" ? { x: 50 + index * 100, y: 610 } : { x: 30, y: 124 + index * 48 };

const cursorTarget = (ms: number, layout: Layout) => {
  const m = DIMS[layout].main;
  if (ms < T.toShutter) return layout === "compact" ? { x: 320, y: 430 } : { x: 680, y: 500 };
  if (ms < T.sheet) return { x: m.x + m.w / 2, y: m.y + m.h - 64 }; // shutter
  if (ms < T.toLog) return { x: m.x + m.w - 150, y: m.y + m.h - 150 }; // reading the results
  if (ms < T.toNoura) return { x: m.x + m.w - 80, y: m.y + m.h - 60 }; // Log meal
  if (ms < T.typeStart) return navPoint(layout, 2); // Noura
  if (ms < T.toWater) return { x: m.x + m.w - 38, y: m.y + m.h - 38 }; // send
  if (ms < T.toPlus) return navPoint(layout, 3); // Water
  return { x: m.x + m.w / 2 - 46, y: m.y + m.h - 42 }; // +250 ml
};

const Cursor = ({ ms, layout }: { ms: number; layout: Layout }) => {
  const p = cursorTarget(ms, layout);
  const click = CLICKS.find((c) => ms >= c && ms < c + RIPPLE_MS);
  return (
    <div
      key={layout}
      className="pointer-events-none absolute left-0 top-0 z-50 will-change-transform"
      style={{ transform: `translate3d(${p.x}px, ${p.y}px, 0)`, transition: "transform 680ms cubic-bezier(0.4, 0.05, 0.15, 1)" }}
    >
      {click !== undefined && (
        <span key={click} className="absolute -left-4 -top-4 h-8 w-8 rounded-full border-2 border-pawpaw" style={enter("ripple", RIPPLE_MS, 0, "ease-out")} />
      )}
      <Press on={CLICKS.some((c) => pressed(ms, c))} to={0.84} className="block origin-top-left">
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M4 2l15 9.5-6.6 1.4 3.9 7.3-2.6 1.4-3.9-7.3L4 19z" fill="#1C1A17" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </Press>
    </div>
  );
};

/* ── scenes ──────────────────────────────────────────────────────────── */

const Corner = ({ className }: { className: string }) => <span className={`absolute h-7 w-7 border-white/90 ${className}`} />;

const ScanScene = ({ ms, layout }: { ms: number; layout: Layout }) => {
  const compact = layout === "compact";
  const captured = ms >= T.capture;
  const sheetOpen = ms >= T.sheet;
  const logged = ms >= T.logClick;
  const found = ITEMS.filter((i) => ms >= i.at).length;
  const status = !captured ? "Auto capture · hold steady" : found < ITEMS.length ? "Analysing plate…" : `${ITEMS.length} items found`;

  return (
    <div className="absolute inset-0 p-4">
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#3a2a20]">
        {compact && <img src={PLATE_BACKDROP} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover opacity-70" />}
        <img
          src={PLATE_IMG}
          alt=""
          draggable={false}
          className={`absolute inset-0 h-full w-full select-none ${compact ? "object-contain" : "object-cover object-right"}`}
          style={{ transform: captured ? "scale(1)" : "scale(1.06)", transition: move(900) }}
        />

        {/* viewfinder */}
        <div className="absolute inset-5" style={{ opacity: captured ? 0 : 1, transform: captured ? "scale(1.04)" : "none", transition: move(400) }}>
          <Corner className="left-0 top-0 rounded-tl-xl border-l-[3px] border-t-[3px]" />
          <Corner className="right-0 top-0 rounded-tr-xl border-r-[3px] border-t-[3px]" />
          <Corner className="bottom-0 left-0 rounded-bl-xl border-b-[3px] border-l-[3px]" />
          <Corner className="bottom-0 right-0 rounded-br-xl border-b-[3px] border-r-[3px]" />
        </div>

        {/* status pill */}
        <div className="absolute left-4 top-4 z-10" style={{ opacity: sheetOpen ? 0 : 1, transition: move(300) }}>
          <div className="flex items-center gap-2 whitespace-nowrap rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-semibold text-white">
            <span className={`h-1.5 w-1.5 rounded-full ${found === ITEMS.length ? "bg-moringa-faded" : "bg-pawpaw"}`} />
            {status}
          </div>
        </div>

        {/* flash */}
        {captured && ms < T.sheet && <div className="absolute inset-0 bg-white" style={enter("flash", 450, 0, "ease-out")} />}

        {/* scan beam, one layer sliding down */}
        {ms >= T.beam && !sheetOpen && (
          <div
            className="absolute inset-0 border-b-[3px] border-moringa-faded bg-gradient-to-b from-moringa-faded/0 to-moringa-faded/35"
            style={enter("beam", 1700, 0, "cubic-bezier(0.45, 0, 0.55, 1)")}
          />
        )}

        {/* detections */}
        {ITEMS.map((item) => {
          if (ms < item.at) return null;
          const box = boxFor(item.box, layout);
          return (
            <div
              key={item.name}
              className="absolute"
              style={{ left: `${box.l}%`, top: `${box.t}%`, width: `${box.w}%`, height: `${box.h}%`, opacity: sheetOpen ? 0.5 : 1, transition: move(400) }}
            >
              <div
                className="h-full w-full rounded-xl border-2"
                style={{ borderColor: item.color, boxShadow: `0 0 0 4px ${item.color}26`, ...enter("pop", 600) }}
              >
                <span
                  className={`absolute -top-3 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${item.labelRight ? "right-2" : "left-2"}`}
                  style={{ background: item.color }}
                >
                  {item.name} · {item.kcal} kcal
                </span>
              </div>
            </div>
          );
        })}

        {/* shutter */}
        <div
          className="absolute bottom-5 left-1/2 -ml-7 flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white/90"
          style={{ opacity: sheetOpen ? 0 : 1, transform: sheetOpen ? "scale(0.85)" : "none", transition: move(300) }}
        >
          <Press on={pressed(ms, T.capture)} to={0.76} className="block h-10 w-10 rounded-full bg-pawpaw" />
        </div>

        {/* results sheet */}
        {sheetOpen && (
          <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white p-4 shadow-lg dark:bg-[#171c19]" style={enter("sheet", 750)}>
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-moringa dark:text-moringa-faded">Lunch · AI estimate</p>
                <p className="text-sm font-bold text-cocoa dark:text-dark-white">Jollof rice plate</p>
              </div>
              <p className="text-xl font-extrabold text-cocoa dark:text-dark-white">
                <Count from={0} value={PLATE_KCAL} ms={1100} />
                <span className="ml-1 text-[11px] font-semibold text-cocoa/50 dark:text-dark-white/50">kcal</span>
              </p>
            </div>
            <ul className="mt-3 space-y-1.5 text-[11px]">
              {ITEMS.map((item, i) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between rounded-lg bg-off-white/80 px-2.5 py-1.5 dark:bg-white/5"
                  style={enter("rise", 500, 200 + i * 110)}
                >
                  <span className="flex items-center gap-2 font-semibold text-cocoa dark:text-dark-white">
                    <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                    {item.name}
                    <span className="font-normal text-cocoa/45 dark:text-dark-white/45">{item.portion}</span>
                  </span>
                  <span className="font-bold text-cocoa/80 dark:text-dark-white/80">{item.kcal} kcal</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-end">
              <Press
                on={pressed(ms, T.logClick)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold ${
                  logged ? "bg-moringa text-white dark:bg-moringa-faded dark:text-cocoa" : "bg-pawpaw text-white"
                }`}
              >
                {logged ? (
                  <>
                    <Check size={13} strokeWidth={3} /> Logged
                  </>
                ) : (
                  "Log meal"
                )}
              </Press>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const bubble = "rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed";
const nouraBubble = `${bubble} w-fit max-w-[86%] rounded-bl-md bg-off-white text-cocoa dark:bg-[#1f2522] dark:text-dark-white`;

const ChatScene = ({ ms }: { ms: number }) => {
  const sent = ms >= T.send;
  const typing = ms >= T.typeStart && !sent;
  const ready = ms >= T.typeEnd && !sent;

  return (
    <div className="absolute inset-0 flex flex-col p-4">
      <div className="flex items-center gap-3 border-b border-cocoa/10 pb-3 dark:border-white/10">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pawpaw/15 text-pawpaw">
          <Sparkles size={17} />
        </span>
        <div>
          <p className="text-sm font-bold text-cocoa dark:text-dark-white">Noura</p>
          <p className="text-[11px] text-cocoa/50 dark:text-dark-white/50">Knows your goal, allergies and today&apos;s meals</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-hidden py-3">
        <div className={nouraBubble}>Good afternoon! Your lunch is logged. Ask me anything about your meals, your goal or what to eat next.</div>
        <div className="mt-auto" />
        {!sent && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {SUGGESTIONS.map((q) => (
              <span key={q} className="rounded-full border border-moringa/20 px-3 py-1 text-[10px] font-medium text-moringa dark:border-moringa-faded/30 dark:text-moringa-faded">
                {q}
              </span>
            ))}
          </div>
        )}
        {sent && (
          <div className={`${bubble} ml-auto max-w-[78%] rounded-br-md bg-pawpaw font-medium text-white`} style={enter("rise", 500)}>
            {QUESTION}
          </div>
        )}
        {ms >= T.thinking && ms < T.reply && (
          <div className={`${nouraBubble} flex gap-1 !py-3`} style={enter("rise", 400)}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-moringa dark:bg-moringa-faded"
                style={{ animation: `fxd-dot 800ms ease-in-out ${i * 130}ms infinite` }}
              />
            ))}
          </div>
        )}
        {ms >= T.reply && (
          <div className={nouraBubble} style={enter("rise", 500)}>
            <Streamed text={REPLY} ms={1900} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-cocoa/10 bg-off-white/70 py-1.5 pl-3.5 pr-1.5 dark:border-white/10 dark:bg-white/5">
        <span className={`flex-1 truncate text-xs ${typing ? "text-cocoa dark:text-dark-white" : "text-cocoa/40 dark:text-dark-white/40"}`}>
          {typing ? <Typed text={QUESTION} ms={T.typeEnd - T.typeStart} /> : "Ask Noura…"}
        </span>
        <Press
          on={pressed(ms, T.send)}
          to={0.87}
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${
            ready ? "bg-pawpaw text-white" : "bg-cocoa/10 text-cocoa/40 dark:bg-white/10 dark:text-dark-white/40"
          }`}
        >
          <Send size={14} />
        </Press>
      </div>
    </div>
  );
};

const waterLitres = (ms: number) => (ms >= T.plus2 ? 2.25 : ms >= T.plus1 ? 2.0 : 1.75);

const WaterScene = ({ ms, compact }: { ms: number; compact: boolean }) => {
  const litres = waterLitres(ms);
  const streakUp = ms >= T.plus1;
  return (
    <div className="absolute inset-0 flex flex-col p-5">
      <p className="text-sm font-bold text-cocoa dark:text-dark-white">Hydration</p>
      <p className="text-[11px] text-cocoa/50 dark:text-dark-white/50">Target 2.5 L · based on your activity</p>

      <div className="flex flex-1 items-center justify-center gap-8">
        <div className={`relative overflow-hidden rounded-b-[2rem] rounded-t-lg border-[3px] border-sky-500/30 bg-sky-500/5 ${compact ? "h-44 w-28" : "h-52 w-32"}`}>
          <div
            className="absolute inset-0 bg-gradient-to-t from-sky-500 to-sky-400"
            style={{ transform: `translate3d(0, ${(1 - litres / 2.5) * 100}%, 0)`, transition: move(900) }}
          >
            <div className="absolute -top-2 left-0 h-4 w-[200%] rounded-[50%] bg-sky-400/80" style={{ animation: "fxd-wave 2.6s linear infinite" }} />
          </div>
        </div>
        <div>
          <p className="text-3xl font-extrabold text-cocoa dark:text-dark-white">
            <Count value={litres} decimals={2} ms={800} />
            <span className="ml-1 text-sm font-semibold text-cocoa/45 dark:text-dark-white/45">/ 2.5 L</span>
          </p>
          <p
            key={String(streakUp)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-bold text-sky-600 dark:text-sky-400"
            style={streakUp ? enter("bump", 600) : undefined}
          >
            <Droplets size={12} /> Water streak · {streakUp ? 9 : 8} days
          </p>
        </div>
      </div>

      <div className="flex justify-center gap-2.5 pb-1">
        <Press on={pressed(ms, T.plus1) || pressed(ms, T.plus2)} className="inline-block rounded-full bg-sky-500 px-5 py-2 text-xs font-bold text-white">
          +250 ml
        </Press>
        <span className="rounded-full bg-sky-500/10 px-5 py-2 text-xs font-bold text-sky-600 dark:text-sky-400">+500 ml</span>
      </div>
    </div>
  );
};

/* ── Today panel and chrome ──────────────────────────────────────────── */

const dayKcal = (ms: number) => (ms >= T.logClick + 150 ? DAY_BEFORE + PLATE_KCAL : DAY_BEFORE);

const MACROS = [
  { label: "Protein", from: 24, to: 56, max: 120, color: "bg-moringa dark:bg-moringa-faded" },
  { label: "Carbs", from: 70, to: 140, max: 250, color: "bg-pawpaw" },
  { label: "Fat", from: 18, to: 40, max: 70, color: "bg-[#EAB308]" },
];
const MEALS_BEFORE = [
  { meal: "Breakfast", name: "Akara & pap", kcal: 412 },
  { meal: "Snack", name: "Moi moi", kcal: 144 },
];
const mealRow = "flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[11px] shadow-sm dark:bg-white/5";

const TodayPanel = ({ ms }: { ms: number }) => {
  const kcal = dayKcal(ms);
  const updated = kcal > DAY_BEFORE;
  const litres = waterLitres(ms);
  return (
    <div className="absolute inset-0 flex flex-col gap-4 border-l border-cocoa/10 bg-off-white/60 p-4 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-cocoa dark:text-dark-white">Today</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-pawpaw/10 px-2 py-0.5 text-[10px] font-bold text-pawpaw">
          <Flame size={11} /> 12-day streak
        </span>
      </div>

      <div className="flex items-center gap-3.5">
        <div className="relative shrink-0">
          <Ring value={kcal / DAY_TARGET} size={88} stroke={9} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-extrabold text-cocoa dark:text-dark-white">
              <Count value={kcal} />
            </span>
            <span className="text-[9px] text-cocoa/50 dark:text-dark-white/50">of 2,000</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {MACROS.map((m) => {
            const g = updated ? m.to : m.from;
            return (
              <div key={m.label}>
                <div className="mb-0.5 flex justify-between text-[10px] text-cocoa/60 dark:text-dark-white/60">
                  <span>{m.label}</span>
                  <span className="font-semibold">
                    <Count value={g} /> g
                  </span>
                </div>
                <Bar value={g / m.max} className={m.color} />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-cocoa/45 dark:text-dark-white/45">Meals</p>
        <ul className="space-y-1.5">
          {MEALS_BEFORE.map((m) => (
            <li key={m.meal} className={mealRow}>
              <span>
                <span className="font-semibold text-cocoa dark:text-dark-white">{m.name}</span>
                <span className="ml-1.5 text-cocoa/45 dark:text-dark-white/45">{m.meal}</span>
              </span>
              <span className="font-bold text-cocoa/75 dark:text-dark-white/75">{m.kcal}</span>
            </li>
          ))}
          {updated && (
            <li className={`${mealRow} ring-2 ring-pawpaw/40`} style={enter("rise", 600)}>
              <span>
                <span className="font-semibold text-cocoa dark:text-dark-white">Jollof plate</span>
                <span className="ml-1.5 text-cocoa/45 dark:text-dark-white/45">Lunch</span>
              </span>
              <span className="font-bold text-pawpaw">{PLATE_KCAL}</span>
            </li>
          )}
        </ul>
      </div>

      <div className="mt-auto rounded-xl bg-white p-3 shadow-sm dark:bg-white/5">
        <div className="mb-1.5 flex justify-between text-[11px]">
          <span className="flex items-center gap-1.5 font-semibold text-cocoa dark:text-dark-white">
            <Droplets size={12} className="text-sky-500" /> Water
          </span>
          <span className="font-bold text-cocoa/75 dark:text-dark-white/75">
            <Count value={litres} decimals={2} ms={800} /> / 2.5 L
          </span>
        </div>
        <Bar value={litres / 2.5} className="bg-sky-500" />
      </div>
    </div>
  );
};

const NAV = [
  { icon: LayoutGrid, label: "Today" },
  { icon: ScanLine, label: "Scan" },
  { icon: Sparkles, label: "Noura" },
  { icon: Droplets, label: "Water" },
];
const navIndex = (scene: Scene) => (scene === "scan" ? 1 : scene === "chat" ? 2 : 3);

const Toast = ({ show, children }: { show: boolean; children: ReactNode }) => (
  <div
    className="absolute right-4 top-4 z-40 flex items-center gap-2 rounded-xl bg-cocoa px-3.5 py-2.5 text-[11px] font-semibold text-white dark:bg-dark-white dark:text-cocoa"
    style={{ opacity: show ? 1 : 0, transform: show ? "none" : "translate3d(0, -10px, 0)", transition: move(450) }}
  >
    {children}
  </div>
);

// Each scene fades in over the one before it, which is dropped once covered.
const Layer = ({ animateIn, children }: { animateIn: boolean; children: ReactNode }) => (
  <div className="absolute inset-0 bg-white dark:bg-[#121614]" style={animateIn ? enter("slide", SCENE_FADE_MS) : undefined}>
    {children}
  </div>
);

const SceneArea = ({ ms, layout }: { ms: number; layout: Layout }) => (
  <>
    {ms < T.nouraClick + SCENE_FADE_MS && (
      <Layer key="scan" animateIn={false}>
        <ScanScene ms={ms} layout={layout} />
      </Layer>
    )}
    {ms >= T.nouraClick && ms < T.waterClick + SCENE_FADE_MS && (
      <Layer key="chat" animateIn>
        <ChatScene ms={ms} />
      </Layer>
    )}
    {ms >= T.waterClick && (
      <Layer key="water" animateIn>
        <WaterScene ms={ms} compact={layout === "compact"} />
      </Layer>
    )}
    <Toast show={ms >= T.logClick + 150 && ms < T.toastOff}>
      <Check size={13} strokeWidth={3} className="text-moringa-faded" /> Added to lunch · {PLATE_KCAL} kcal
    </Toast>
    <Toast show={ms >= T.plus1 + 150 && ms < T.waterToastOff}>
      <Droplets size={13} className="text-sky-400" /> Water streak · 9 days
    </Toast>
  </>
);

const TitleBar = () => (
  <div className="absolute inset-x-0 top-0 flex h-10 items-center border-b border-cocoa/10 bg-off-white/80 px-4 dark:border-white/10 dark:bg-white/[0.03]">
    <div className="flex gap-1.5">
      <span className="h-3 w-3 rounded-full bg-pawpaw/80" />
      <span className="h-3 w-3 rounded-full bg-[#EAB308]/80" />
      <span className="h-3 w-3 rounded-full bg-moringa-faded" />
    </div>
    <p className="flex-1 text-center text-xs font-semibold text-cocoa/60 dark:text-dark-white/60">Flax</p>
    <span className="w-12" />
  </div>
);

const PanelApp = ({ ms }: { ms: number }) => {
  const active = navIndex(sceneAt(ms));
  const { main } = DIMS.panel;
  return (
    <>
      <TitleBar />
      <div className="absolute bottom-0 left-0 top-10 flex flex-col items-center gap-2 border-r border-cocoa/10 pt-4 dark:border-white/10" style={{ width: main.x }}>
        <img src="/images/logoIcon.png" alt="" className="mb-3 h-7 w-7 object-contain dark:hidden" />
        <img src="/images/logoIconDark.png" alt="" className="mb-3 hidden h-7 w-7 object-contain dark:block" />
        <span
          className="absolute left-1/2 top-[64px] -ml-5 h-10 w-10 rounded-xl bg-pawpaw/15"
          style={{ transform: `translate3d(0, ${active * 48}px, 0)`, transition: move(550) }}
        />
        {NAV.map(({ icon: Icon, label }, i) => (
          <div key={label} className="relative flex h-10 w-10 items-center justify-center">
            <Icon size={18} className={`relative transition-colors duration-200 ${i === active ? "text-pawpaw" : "text-cocoa/40 dark:text-dark-white/40"}`} />
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 top-10 overflow-hidden" style={{ left: main.x, width: main.w }}>
        <SceneArea ms={ms} layout="panel" />
      </div>
      <div className="absolute bottom-0 right-0 top-10" style={{ left: main.x + main.w }}>
        <TodayPanel ms={ms} />
      </div>
    </>
  );
};

const CompactApp = ({ ms }: { ms: number }) => {
  const active = navIndex(sceneAt(ms));
  const kcal = dayKcal(ms);
  const litres = waterLitres(ms);
  return (
    <>
      <TitleBar />
      <div className="absolute inset-x-0 top-10 flex h-16 items-center gap-3 border-b border-cocoa/10 px-4 dark:border-white/10">
        <div className="relative">
          <Ring value={kcal / DAY_TARGET} size={44} stroke={5} />
          <Flame size={14} className="absolute inset-0 m-auto text-pawpaw" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-extrabold text-cocoa dark:text-dark-white">
            <Count value={kcal} /> <span className="text-[11px] font-medium text-cocoa/50 dark:text-dark-white/50">/ 2,000 kcal</span>
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Droplets size={11} className="text-sky-500" />
            <div className="flex-1">
              <Bar value={litres / 2.5} className="bg-sky-500" />
            </div>
            <span className="text-[10px] font-semibold text-cocoa/60 dark:text-dark-white/60">
              <Count value={litres} decimals={2} ms={800} /> L
            </span>
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 top-[104px] h-[476px] overflow-hidden">
        <SceneArea ms={ms} layout="compact" />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-[60px] items-center justify-around border-t border-cocoa/10 dark:border-white/10">
        <span
          className="absolute left-[18px] top-2 h-11 w-16 rounded-xl bg-pawpaw/10"
          style={{ transform: `translate3d(${active * 100}px, 0, 0)`, transition: move(550) }}
        />
        {NAV.map(({ icon: Icon, label }, i) => (
          <div key={label} className="relative flex h-11 w-16 flex-col items-center justify-center gap-0.5">
            <Icon size={17} className={`relative transition-colors duration-200 ${i === active ? "text-pawpaw" : "text-cocoa/40 dark:text-dark-white/40"}`} />
            <span className={`relative text-[9px] font-semibold ${i === active ? "text-pawpaw" : "text-cocoa/40 dark:text-dark-white/40"}`}>{label}</span>
          </div>
        ))}
      </div>
    </>
  );
};

/* ── public component ────────────────────────────────────────────────── */

export const DEMO_STEPS = ["Scan", "Log", "Ask Noura", "Hydrate"] as const;
const demoStepAt = (ms: number) => (ms < T.sheet ? 0 : ms < T.nouraClick ? 1 : ms < T.waterClick ? 2 : 3);

const FlaxAppDemoBase = ({
  onStep,
}: {
  onStep?: (step: number) => void;
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [width, setWidth] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [imgReady, setImgReady] = useState(false);

  // Start only once the dish photo is decoded, so the first scene is never
  // empty. Falls back after 4s so a slow image never stalls the demo.
  useEffect(() => {
    let live = true;
    const ready = () => live && setImgReady(true);
    const img = new Image();
    img.src = PLATE_IMG;
    img.decode().then(ready, ready);
    const fallback = window.setTimeout(ready, 4000);
    return () => {
      live = false;
      window.clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      // 0 means not laid out (hidden, or styles still loading), keep the
      // last real size instead of falling back to the phone layout.
      const w = entry.contentRect.width;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => setReduceMotion(mq.matches);
    const first = requestAnimationFrame(onMq);
    mq.addEventListener("change", onMq);
    return () => {
      cancelAnimationFrame(first);
      mq.removeEventListener("change", onMq);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const { ms, loop } = useTimeline(inView && pageVisible && imgReady, reduceMotion ? STATIC_FRAME_MS : null);
  const step = demoStepAt(ms);
  useEffect(() => {
    onStep?.(step);
  }, [step, onStep]);

  const layout: Layout = width !== null && width < 520 ? "compact" : "panel";
  const dims = DIMS[layout];
  const scale = width ? width / dims.w : 1;

  return (
    <div ref={wrapRef} className="relative aspect-[400/640] w-full sm:aspect-[800/560]" style={width ? { height: dims.h * scale, aspectRatio: "auto" } : undefined}>
      <p className="sr-only">
        Animated demo of the Flax app: a plate of jollof rice, fried chicken and plantain is scanned and each
        item is identified with its calories, the meal is logged and the day&apos;s calorie ring updates, Noura
        answers whether the meal fits a weight loss goal, and water intake is logged.
      </p>
      {width !== null && (
        // The hero page load entrance, on the window itself because it only
        // exists once its container is measured.
        <div className="hero-in-window absolute inset-0">
          <style>{KEYFRAMES}</style>
          <div
            aria-hidden
            className="absolute left-0 top-0 origin-top-left overflow-hidden rounded-2xl bg-white font-body shadow-[0_2px_6px_rgba(28,26,23,0.05),0_18px_45px_-18px_rgba(28,26,23,0.25)] ring-1 ring-cocoa/10 dark:bg-[#121614] dark:shadow-[0_2px_6px_rgba(0,0,0,0.3),0_18px_45px_-16px_rgba(0,0,0,0.65)] dark:ring-white/10"
            // Nothing inside can affect the page around it, or the reverse.
            style={{ width: dims.w, height: dims.h, transform: `scale(${scale})`, contain: "layout style" }}
          >
            {/* Remounted per loop while faded out, so nothing is seen
                rewinding to its starting state. */}
            <div key={`${layout}-${loop}`} className="absolute inset-0" style={{ opacity: ms >= T.fadeOut ? 0 : 1, transition: "opacity 500ms ease-in-out" }}>
              <div className="absolute inset-0" style={enter("fade", 500, 0, "ease-in-out")}>
                {layout === "compact" ? <CompactApp ms={ms} /> : <PanelApp ms={ms} />}
              </div>
            </div>
            <Cursor ms={ms} layout={layout} />
          </div>
        </div>
      )}
    </div>
  );
};

// Memoised so the hero around it can re-render freely.
export const FlaxAppDemo = memo(FlaxAppDemoBase);
