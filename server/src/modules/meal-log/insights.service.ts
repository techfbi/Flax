import { pgPool } from "../../config/db.postgres.js";
import { getDashboardData } from "./meallog.service.js";
import { getWaterLogs } from "../water/water.service.js";

export type InsightsRange = "week" | "month" | "year";

interface ResolvedRange {
  start: string;
  end: string;
  granularity: "day" | "month";
}

// Pure calendar math on a caller supplied date string, never touches
// "now" directly, the client always sends its own local today, so
// this stays correct regardless of server timezone.
const resolveRange = (range: InsightsRange, endDateStr: string): ResolvedRange => {
  const end = new Date(`${endDateStr}T00:00:00Z`);

  if (range === "week") {
    const day = end.getUTCDay(); // 0 Sun .. 6 Sat
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(end);
    monday.setUTCDate(end.getUTCDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      start: monday.toISOString().split("T")[0],
      end: sunday.toISOString().split("T")[0],
      granularity: "day",
    };
  }

  if (range === "month") {
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - 29);
    return {
      start: start.toISOString().split("T")[0],
      end: endDateStr,
      granularity: "day",
    };
  }

  // year: rolling 12 months, monthly buckets
  const start = new Date(end);
  start.setUTCMonth(end.getUTCMonth() - 11);
  start.setUTCDate(1);
  return {
    start: start.toISOString().split("T")[0],
    end: endDateStr,
    granularity: "month",
  };
};

// ---------------------------------------------------------------------------
// getInsights
// One call powers the whole dashboard, calorie trend, macro trend,
// water trend, meal type totals, and most logged meals, all scoped to
// the same resolved date range so every chart on the page agrees with
// every other one.
// ---------------------------------------------------------------------------
export const getInsights = async (
  userId: string,
  range: InsightsRange,
  endDateStr: string
) => {
  const { start, end, granularity } = resolveRange(range, endDateStr);

  const trendQuery =
    granularity === "day"
      ? `SELECT
           TO_CHAR(dates.d, 'YYYY-MM-DD') AS date,
           COALESCE(SUM(ml.calories), 0)  AS calories,
           COALESCE(SUM(ml.protein_g), 0) AS protein_g,
           COALESCE(SUM(ml.carbs_g), 0)   AS carbs_g,
           COALESCE(SUM(ml.fat_g), 0)     AS fat_g
         FROM generate_series($2::date, $3::date, INTERVAL '1 day') AS dates(d)
         LEFT JOIN meal_logs ml ON ml.logged_date = dates.d AND ml.user_id = $1
         GROUP BY dates.d
         ORDER BY dates.d ASC`
      : `SELECT
           TO_CHAR(months.m, 'YYYY-MM') AS date,
           COALESCE(SUM(ml.calories), 0)  AS calories,
           COALESCE(SUM(ml.protein_g), 0) AS protein_g,
           COALESCE(SUM(ml.carbs_g), 0)   AS carbs_g,
           COALESCE(SUM(ml.fat_g), 0)     AS fat_g
         FROM generate_series(date_trunc('month', $2::date), date_trunc('month', $3::date), INTERVAL '1 month') AS months(m)
         LEFT JOIN meal_logs ml ON date_trunc('month', ml.logged_date) = months.m AND ml.user_id = $1
         GROUP BY months.m
         ORDER BY months.m ASC`;

  const trendResult = await pgPool.query(trendQuery, [userId, start, end]);

  const waterTrendQuery =
    granularity === "day"
      ? `SELECT
           TO_CHAR(dates.d, 'YYYY-MM-DD') AS date,
           COALESCE(SUM(wl.amount_ml), 0) AS amount_ml
         FROM generate_series($2::date, $3::date, INTERVAL '1 day') AS dates(d)
         LEFT JOIN water_logs wl ON wl.logged_date = dates.d AND wl.user_id = $1
         GROUP BY dates.d
         ORDER BY dates.d ASC`
      : `SELECT
           TO_CHAR(months.m, 'YYYY-MM') AS date,
           COALESCE(SUM(wl.amount_ml), 0) AS amount_ml
         FROM generate_series(date_trunc('month', $2::date), date_trunc('month', $3::date), INTERVAL '1 month') AS months(m)
         LEFT JOIN water_logs wl ON date_trunc('month', wl.logged_date) = months.m AND wl.user_id = $1
         GROUP BY months.m
         ORDER BY months.m ASC`;

  const waterTrendResult = await pgPool.query(waterTrendQuery, [userId, start, end]);

  const mealTypeResult = await pgPool.query(
    `SELECT meal_type, COALESCE(SUM(calories), 0) AS calories
     FROM meal_logs
     WHERE user_id = $1 AND logged_date BETWEEN $2 AND $3
     GROUP BY meal_type`,
    [userId, start, end]
  );

  const mostLoggedResult = await pgPool.query(
    `SELECT COALESCE(food_name, custom_name) AS name, COUNT(*) AS count
     FROM meal_logs
     WHERE user_id = $1 AND logged_date BETWEEN $2 AND $3
     GROUP BY COALESCE(food_name, custom_name)
     ORDER BY count DESC
     LIMIT 5`,
    [userId, start, end]
  );

  const targetResult = await pgPool.query(
    "SELECT calorie_target, water_target_ml FROM health_profiles WHERE user_id = $1",
    [userId]
  );
  const calorieTarget = targetResult.rows[0]?.calorie_target ?? null;
  const waterTarget = targetResult.rows[0]?.water_target_ml ?? null;

  const todayDashboard = await getDashboardData(userId, endDateStr);
  const todayWater = await getWaterLogs(userId, endDateStr);

  return {
    range,
    start_date: start,
    end_date: end,
    granularity,
    today: {
      calories: todayDashboard.daily_totals.calories,
      protein_g: todayDashboard.daily_totals.protein_g,
      carbs_g: todayDashboard.daily_totals.carbs_g,
      fat_g: todayDashboard.daily_totals.fat_g,
      calorie_target: calorieTarget,
      water_ml: todayWater.daily_total,
      water_target_ml: waterTarget,
    },
    calorie_trend: trendResult.rows.map((r) => ({
      date: r.date,
      calories: parseFloat(r.calories),
    })),
    macro_trend: trendResult.rows.map((r) => ({
      date: r.date,
      protein_g: parseFloat(r.protein_g),
      carbs_g: parseFloat(r.carbs_g),
      fat_g: parseFloat(r.fat_g),
    })),
    water_trend: waterTrendResult.rows.map((r) => ({
      date: r.date,
      amount_ml: parseFloat(r.amount_ml),
    })),
    meal_type_breakdown: Object.fromEntries(
      mealTypeResult.rows.map((r) => [r.meal_type, parseFloat(r.calories)])
    ),
    most_logged_meals: mostLoggedResult.rows.map((r) => ({
      name: r.name,
      count: parseInt(r.count, 10),
    })),
  };
};

// ---------------------------------------------------------------------------
// getStreakCalendar
// ---------------------------------------------------------------------------
export const getStreakCalendar = async (userId: string, monthStr: string) => {
  const targetResult = await pgPool.query(
    "SELECT calorie_target FROM health_profiles WHERE user_id = $1",
    [userId]
  );
  const calorieTarget = targetResult.rows[0]?.calorie_target ?? null;

  const result = await pgPool.query(
  `SELECT
     TO_CHAR(dates.d, 'YYYY-MM-DD') AS date,
     COALESCE(SUM(ml.calories), 0)  AS calories,
     hist.calorie_target            AS target_for_day
   FROM generate_series(
     date_trunc('month', $2::date),
     date_trunc('month', $2::date) + INTERVAL '1 month' - INTERVAL '1 day',
     INTERVAL '1 day'
   ) AS dates(d)
   LEFT JOIN meal_logs ml ON ml.logged_date = dates.d AND ml.user_id = $1
   LEFT JOIN calorie_target_history hist
     ON hist.user_id = $1
     AND hist.effective_from <= dates.d
     AND (hist.effective_to IS NULL OR hist.effective_to > dates.d)
   GROUP BY dates.d, hist.calorie_target
   ORDER BY dates.d ASC`,
  [userId, `${monthStr}-01`]
);

  const todayStr = new Date().toISOString().split("T")[0];

  return {
  month: monthStr,
  calorie_target: calorieTarget,
  days: result.rows.map((r) => {
    const calories = parseFloat(r.calories);
    const isFuture = r.date > todayStr;
    const targetForDay = r.target_for_day !== null ? parseInt(r.target_for_day, 10) : null;
    return {
      date: r.date,
      calories,
      met_goal: !isFuture && targetForDay ? calories >= targetForDay * 0.8 : false,
      exceeded: !isFuture && targetForDay ? calories >= targetForDay : false,
      is_future: isFuture,
    };
  }),
};
};