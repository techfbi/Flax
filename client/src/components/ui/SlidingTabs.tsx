import { useRef, useLayoutEffect, useState } from "react";

interface SlidingTabsProps<T extends string> {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
  /**
   * When true, each tab is only as wide as its own label and the
   * indicator tracks the active tab's measured position instead of
   * splitting the container evenly. Used where the tab row should
   * not stretch to fill its parent. Defaults to false, which keeps
   * every existing call site exactly as it was.
   */
  fitWidth?: boolean;
}

export function SlidingTabs<T extends string>({
  tabs,
  active,
  onChange,
  fitWidth = false,
}: SlidingTabsProps<T>) {
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  // Only needed for the fitWidth layout, measures the active tab's
  // actual pixel position since the tabs are no longer equal width.
  useLayoutEffect(() => {
    if (!fitWidth) return;
    const el = tabRefs.current.get(active);
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active, tabs, fitWidth]);

  if (fitWidth) {
    return (
      <div className="relative inline-flex gap-6 border-b border-cocoa/10 dark:border-dark-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.key, el);
            }}
            onClick={() => onChange(tab.key)}
            className={`pb-2 text-sm font-heading transition-colors whitespace-nowrap
              ${
                active === tab.key
                  ? "text-cocoa dark:text-dark-white font-semibold"
                  : "text-cocoa/60 dark:text-dark-white/50"
              }`}
          >
            {tab.label}
          </button>
        ))}
        <span
          className="absolute bottom-0 h-0.5 bg-pawpaw dark:bg-black-pawpaw transition-all duration-300 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      </div>
    );
  }

  // Original equal width behavior, untouched, still used by the
  // mobile Spin/Filters/Spin history switch and the Spin
  // history/Flagged toggle.
  const activeIndex = tabs.findIndex((t) => t.key === active);
  const count = tabs.length;

  return (
    <div className="relative flex border-b border-cocoa/10 dark:border-dark-white/10">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 pb-2 text-sm font-heading transition-colors text-center
            ${
              active === tab.key
                ? "text-cocoa dark:text-dark-white font-semibold"
                : "text-cocoa/60 dark:text-dark-white/50"
            }`}
        >
          {tab.label}
        </button>
      ))}
      <span
        className="absolute bottom-0 h-0.5 bg-pawpaw dark:bg-black-pawpaw transition-transform duration-300 ease-out"
        style={{
          width: `${100 / count}%`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
    </div>
  );
}
