import { pgPool } from "../../config/db.postgres.js";
import { claimDailyEvent } from "./notification.model.js";
import { notifyUser } from "./notification.service.js";
import { getDashboardData } from "../meal-log/meallog.service.js";
import { getWaterLogs } from "../water/water.service.js";
import { getStreaks } from "../streaks/streak.service.js";

/*
  Event checkers. Each one runs per active user, per user's own local
  time, decided by the runScheduledChecks loop below. Every event is
  gated by claimDailyEvent so it can only fire once per user per day
  even if the scheduler tick overlaps or the server restarts mid day.
*/

const checkNoMealLogged = async (userId: string, localDate: string, localHour: number) => {
  if (localHour !== 11) return;
  const dashboard = await getDashboardData(userId, localDate);
  if (dashboard.daily_totals.calories > 0) return;

  const claimed = await claimDailyEvent(userId, "no_meal_logged", localDate);
  if (!claimed) return;

  await notifyUser(
    userId,
    "no_meal_logged",
    "No meal logged yet",
    "You haven't logged a meal yet today. A quick breakfast log keeps your streak alive.",
    "/"
  );
};

const checkEveningTarget = async (userId: string, localDate: string, localHour: number) => {
  if (localHour !== 18) return;
  const dashboard = await getDashboardData(userId, localDate);
  if (!dashboard.calorie_target) return;
  const pct = Math.round((dashboard.daily_totals.calories / dashboard.calorie_target) * 100);
  if (pct >= 50) return;

  const claimed = await claimDailyEvent(userId, "evening_target", localDate);
  if (!claimed) return;

  await notifyUser(
    userId,
    "evening_target",
    "Evening check in",
    `You're at ${pct}% of today's calorie goal. Still time for dinner.`,
    "/"
  );
};

const checkWaterGap = async (userId: string, localDate: string, localHour: number) => {
  if (localHour < 9 || localHour > 21) return;

  const water = await getWaterLogs(userId, localDate);
  if (water.logs.length === 0) return; // first log of the day handled by "no meal" style nudge, not this one

  const lastLog = water.logs[water.logs.length - 1];
  const hoursSinceLastLog = (Date.now() - new Date(lastLog.logged_at).getTime()) / 3600000;
  if (hoursSinceLastLog < 4) return;

  // Only once every 4 hour window, keyed by the hour bucket so it can
  // still fire more than once a day without spamming every tick.
  const bucket = `water_gap_${Math.floor(localHour / 4)}`;
  const claimed = await claimDailyEvent(userId, bucket, localDate);
  if (!claimed) return;

  await notifyUser(
    userId,
    "water_gap",
    "Stay hydrated",
    "It's been a few hours since your last glass of water.",
    "/"
  );
};

const checkStreakAtRisk = async (userId: string, localDate: string, localHour: number) => {
  if (localHour !== 20) return;
  const streaks = await getStreaks(userId, localDate);
  if (streaks.goal_streak_status !== "active" || streaks.goal_streak === 0) return;
  if (streaks.last_goal_date === localDate) return; // already logged today, no risk

  const claimed = await claimDailyEvent(userId, "streak_at_risk", localDate);
  if (!claimed) return;

  await notifyUser(
    userId,
    "streak_at_risk",
    "Streak at risk",
    `Your ${streaks.goal_streak} day streak ends at midnight if you don't log today.`,
    "/"
  );
};

// ---------------------------------------------------------------------------
// runScheduledChecks
// Called on an interval by the scheduler. Loops every user who has a
// timezone on record (users the client has reported a timezone for),
// computes that user's current local date and hour, and runs each
// checker. Users without a timezone are skipped rather than guessed
// at with server UTC, a wrong guess is worse than no notification.
// ---------------------------------------------------------------------------
export const runScheduledChecks = async (): Promise<void> => {
  const result = await pgPool.query(
    "SELECT id, timezone FROM users WHERE timezone IS NOT NULL"
  );

  for (const user of result.rows) {
    try {
      const now = new Date();
      const localParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: user.timezone,
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
      }).formatToParts(now);

      const localDate = `${localParts.find((p) => p.type === "year")!.value}-${localParts.find((p) => p.type === "month")!.value}-${localParts.find((p) => p.type === "day")!.value}`;
      const localHour = parseInt(localParts.find((p) => p.type === "hour")!.value, 10);

      await checkNoMealLogged(user.id, localDate, localHour);
      await checkEveningTarget(user.id, localDate, localHour);
      await checkWaterGap(user.id, localDate, localHour);
      await checkStreakAtRisk(user.id, localDate, localHour);
    } catch (err) {
      console.error(`[notifications] check failed for user ${user.id}`, err);
      // one user's failure should never stop the rest of the loop
    }
  }
};