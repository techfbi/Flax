import { useMemo } from "react";

interface ConveyorTickerProps {
  items: string[];
}

/*
  Vertical ticker, three rows visible at once, clipped by the
  container. The whole list scrolls up by exactly one row at a time,
  holds, then slides again, the top row exits while a new one enters
  at the bottom in the same motion, like a queue moving forward.

  The rendered list is the items array duplicated once. Scrolling up
  by exactly one full pass through the original list (fifty percent
  of the doubled track) lands on a position that looks identical to
  the very start, so the loop resets with no visible jump.

  Keyframes are generated per item count since duration and step size
  both depend on how many items a given screen passes in, injected as
  a scoped style tag rather than a Tailwind utility so nothing here
  depends on the build tree shaking a class correctly.
*/
const ITEM_HEIGHT = 22; // px, matches text-sm line height plus breathing room
const VISIBLE_ROWS = 3;
const SECONDS_PER_ITEM = 2.2; // hold time plus the slide into the next row

export const ConveyorTicker = ({ items }: ConveyorTickerProps) => {
  const count = items.length;

  const { keyframeName, keyframeCss, duration } = useMemo(() => {
    const name = `conveyorTicker${count}`;
    const holdRatio = 0.8; // eighty percent holding still, twenty percent sliding
    const segment = 100 / count;
    let frames = "";
    for (let i = 0; i < count; i++) {
      const start = i * segment;
      const holdEnd = start + segment * holdRatio;
      const value = -(i * (50 / count));
      frames += `${start}% { transform: translateY(${value}%); } `;
      frames += `${holdEnd}% { transform: translateY(${value}%); } `;
    }
    frames += `100% { transform: translateY(-50%); }`;
    return {
      keyframeName: name,
      keyframeCss: `@keyframes ${name} { ${frames} }`,
      duration: count * SECONDS_PER_ITEM,
    };
  }, [count]);

  // Not enough items to fill three rows and still have something to
  // scroll to, just show them still, nothing to cycle through.
  if (count <= VISIBLE_ROWS) {
    return (
      <div aria-hidden="true">
        {items.map((item) => (
          <p
            key={item}
            className="text-sm text-cocoa dark:text-dark-white"
            style={{
              height: ITEM_HEIGHT,
              lineHeight: `${ITEM_HEIGHT}px`,
              opacity: 0.75,
            }}
          >
            {item}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: ITEM_HEIGHT * VISIBLE_ROWS,
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)",
      }}
    >
      <style>{keyframeCss}</style>
      <div
        style={{
          animationName: keyframeName,
          animationDuration: `${duration}s`,
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
        }}
      >
        {[...items, ...items].map((item, i) => (
          <p
            key={`${item}-${i}`}
            className="text-sm text-cocoa dark:text-dark-white"
            style={{
              height: ITEM_HEIGHT,
              lineHeight: `${ITEM_HEIGHT}px`,
              opacity: 0.75,
            }}
          >
            {item}
          </p>
        ))}
      </div>
    </div>
  );
};
