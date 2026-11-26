"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollReveal, ScrollRevealGroup, ScrollRevealItem } from "@/components/ui/ScrollReveal";

/*
  How it works: the four things a person actually does in Flax, in order,
  in the original card grid. Each claim matches the app:
  1. Onboarding asks for goal (optional), dietary style, activity level,
     then sex, age range, region, height and weight. Calorie and water
     targets are calculated from those (server shared/calculations.ts).
  2. Spin picks from the region's dishes, always removes allergens,
     prefers pantry items, skips anything suggested in the last 48 hours,
     and Noura writes the reason (server modules/spin).
  3. Logging: catalogue, a described custom dish, or a photo scan. Water
     is logged from the home screen.
  4. Streaks advance at 80% of the calorie target and 80% of the water
     target (server modules/streaks, modules/water).

  The cards are joined in reading order. On two columns the route goes
  1 across to 2, curves down and back to 3, then across to 4. On one
  column it runs straight down. The links are measured from the cards
  themselves, draw in once the section is on screen, and a dot keeps
  walking the route. Everything here is decorative and hidden from
  screen readers.
*/

const STEPS = [
  {
    title: "Tell Flax about you",
    body: "Pick your goal, how you eat and how active you are, then add your age, height and weight. Flax works out your daily calorie and water targets from that.",
    icon: { src: "/images/targetHit.png", alt: "target hit", size: 32 },
    circle: "bg-moringa-faded",
  },
  {
    title: "Decide what to eat",
    body: "Spin for a dish from your region that fits your goal, leaves out your allergens and favours what is already in your kitchen. Noura tells you why it picked it.",
    icon: { src: "/images/arrowSpin.png", alt: "spin", size: 32 },
    circle: "bg-pawpaw dark:bg-black-pawpaw",
  },
  {
    title: "Log food and water",
    body: "Choose from the catalogue, describe a dish of your own or snap your plate, and Noura estimates the nutrition. Water is a tap away.",
    icon: { src: "/images/log.png", alt: "log", size: 30 },
    circle: "bg-cocoa dark:bg-dark-bg",
  },
  {
    title: "Keep your streaks going",
    body: "Reach 80% of your calorie target and your goal streak grows, do the same with water for your water streak. Noura is there whenever you have a question.",
    icon: { src: "/images/fire.png", alt: "fire", size: 32 },
    circle: "bg-[#FEF3C7]",
  },
];

type Route = { w: number; h: number; links: string[]; walk: string };

// Space left between a link and the card it touches.
const PAD = 10;

const measureRoute = (wrap: HTMLElement): Route | null => {
  const cards = [...wrap.querySelectorAll<HTMLElement>("[data-step]")].map((el) => el.parentElement as HTMLElement);
  if (cards.length !== STEPS.length) return null;
  const box = cards.map((c) => ({
    l: c.offsetLeft,
    t: c.offsetTop,
    r: c.offsetLeft + c.offsetWidth,
    b: c.offsetTop + c.offsetHeight,
    cx: c.offsetLeft + c.offsetWidth / 2,
    cy: c.offsetTop + c.offsetHeight / 2,
  }));
  const links: string[] = [];
  const walk: string[] = [];
  const twoColumns = box[1].l > box[0].r;

  if (twoColumns) {
    const [a, b, c, d] = box;
    const across = (from: typeof a, to: typeof a) => `M ${from.r + PAD} ${from.cy} L ${to.l - PAD} ${to.cy}`;
    // A short S through the middle of the grid: out of the inner bottom
    // corner of card 2, into the inner top corner of card 3.
    const x2 = b.l + 56;
    const x3 = c.r - 56;
    const y2 = b.b + PAD;
    const y3 = c.t - PAD;
    const bend = (y3 - y2) * 0.85;
    const s = `C ${x2} ${y2 + bend}, ${x3} ${y3 - bend}, ${x3} ${y3}`;
    links.push(across(a, b));
    links.push(`M ${x2} ${y2} ${s}`);
    links.push(across(c, d));
    // The dot also passes under cards 2 and 3, so its route is one line.
    walk.push(`M ${a.r + PAD} ${a.cy} L ${x2} ${b.cy} L ${x2} ${y2}`);
    walk.push(s);
    walk.push(`L ${x3} ${c.cy} L ${d.l - PAD} ${d.cy}`);
  } else {
    // One column: straight down, lined up with the icons.
    const x = box[0].l + 48;
    for (let i = 0; i < box.length - 1; i++) links.push(`M ${x} ${box[i].b + PAD} L ${x} ${box[i + 1].t - PAD}`);
    walk.push(`M ${x} ${box[0].b + PAD} L ${x} ${box[box.length - 1].t - PAD}`);
  }
  return { w: wrap.offsetWidth, h: wrap.offsetHeight, links, walk: walk.join(" ") };
};

const Links = ({ route, drawn }: { route: Route; drawn: boolean }) => (
  <svg
    aria-hidden
    width={route.w}
    height={route.h}
    viewBox={`0 0 ${route.w} ${route.h}`}
    className="pointer-events-none absolute inset-0 overflow-visible text-pawpaw/60 dark:text-black-pawpaw/60"
  >
    <defs>
      <marker id="hiw-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 1 1 L 8 5 L 1 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
    </defs>
    {route.links.map((d, i) => (
      <path
        key={i}
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        markerEnd="url(#hiw-arrow)"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={drawn ? 0 : 1}
        style={{
          transition: "stroke-dashoffset 700ms cubic-bezier(0.65, 0, 0.35, 1)",
          transitionDelay: `${700 + i * 550}ms`,
        }}
        className="motion-reduce:!transition-none"
      />
    ))}
    {drawn && (
      <circle r={4} className="fill-pawpaw motion-reduce:hidden dark:fill-black-pawpaw">
        <animateMotion dur="5.5s" begin="2.4s" repeatCount="indefinite" path={route.walk} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.94;1" dur="5.5s" begin="2.4s" repeatCount="indefinite" />
      </circle>
    )}
  </svg>
);

export const HowItWorks = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRoute(measureRoute(wrap)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(wrap);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <section id="how-it-works" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <h2 className="font-heading text-base md:text-[20px] lg:text-3xl font-bold text-center text-cocoa dark:text-dark-white mb-2 lg:mb-4">
            How it works
          </h2>
          <p className="text-center text-xs md:text-sm font-bold text-cocoa-faded mb-12">From sign up to your first streak</p>
        </ScrollReveal>

        <div ref={wrapRef} className="relative max-w-[58rem] mx-auto">
          {route && <Links route={route} drawn={drawn} />}
          <ScrollRevealGroup className="relative grid sm:grid-cols-2 gap-y-12 sm:gap-x-16 sm:gap-y-20">
            {STEPS.map((step) => (
              <ScrollRevealItem key={step.title} className="relative bg-surface dark:bg-black-surface rounded-2xl p-6 flex gap-4 shadow-sm">
                <div data-step className={`w-12 h-12 rounded-full ${step.circle} flex items-center justify-center shrink-0`}>
                  <img
                    src={step.icon.src}
                    alt={step.icon.alt}
                    width={step.icon.size}
                    height={step.icon.size}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm md:text-[16px] text-cocoa dark:text-dark-white mb-1">{step.title}</h3>
                  <p className="text-xs md:text-sm text-cocoa-faded leading-relaxed">{step.body}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </div>
    </section>
  );
};
