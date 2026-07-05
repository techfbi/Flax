import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MealLogEntry } from "@/types/apiTypes";
import { useEffect, useState } from "react";

interface CalorieChartProps {
  logs: MealLogEntry[];
}

const COLORS = {
  Calorie: "#7FB096",
  Protein: "#F43F5E",
  Carbs: "#8B5CF6",
  Fat: "#F59E0B",
};

const MEAL_ORDER: Record<string, number> = {
  breakfast: 0,
  brunch: 1,
  lunch: 2,
  dinner: 3,
  snack: 4,
};

const formatTime = (iso: string) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const transformLogs = (logs: MealLogEntry[]) => {
  /* Sort by natural meal order, then by time within each type */
  const sorted = [...logs].sort((a, b) => {
    const orderDiff =
      (MEAL_ORDER[a.meal_type] ?? 99) - (MEAL_ORDER[b.meal_type] ?? 99);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  /*
    Each data point gets a unique xKey so Recharts can distinguish them.
    Format: "Breakfast (1)", "Breakfast (2)", etc.
    The X axis tick formatter strips the index so only "Breakfast" shows.
    This fixes the hover bug where all same-name points showed first item's data.
  */
  const typeCount: Record<string, number> = {};
  return sorted.map((log) => {
    const displayName =
      log.meal_type.charAt(0).toUpperCase() + log.meal_type.slice(1);
    typeCount[log.meal_type] = (typeCount[log.meal_type] ?? 0) + 1;
    const count = typeCount[log.meal_type];
    const xKey = count > 1 ? `${displayName} (${count})` : displayName;

    return {
      xKey,
      displayName,
      Calorie: Math.round(log.calories),
      Protein: Math.round(log.protein_g),
      Carbs: Math.round(log.carbs_g),
      Fat: Math.round(log.fat_g),
      foodName: log.food_name ?? log.custom_name ?? "Custom meal",
      time: formatTime(log.created_at),
    };
  });
};

/*
  Round up to a clean ceiling for Y axis max.
  e.g. 347 -> 400, 82 -> 100, 155 -> 200.
  Makes the top tick always land on a round number so the
  highest logged value visually leads at the top of the axis.
*/
const cleanCeil = (val: number): number => {
  if (val <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
  return Math.ceil(val / magnitude) * magnitude;
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: Record<string, unknown>;
  }>;
  label?: string;
}) => {
  if (!active || !payload || !payload.length) return null;

  const foodName = payload[0]?.payload?.foodName as string | undefined;
  const time = payload[0]?.payload?.time as string | undefined;
  const display = payload[0]?.payload?.displayName as string | undefined;

  return (
    <div
      className="bg-[rgba(15,15,15,0.92)] rounded-xl px-4 py-3 shadow-xl
      border border-white/10 min-w-[160px]"
    >
      {/* Show the clean meal type name, not the internal xKey */}
      <p
        className="text-[11px] font-semibold text-white/60 mb-0.5
        uppercase tracking-wide"
      >
        {display ?? label}
      </p>
      {foodName && (
        <p className="text-sm font-semibold text-white mb-0.5">{foodName}</p>
      )}
      {time && <p className="text-[11px] text-white/50 mb-2">{time}</p>}
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[11px] text-white/70">{entry.name}</span>
          </div>
          <span className="text-[11px] font-semibold text-white">
            {entry.value}
            {entry.name === "Calorie" ? " kcal" : "g"}
          </span>
        </div>
      ))}
    </div>
  );
};

export const CalorieChart = ({ logs }: CalorieChartProps) => {
  //------------------------------------------------------------------
  // detect mobile screens
  const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    useEffect(() => {
      const onResize = () => setIsMobile(window.innerWidth < 640);

      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, []);

    return isMobile;
  };
  const isMobile = useIsMobile();
  //-------------------------------------------------------------------------
  const chartData = transformLogs(logs);

  const displayData =
    chartData.length > 0
      ? chartData
      : [
          {
            xKey: "Breakfast",
            displayName: "Breakfast",
            Calorie: 0,
            Protein: 0,
            Carbs: 0,
            Fat: 0,
            foodName: "",
            time: "",
          },
          {
            xKey: "Brunch",
            displayName: "Brunch",
            Calorie: 0,
            Protein: 0,
            Carbs: 0,
            Fat: 0,
            foodName: "",
            time: "",
          },
          {
            xKey: "Lunch",
            displayName: "Lunch",
            Calorie: 0,
            Protein: 0,
            Carbs: 0,
            Fat: 0,
            foodName: "",
            time: "",
          },
          {
            xKey: "Dinner",
            displayName: "Dinner",
            Calorie: 0,
            Protein: 0,
            Carbs: 0,
            Fat: 0,
            foodName: "",
            time: "",
          },
          {
            xKey: "Snack",
            displayName: "Snack",
            Calorie: 0,
            Protein: 0,
            Carbs: 0,
            Fat: 0,
            foodName: "",
            time: "",
          },
        ];

  /* Calorie axis: clean rounded ceiling so highest value leads at top */
  const maxCal = Math.max(...displayData.map((d) => d.Calorie), 1);
  const calMax = cleanCeil(maxCal);
  const calDomain: [number, number] = [0, calMax];

  /* Macro axis: same clean ceiling pattern */
  const maxMacro = Math.max(
    ...displayData.flatMap((d) => [d.Protein, d.Carbs, d.Fat]),
    1,
  );
  const macroMax = cleanCeil(maxMacro);
  const macroDomain: [number, number] = [0, macroMax];

  return (
    <div>
      {/* gram/kcal label above chart */}
      <div className="max-w-[97%] mx-auto flex mb-1 justify-between">
        <p
          className="text-[10px] text-cocoa/50 dark:text-dark-white/40
         "
        >
          gram / kcal
        </p>
        <p
          className="text-[10px] text-cocoa/50 dark:text-dark-white/40
         "
        >
          g
        </p>
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <AreaChart
          data={displayData}
          margin={{ top: isMobile ? 2 : 10, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            {Object.entries(COLORS).map(([key, color]) => (
              <linearGradient
                key={key}
                id={`grad-${key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(156,163,175,0.15)"
            vertical={false}
          />

          {/*
            X axis uses xKey (unique per point) as the data key.
            Tick formatter strips the " (N)" suffix so users see
            clean meal type names on the axis.
          */}
          <XAxis
            dataKey="xKey"
            tick={{
              fontSize: isMobile ? 8 : 10,
              fill: "rgba(156,163,175,0.8)",
            }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => String(val).replace(/ \(\d+\)$/, "")}
          />

          {/* Left Y axis: calorie scale */}
          <YAxis
            yAxisId="cal"
            domain={calDomain}
            tick={{ fontSize: isMobile ? 9 : 11, fill: COLORS.Calorie }}
            axisLine={false}
            tickLine={false}
            tickCount={5}
            width={30}
            label={{
              value: "",
              position: "insideTop",
              offset: -8,
              fontSize: 9,
              fill: COLORS.Calorie,
            }}
          />

          {/* Right Y axis: macro scale */}
          <YAxis
            yAxisId="macro"
            orientation="right"
            domain={macroDomain}
            tick={{
              fontSize: isMobile ? 9 : 11,
              fill: "rgba(156,163,175,0.7)",
            }}
            axisLine={false}
            tickLine={false}
            tickCount={5}
            width={25}
            label={{
              value: "",
              position: "insideTop",
              offset: -8,
              fontSize: 9,
              fill: "rgba(156,163,175,0.7)",
            }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{
              fontSize: "12px",
              paddingTop: "8px",
            }}
            iconType="circle"
            iconSize={isMobile ? 6 : 8}
          />

          <Area
            yAxisId="cal"
            type="monotone"
            dataKey="Calorie"
            stroke={COLORS.Calorie}
            strokeWidth={2}
            fill="url(#grad-Calorie)"
            dot={{ r: isMobile ? 4 : 5, fill: COLORS.Calorie, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: COLORS.Calorie }}
          />

          {(["Protein", "Carbs", "Fat"] as const).map((key) => (
            <Area
              key={key}
              yAxisId="macro"
              type="monotone"
              dataKey={key}
              stroke={COLORS[key]}
              strokeWidth={0.5}
              fill={`url(#grad-${key})`}
              dot={{ r: isMobile ? 2 : 3, fill: COLORS[key], strokeWidth: 0 }}
              activeDot={{ r: 5, fill: COLORS[key] }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
