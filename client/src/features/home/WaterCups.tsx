import { useTheme } from "@/context/ThemeContext";
import type { WaterLogEntry } from "@/types/apiTypes";

/*  Logic per entry:
    Extract as many 500ml cups as possible, then 250ml cups.
    Remainder goes to the running "+ Xml" accumulator.
    Max 8 cups total shown. After 8, all remainder goes to "+ Xml".
    Stop adding cups if target is already hit.
    Cups beyond target do not display new cups, only excess in parent.

  Timestamp shown below each cup in small text.
*/

interface WaterCupsProps {
  entries: WaterLogEntry[];
  targetMl: number;
  dailyTotal: number;
}

interface Cup {
  size: 250 | 500;
  timestamp: string;
}

const parseCupsFromEntry = (
  amountMl: number,
  loggedAt: string,
  cupsAlready: number,
): { cups: Cup[]; remainder: number } => {
  const cups: Cup[] = [];
  let remaining = amountMl;

  while (remaining >= 500 && cupsAlready + cups.length < 8) {
    cups.push({ size: 500, timestamp: loggedAt });
    remaining -= 500;
  }
  while (remaining >= 250 && cupsAlready + cups.length < 8) {
    cups.push({ size: 250, timestamp: loggedAt });
    remaining -= 250;
  }

  return { cups, remainder: remaining };
};

const formatTime = (iso: string) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* 500ml cup SVG — taller, wider cup shape */
const Cup500 = ({ isDark }: { isDark: boolean }) => (
  <svg width="34" height="40" viewBox="0 0 34 40" fill="none">
    {/* Cup body */}
    <path
      d="M5 8 L4 36 Q4 38 6 38 L28 38 Q30 38 30 36 L29 8 Z"
      fill={isDark ? "rgba(127,176,150,0.25)" : "rgba(47,93,75,0.15)"}
      stroke={isDark ? "#7FB096" : "#2F5D4B"}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {/* Water fill */}
    <path
      d="M6 16 L5.5 36 Q5.5 37 6 37 L28 37 Q28.5 37 28.5 36 L28 16 Z"
      fill={isDark ? "rgba(127,176,150,0.55)" : "rgba(47,93,75,0.4)"}
    />
    {/* Rim */}
    <path
      d="M4 8 Q4 6 5 6 L29 6 Q30 6 30 8 L29 9 L5 9 Z"
      fill={isDark ? "#7FB096" : "#2F5D4B"}
      opacity="0.8"
    />
    {/* Label */}
    <text
      x="17"
      y="25"
      textAnchor="middle"
      fontSize="7"
      fontWeight="600"
      fill={isDark ? "#7FB096" : "#2F5D4B"}
    >
      500
    </text>
  </svg>
);

/* 250ml cup SVG — shorter, narrower cup shape */
const Cup250 = ({ isDark }: { isDark: boolean }) => (
  <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
    {/* Cup body */}
    <path
      d="M4 6 L3.5 28 Q3.5 30 5 30 L23 30 Q24.5 30 24.5 28 L24 6 Z"
      fill={isDark ? "rgba(127,176,150,0.25)" : "rgba(47,93,75,0.15)"}
      stroke={isDark ? "#7FB096" : "#2F5D4B"}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {/* Water fill */}
    <path
      d="M5 13 L4.5 28 Q4.5 29 5 29 L23 29 Q23.5 29 23.5 28 L23 13 Z"
      fill={isDark ? "rgba(127,176,150,0.55)" : "rgba(47,93,75,0.4)"}
    />
    {/* Rim */}
    <path
      d="M3.5 6 Q3.5 4.5 4.5 4.5 L23.5 4.5 Q24.5 4.5 24.5 6 L24 7 L4 7 Z"
      fill={isDark ? "#7FB096" : "#2F5D4B"}
      opacity="0.8"
    />
    {/* Label */}
    <text
      x="14"
      y="21"
      textAnchor="middle"
      fontSize="6"
      fontWeight="600"
      fill={isDark ? "#7FB096" : "#2F5D4B"}
    >
      250
    </text>
  </svg>
);

export const WaterCups = ({
  entries,
  targetMl,
  dailyTotal,
}: WaterCupsProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const cups: Cup[] = [];
  let extraMl = 0;

  for (const entry of entries) {
    if (dailyTotal > targetMl) break;
    const { cups: newCups, remainder } = parseCupsFromEntry(
      entry.amount_ml,
      entry.logged_at,
      cups.length,
    );
    cups.push(...newCups);
    extraMl += remainder;
  }

  /* Convert any remaining extraMl into more cups if under max 8 */
  while (extraMl >= 500 && cups.length < 8) {
    cups.push({ size: 500, timestamp: "" });
    extraMl -= 500;
  }
  while (extraMl >= 250 && cups.length < 8) {
    cups.push({ size: 250, timestamp: "" });
    extraMl -= 250;
  }

  if (cups.length === 0 && extraMl === 0) {
    return (
      <p className="text-xs text-cocoa-faded mt-2">No water logged yet today</p>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3 mt-2">
      {cups.map((cup, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          {cup.size === 500 ? (
            <Cup500 isDark={isDark} />
          ) : (
            <Cup250 isDark={isDark} />
          )}
          <span className="text-[9px] text-cocoa-faded">{cup.size}ml</span>
          {cup.timestamp && (
            <span className="text-[9px] text-cocoa-faded">
              {formatTime(cup.timestamp)}
            </span>
          )}
        </div>
      ))}

      {extraMl > 0 && (
        <div className="flex items-center self-center">
          <span className="text-sm font-semibold text-cocoa dark:text-dark-white">
            + {extraMl}ml
          </span>
        </div>
      )}
    </div>
  );
};
