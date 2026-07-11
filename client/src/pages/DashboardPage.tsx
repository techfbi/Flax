import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageTopBar } from "@/components/layout/PageTopBar";
import { MobileTopNav } from "@/components/layout/MobileTopNav";
import { useTheme } from "@/context/ThemeContext";
import { getLocalDateStr } from "@/lib/date";
import api from "@/lib/api";
import type {
  ApiResponse,
  InsightsData,
  StreakCalendarData,
} from "@/types/apiTypes";

/*
  Dashboard. Trends over time, no right panel, this page is the one
  place in the app dedicated entirely to looking back rather than
  logging something new.

  Brand colors only: moringa for calories, moringa-faded for water
  (staying in the green family rather than introducing blue), and
  moringa/pawpaw/cocoa for the three macro lines, since those are the
  only distinct tokens already in the palette. No pie chart anywhere,
  meal type breakdown is a bar list instead. Every line is smooth
  (monotone), not sharp.
*/

type Range = "week" | "month" | "year";

const COLORS = {
  moringa: "#2F5D4B",
  moringaFaded: "#7FB096",
  pawpaw: "#E8623C",
  cocoa: "#1C1A17",
  darkWhite: "#E5E7EB",
  blackPawpaw: "#F08959",
};

const formatTrendLabel = (date: string, granularity: "day" | "month") => {
  if (granularity === "month") {
    return new Date(`${date}-01T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
    });
  }
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
};

const RangeToggle = ({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) => (
  <div className="flex bg-cocoa/5 dark:bg-dark-white/5 rounded-full p-1 w-fit">
    {(["week", "month", "year"] as const).map((r) => (
      <button
        key={r}
        onClick={() => onChange(r)}
        className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors
          ${value === r ? "bg-moringa dark:bg-moringa-faded text-surface" : "text-cocoa/60 dark:text-dark-white/60"}`}
      >
        {r}
      </button>
    ))}
  </div>
);

const ChartCard = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-heading font-bold text-sm text-cocoa dark:text-dark-white">
        {title}
      </h2>
      {action}
    </div>
    {children}
  </div>
);

export const DashboardPage = () => {
  const { resolvedTheme } = useTheme();
  const [range, setRange] = useState<Range>("week");
  const [waterRange, setWaterRange] = useState<Range>("week");
  const [calendarMonth, setCalendarMonth] = useState(() =>
    getLocalDateStr().slice(0, 7),
  );

  const isDark = resolvedTheme === "dark";
  const axisColor = isDark ? "#9CA3AF" : "#8A8479";
  const gridColor = isDark ? "rgba(229,231,235,0.06)" : "rgba(28,26,23,0.06)";

  // Calendar heatmap with tiers + celebration mark
  const getDayFill = (day: StreakCalendarData["days"][number]) => {
    if (day.is_future || day.calories === 0) {
      return { bg: "transparent", met: false, exceeded: false };
    }
    if (day.met_goal) {
      return {
        bg: isDark ? COLORS.moringaFaded : COLORS.moringa,
        met: true,
        exceeded: day.exceeded,
      };
    }
    // logged something, 80 percent not reached, one flat faint fill
    return {
      bg: isDark ? "rgba(127,176,150,0.18)" : "rgba(47,93,75,0.12)",
      met: false,
      exceeded: false,
    };
  };

  const {
    data: insights,
    isLoading: insightsLoading,
    isFetching: insightsFetching,
  } = useQuery({
    queryKey: ["insights", range, getLocalDateStr()],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ insights: InsightsData }>>(
        `/api/meal-logs/insights?range=${range}&end_date=${getLocalDateStr()}`,
      );
      return data.data.insights;
    },
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const { data: waterInsights, isFetching: waterFetching } = useQuery({
    queryKey: ["insights", waterRange, getLocalDateStr(), "water-only"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ insights: InsightsData }>>(
        `/api/meal-logs/insights?range=${waterRange}&end_date=${getLocalDateStr()}`,
      );
      return data.data.insights;
    },
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const { data: calendar } = useQuery({
    queryKey: ["streak-calendar", calendarMonth],
    queryFn: async () => {
      const { data } = await api.get<
        ApiResponse<{ calendar: StreakCalendarData }>
      >(`/api/meal-logs/streak-calendar?month=${calendarMonth}`);
      return data.data.calendar;
    },
    staleTime: 5 * 60 * 1000,
  });

  const shiftCalendarMonth = (delta: number) => {
    const [y, m] = calendarMonth.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1 + delta, 1));
    const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
    if (nextStr > getLocalDateStr().slice(0, 7)) return;
    setCalendarMonth(nextStr);
  };

  const caloriePct = insights?.today.calorie_target
    ? Math.min(
        100,
        Math.round(
          (insights.today.calories / insights.today.calorie_target) * 100,
        ),
      )
    : 0;
  const waterPct = insights?.today.water_target_ml
    ? Math.min(
        100,
        Math.round(
          (insights.today.water_ml / insights.today.water_target_ml) * 100,
        ),
      )
    : 0;

  const macroBars = [
    {
      label: "Protein",
      value: insights?.today.protein_g ?? 0,
      color: COLORS.moringa,
    },
    {
      label: "Carbs",
      value: insights?.today.carbs_g ?? 0,
      color: COLORS.pawpaw,
    },
    {
      label: "Fat",
      value: insights?.today.fat_g ?? 0,
      color: isDark ? COLORS.darkWhite : COLORS.cocoa,
    },
  ];
  const maxMacro = Math.max(...macroBars.map((m) => m.value), 1);

  const mealTypeEntries = Object.entries(
    insights?.meal_type_breakdown ?? {},
  ).sort((a, b) => b[1] - a[1]);
  const maxMealTypeCalories = Math.max(...mealTypeEntries.map(([, v]) => v), 1);

  const maxMostLogged = Math.max(
    ...(insights?.most_logged_meals.map((m) => m.count) ?? [1]),
    1,
  );

  const monthLabel = new Date(
    `${calendarMonth}-01T00:00:00Z`,
  ).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <AppLayout>
      <div
        className="flex flex-col h-screen overflow-hidden"
        style={{
          background: isDark
            ? "linear-gradient(180deg, #3E4E42 -10%, #2D342C 4%, #2D342C 10%, #171410 45%)"
            : "linear-gradient(170deg, #9DAFA1 15%, #EAE8DE 45%, #EAE8DE 30%, #F6F1E7 100%)",
        }}
      >
        <div className="flex-1 flex flex-col min-h-0 w-full max-w-[1700px] mx-auto overflow-hidden">
          <PageTopBar title="Dashboard" showSearch={false} />
          <div className="md:hidden shrink-0">
            <MobileTopNav />
          </div>

          <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 pt-[75px] md:pt-5 lg:pt-2 pb-8">
            <p className="md:hidden pl-1 pb-5 font-heading font-bold text-base tracking-wide text-cocoa/70 dark:text-dark-white/70 shrink-0">
              Dashboard
            </p>
            {insightsLoading && !insights ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-moringa dark:border-moringa-faded border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !insights ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-center text-sm text-cocoa-faded ">
                  Couldn't load your dashboard. Check your connection.
                </p>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto space-y-5">
                {/* Today snapshot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
                    <p className="text-xs font-semibold text-cocoa-faded mb-3">
                      Today's calories
                    </p>
                    <div className="flex items-end justify-between mb-2">
                      <p className="font-heading font-bold text-base md:text-xl lg:text-2xl text-cocoa dark:text-dark-white">
                        {Math.round(insights.today.calories)}
                        <span className="text-sm font-normal text-cocoa-faded">
                          {" "}
                          / {insights.today.calorie_target ?? "—"} kcal
                        </span>
                      </p>
                      <p className="text-sm font-semibold text-moringa dark:text-moringa-faded">
                        {caloriePct}%
                      </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-cocoa/10 dark:bg-dark-white/10">
                      <div
                        className="h-full rounded-full bg-moringa dark:bg-moringa-faded transition-all"
                        style={{ width: `${caloriePct}%` }}
                      />
                    </div>

                    <div className="flex gap-4 mt-4">
                      {macroBars.map((m) => (
                        <div key={m.label} className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-cocoa-faded">
                              {m.label}
                            </span>
                            <span className="text-[11px] font-medium text-cocoa dark:text-dark-white">
                              {Math.round(m.value)}g
                            </span>
                          </div>
                          <div className="h-1 rounded-full bg-cocoa/10 dark:bg-dark-white/10">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(m.value / maxMacro) * 100}%`,
                                backgroundColor: m.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-surface-two dark:bg-black-surface rounded-2xl p-5">
                    <p className="text-xs font-semibold text-cocoa-faded mb-3">
                      Today's water
                    </p>
                    <div className="flex items-end justify-between mb-2">
                      <p className="font-heading font-bold text-base md:text-xl lg:text-2xl text-cocoa dark:text-dark-white">
                        {insights.today.water_ml}
                        <span className="text-sm font-normal text-cocoa-faded">
                          {" "}
                          / {insights.today.water_target_ml ?? "—"} ml
                        </span>
                      </p>
                      <p className="text-sm font-semibold text-moringa dark:text-moringa-faded">
                        {waterPct}%
                      </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-cocoa/10 dark:bg-dark-white/10">
                      <div
                        className="h-full rounded-full bg-moringa-faded transition-all"
                        style={{ width: `${waterPct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-cocoa-faded mt-4">
                      Consistency here is what keeps your water streak alive,
                      aim for steady sips through the day rather than one big
                      catch up.
                    </p>
                  </div>
                </div>

                {/* Calorie trend */}
                <ChartCard
                  title="Calorie trend"
                  action={<RangeToggle value={range} onChange={setRange} />}
                >
                  <div
                    className={`transition-opacity duration-200 ${insightsFetching ? "opacity-40" : "opacity-100"}`}
                  >
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart
                        data={insights.calorie_trend}
                        margin={{ top: 5, right: 8, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="calorieFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={COLORS.moringa}
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="100%"
                              stopColor={COLORS.moringa}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={gridColor} vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) =>
                            formatTrendLabel(d, insights.granularity)
                          }
                          tick={{ fontSize: 10, fill: axisColor }}
                          axisLine={false}
                          tickLine={false}
                          interval={
                            insights.granularity === "day"
                              ? Math.floor(insights.calorie_trend.length / 6)
                              : 0
                          }
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: axisColor }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                        />
                        <Tooltip
                          contentStyle={{
                            background: isDark ? "#221E18" : "#FFFFFF",
                            border: "none",
                            borderRadius: 10,
                            fontSize: 12,
                          }}
                          labelFormatter={(d) =>
                            formatTrendLabel(String(d), insights.granularity)
                          }
                        />
                        {insights.today.calorie_target && (
                          <ReferenceLine
                            y={insights.today.calorie_target}
                            stroke={isDark ? COLORS.blackPawpaw : COLORS.pawpaw}
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="calories"
                          stroke={isDark ? COLORS.moringaFaded : COLORS.moringa}
                          strokeWidth={2}
                          fill="url(#calorieFill)"
                          dot={{
                            r: 2,
                            fill: isDark ? COLORS.moringaFaded : COLORS.moringa,
                            strokeWidth: 0,
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>

                    <hr className="my-5 md:my-7 lg:my-10 border-t border-gray-300 dark:border-gray-600" />

                    {/* Macro trend */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-heading font-bold text-sm text-cocoa dark:text-dark-white">
                          Macro trend
                        </h2>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart
                          data={insights.macro_trend}
                          margin={{ top: 5, right: 8, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid stroke={gridColor} vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(d) =>
                              formatTrendLabel(d, insights.granularity)
                            }
                            tick={{ fontSize: 10, fill: axisColor }}
                            axisLine={false}
                            tickLine={false}
                            interval={
                              insights.granularity === "day"
                                ? Math.floor(insights.macro_trend.length / 6)
                                : 0
                            }
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: axisColor }}
                            axisLine={false}
                            tickLine={false}
                            width={40}
                          />
                          <Tooltip
                            contentStyle={{
                              background: isDark ? "#221E18" : "#FFFFFF",
                              border: "none",
                              borderRadius: 10,
                              fontSize: 12,
                            }}
                            labelFormatter={(d) =>
                              formatTrendLabel(String(d), insights.granularity)
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="protein_g"
                            name="Protein"
                            stroke={
                              isDark ? COLORS.moringaFaded : COLORS.moringa
                            }
                            strokeWidth={2}
                            dot={{
                              r: 2,
                              fill: isDark
                                ? COLORS.moringaFaded
                                : COLORS.moringa,
                              strokeWidth: 0,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="carbs_g"
                            name="Carbs"
                            stroke={isDark ? COLORS.blackPawpaw : COLORS.pawpaw}
                            strokeWidth={2}
                            dot={{
                              r: 2,
                              fill: isDark ? COLORS.blackPawpaw : COLORS.pawpaw,
                              strokeWidth: 0,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="fat_g"
                            name="Fat"
                            stroke={isDark ? COLORS.darkWhite : COLORS.cocoa}
                            strokeWidth={1.5}
                            strokeOpacity={0.6}
                            dot={{
                              r: 1.5,
                              fill: isDark ? COLORS.darkWhite : COLORS.cocoa,
                              strokeWidth: 0,
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="flex gap-4 mt-2 justify-center">
                        {["Protein", "Carbs", "Fat"].map((label, i) => (
                          <div
                            key={label}
                            className="flex items-center gap-1.5"
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor: [
                                  isDark ? COLORS.moringaFaded : COLORS.moringa,
                                  isDark ? COLORS.blackPawpaw : COLORS.pawpaw,
                                  isDark ? COLORS.darkWhite : COLORS.cocoa,
                                ][i],
                              }}
                            />
                            <span className="text-[11px] text-cocoa-faded">
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </ChartCard>

                {/* Water trend */}
                <ChartCard
                  title="Water trend"
                  action={
                    <RangeToggle value={waterRange} onChange={setWaterRange} />
                  }
                >
                  <div
                    className={`transition-opacity duration-200 ${waterFetching ? "opacity-40" : "opacity-100"}`}
                  >
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={waterInsights?.water_trend ?? []}
                        margin={{ top: 5, right: 8, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid stroke={gridColor} vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) =>
                            formatTrendLabel(
                              d,
                              waterInsights?.granularity ?? "day",
                            )
                          }
                          tick={{ fontSize: 10, fill: axisColor }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: axisColor }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                        />
                        <Tooltip
                          cursor={{ fill: "transparent" }}
                          contentStyle={{
                            background: isDark ? "#221E18" : "#FFFFFF",
                            border: "none",
                            borderRadius: 10,
                            fontSize: 12,
                          }}
                        />
                        {insights.today.water_target_ml && (
                          <ReferenceLine
                            y={insights.today.water_target_ml}
                            stroke={isDark ? COLORS.blackPawpaw : COLORS.pawpaw}
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                          />
                        )}
                        <Bar
                          dataKey="amount_ml"
                          name="ml logged"
                          fill={COLORS.moringaFaded}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Meal type breakdown, bar list, no pie */}
                  <ChartCard title="Where your calories come from">
                    {mealTypeEntries.length === 0 ? (
                      <p className="text-sm text-cocoa-faded py-6 text-center">
                        No meals logged in this range
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {mealTypeEntries.map(([type, calories]) => (
                          <div key={type}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-cocoa dark:text-dark-white capitalize">
                                {type}
                              </span>
                              <span className="text-xs font-medium text-cocoa dark:text-dark-white">
                                {Math.round(calories)} kcal
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-cocoa/10 dark:bg-dark-white/10">
                              <div
                                className="h-full rounded-full bg-moringa dark:bg-moringa-faded transition-all"
                                style={{
                                  width: `${(calories / maxMealTypeCalories) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ChartCard>

                  {/* Most logged meals */}
                  <ChartCard title="Meals you log most">
                    {!insights.most_logged_meals ||
                    insights.most_logged_meals.length === 0 ? (
                      <p className="text-sm text-cocoa-faded py-6 text-center">
                        No meals logged in this range
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {insights.most_logged_meals.map((meal, i) => (
                          <div
                            key={meal.name}
                            className="flex items-center gap-3"
                          >
                            <span className="w-4 text-xs font-semibold text-cocoa-faded shrink-0">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-cocoa dark:text-dark-white truncate">
                                  {meal.name}
                                </span>
                                <span className="text-[11px] text-cocoa-faded shrink-0 ml-2">
                                  {meal.count}x
                                </span>
                              </div>
                              <div className="h-1 rounded-full bg-cocoa/10 dark:bg-dark-white/10">
                                <div
                                  className="h-full rounded-full bg-pawpaw dark:bg-black-pawpaw transition-all"
                                  style={{
                                    width: `${(meal.count / maxMostLogged) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ChartCard>
                </div>

                {/* Streak calendar */}
                <ChartCard
                  title="Calorie goal calendar"
                  action={
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => shiftCalendarMonth(-1)}
                        aria-label="Previous month"
                        className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-cocoa/5 dark:hover:bg-dark-white/5"
                      >
                        <ChevronLeft
                          size={14}
                          className="text-cocoa dark:text-dark-white"
                        />
                      </button>
                      <span className="text-xs text-cocoa-faded w-24 text-center">
                        {monthLabel}
                      </span>
                      <button
                        onClick={() => shiftCalendarMonth(1)}
                        aria-label="Next month"
                        disabled={
                          calendarMonth === getLocalDateStr().slice(0, 7)
                        }
                        className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-cocoa/5 dark:hover:bg-dark-white/5 disabled:opacity-30"
                      >
                        <ChevronRight
                          size={14}
                          className="text-cocoa dark:text-dark-white"
                        />
                      </button>
                    </div>
                  }
                >
                  {calendar ? (
                    <div className="grid grid-cols-7 gap-1.5">
                      {calendar.days.map((day) => {
                        const fill = getDayFill(day);
                        return (
                          <div
                            key={day.date}
                            title={`${day.date}: ${Math.round(day.calories)} kcal`}
                            className="relative aspect-square rounded-md flex items-center justify-center text-[10px]"
                            style={{
                              backgroundColor: fill.bg,
                              color: fill.met ? "#FFFFFF" : axisColor,
                              border: day.is_future
                                ? `1px dashed ${gridColor}`
                                : "none",
                            }}
                          >
                            {new Date(`${day.date}T00:00:00Z`).getUTCDate()}
                            {fill.exceeded && (
                              <span className="absolute -top-1 -right-1 text-[10px] lg:text-[20px]">
                                🎉
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-32 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-moringa dark:border-moringa-faded border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <p className="text-[11px] text-cocoa-faded mt-3">
                    Filled squares are days you reached 80% or more of your
                    calorie target. Faded squares are days when target isn't
                    met.
                  </p>
                </ChartCard>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
