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

interface CalorieChartProps {
  logs: MealLogEntry[];
}

const COLORS = {
  Calorie: "#8B5CF6",
  Protein: "#F43F5E",
  Carbs: "#06B6D4",
  Fat: "#F59E0B",
};

/*
  Meal type natural order. Regardless of when logged,
  breakfast always appears left of brunch, brunch before lunch, etc.
  Multiple logs of same meal type appear as separate points
  but all clustered under their natural position.
*/
const MEAL_ORDER: Record<string, number> = {
  breakfast: 0,
  brunch: 1,
  lunch: 2,
  dinner: 3,
  snack: 4,
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const transformLogs = (logs: MealLogEntry[]) => {
  if (!logs.length) return [];

  /* Sort by natural meal order first, then by logged time within each type */
  const sorted = [...logs].sort((a, b) => {
    const orderDiff =
      (MEAL_ORDER[a.meal_type] ?? 99) - (MEAL_ORDER[b.meal_type] ?? 99);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return sorted.map((log) => ({
    name: log.meal_type.charAt(0).toUpperCase() + log.meal_type.slice(1),
    Calorie: Math.round(log.calories),
    Protein: Math.round(log.protein_g),
    Carbs: Math.round(log.carbs_g),
    Fat: Math.round(log.fat_g),
    foodName: log.food_name ?? log.custom_name ?? "Custom meal",
    time: formatTime(log.created_at),
  }));
};

/* Custom tooltip showing food name, time, and all macro values */
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload || !payload.length) return null;

  const foodName = (payload[0] as unknown as { payload: { foodName: string } })
    ?.payload?.foodName;
  const time = (payload[0] as unknown as { payload: { time: string } })?.payload
    ?.time;

  return (
    <div
      className="bg-[rgba(15,15,15,0.92)] rounded-xl px-4 py-3 shadow-xl
      border border-white/10 min-w-[160px]"
    >
      {/* Meal type */}
      <p className="text-[11px] font-semibold text-white/60 mb-0.5 uppercase tracking-wide">
        {label}
      </p>
      {/* Food name */}
      {foodName && (
        <p className="text-sm font-semibold text-white mb-0.5">{foodName}</p>
      )}
      {/* Time logged */}
      {time && <p className="text-[11px] text-white/50 mb-2">{time}</p>}
      {/* Macro values */}
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
            {entry.value}g
          </span>
        </div>
      ))}
    </div>
  );
};

export const CalorieChart = ({ logs }: CalorieChartProps) => {
  const chartData = transformLogs(logs);

  const displayData =
    chartData.length > 0
      ? chartData
      : [
          {
            name: "Breakfast",
            Calorie: 0,
            Protein: 0,
            Carbs: 0,
            Fat: 0,
            foodName: "",
            time: "",
          },
          {
            name: "Brunch",
            Calorie: 0,
            Protein: 0,
            Carbs: 0,
            Fat: 0,
            foodName: "",
            time: "",
          },
          {
            name: "Lunch",
            Calorie: 0,
            Protein: 0,
            Carbs: 0,
            Fat: 0,
            foodName: "",
            time: "",
          },
          {
            name: "Dinner",
            Calorie: 0,
            Protein: 0,
            Carbs: 0,
            Fat: 0,
            foodName: "",
            time: "",
          },
          {
            name: "Snack",
            Calorie: 0,
            Protein: 0,
            Carbs: 0,
            Fat: 0,
            foodName: "",
            time: "",
          },
        ];

  const maxValue = Math.max(
    ...displayData.flatMap((d) => [d.Calorie, d.Protein, d.Carbs, d.Fat]),
  );
  const yDomain: [number, number] =
    maxValue > 0 ? [0, Math.ceil(maxValue * 1.15)] : [0, 100];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart
        data={displayData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
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

        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "rgba(156,163,175,0.8)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={yDomain}
          tick={{ fontSize: 10, fill: "rgba(156,163,175,0.8)" }}
          axisLine={false}
          tickLine={false}
          tickCount={6}
          label={{
            value: "gram",
            angle: -90,
            position: "insideLeft",
            fontSize: 10,
            fill: "rgba(156,163,175,0.8)",
          }}
        />

        <Tooltip content={<CustomTooltip />} />

        <Legend
          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          iconType="circle"
          iconSize={8}
        />

        {Object.entries(COLORS).map(([key, color]) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${key.toLowerCase()})`}
            dot={{ r: 3, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: color }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};
