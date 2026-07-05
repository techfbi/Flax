import { useTheme } from "@/context/ThemeContext";
import type { WaterLogEntry } from "@/types/apiTypes";

interface WaterCupsProps {
  entries: WaterLogEntry[];
  targetMl: number;
  dailyTotal: number;
}

interface Cup {
  size: 250 | 500;
  timestamp: string;
}

/*
  Cup display logic:
  Process ALL entries regardless of whether target is hit.
  Max 8 cups total. After 8, everything else accumulates in extraMl.
  If target is hit, cups already accumulated stay visible.
  Excess beyond target also accumulates in extraMl.
  The + Xml shows the remaining amount that did not fit into cups.
*/
const buildCups = (
  entries: WaterLogEntry[],
): { cups: Cup[]; extraMl: number } => {
  const cups: Cup[] = [];
  let extraMl = 0;

  for (const entry of entries) {
    let remaining = entry.amount_ml;

    /* Try to fill 500ml cups first */
    while (remaining >= 500 && cups.length < 8) {
      cups.push({ size: 500, timestamp: entry.logged_at });
      remaining -= 500;
    }

    /* Then 250ml cups */
    while (remaining >= 250 && cups.length < 8) {
      cups.push({ size: 250, timestamp: entry.logged_at });
      remaining -= 250;
    }

    /* Whatever is left goes into the extra accumulator */
    extraMl += remaining;
  }

  /*
    After processing all entries, try converting accumulated extra
    into more cups if we are still under 8.
  */
  while (extraMl >= 500 && cups.length < 8) {
    cups.push({ size: 500, timestamp: "" });
    extraMl -= 500;
  }
  while (extraMl >= 250 && cups.length < 8) {
    cups.push({ size: 250, timestamp: "" });
    extraMl -= 250;
  }

  return { cups, extraMl };
};

const formatTime = (iso: string) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* 500ml cup SVG taller, wider cup shape */
const Cup500 = ({ isDark }: { isDark: boolean }) => (
  <img
    src={isDark ? "/images/cupDark.svg" : "/images/cupWhite.svg"}
    alt="waterCup"
    className="object-contain w-[17px] flex"
  />
);

/* 250ml cup SVG — shorter, narrower cup shape */
const Cup250 = ({ isDark }: { isDark: boolean }) => (
  <img
    src={isDark ? "/images/cupDark.svg" : "/images/cupWhite.svg"}
    alt="waterCup"
    className="object-contain w-[14px] flex"
  />
);

export const WaterCups = ({
  entries,
  //targetMl,
  //dailyTotal,
}: WaterCupsProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  /*
    Always process all entries. Target hit state does NOT stop cup display.
    Cups show what was logged. Excess shows in + Xml.
  */
  const { cups, extraMl } = buildCups(entries);

  /*
    Calculate how much of extraMl is actual excess beyond target.
    Display extra as a single + Xml regardless of whether it is
    pre-target remainder or post-target excess.
  */
  //   const excessBeyondTarget =
  //     dailyTotal > (targetMl ?? 0) ? dailyTotal - (targetMl ?? 0) : 0;

  //   /* If no cups and no extra, show empty state */
  //   if (cups.length === 0 && extraMl === 0 && dailyTotal === 0) {
  //     return (
  //       <p className="text-xs text-cocoa-faded mt-2">No water logged yet today</p>
  //     );
  //   }

  return (
    <div className="flex flex-wrap items-end gap-1.5 mt-3">
      {cups.map((cup, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          {cup.size === 500 ? (
            <Cup500 isDark={isDark} />
          ) : (
            <Cup250 isDark={isDark} />
          )}
          <span className="text-[9px] font-medium text-cocoa-faded mt-0.5">
            {cup.size}ml
          </span>
          {cup.timestamp && (
            <span className="text-[9px] text-cocoa-faded">
              {formatTime(cup.timestamp)}
            </span>
          )}
        </div>
      ))}

      {/* Remainder that did not fit into cups */}
      {extraMl > 0 && (
        <div className="flex items-center self-center">
          <span className="text-sm font-semibold text-cocoa dark:text-dark-white">
            + {extraMl}ml
          </span>
        </div>
      )}

      {/* Target hit indicator — shown alongside cups, not replacing them
      {excessBeyondTarget > 0 && cups.length > 0 && (
        <div className="w-full mt-1">
          <span className="text-[10px] text-pawpaw dark:text-black-pawpaw font-medium">
            Target hit · +{excessBeyondTarget}ml excess
          </span>
        </div>
      )} */}
    </div>
  );
};
