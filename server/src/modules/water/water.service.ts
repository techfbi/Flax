import { pgPool } from "../../config/db.postgres.js";
import { AppError } from "../../shared/errors.js";
import { updateWaterStreak } from "../streaks/streak.service.js";
import type { LogWaterInput } from "./water.schema.js";
import { getUserTimezone, isTodayOrYesterdayInTimezone } from "../../shared/date.helpers.js";

// ---------------------------------------------------------------------------
// logWater
// Adds a water intake entry. Multiple entries per day are allowed and summed for the daily total. After inserting, checks if the daily total
// has reached 80% of the user's water target and updates the water streak if so. 
// The 80% check happens here in application code rather than in SQL because we need the target value from health_profiles in the same logic.
// ---------------------------------------------------------------------------
  export const logWater = async (userId: string, input: LogWaterInput) => {
  const timezone = await getUserTimezone(userId);
  if (!isTodayOrYesterdayInTimezone(input.logged_date, timezone)) {
    throw new AppError(
      "Water can only be logged for today or yesterday",
      400,
      "VALIDATION_ERROR"
    );
  }
  const insertResult = await pgPool.query(
    `INSERT INTO water_logs (user_id, amount_ml, logged_date)
     VALUES ($1, $2, $3)
     RETURNING id, amount_ml, logged_date, logged_at`,
    [userId, input.amount_ml, input.logged_date]
  );

  // Get daily total and user water target in one query.
  const summaryResult = await pgPool.query(
  `SELECT
  COALESCE(SUM(wl.amount_ml), 0) AS daily_total,
  hist.water_target_ml
  FROM health_profiles hp
  LEFT JOIN water_logs wl
  ON hp.user_id = wl.user_id
  AND wl.logged_date = $2
  LEFT JOIN water_target_history hist
  ON hist.user_id = hp.user_id
  AND hist.effective_from <= $2::date
  AND (hist.effective_to IS NULL OR hist.effective_to > $2::date)
  WHERE hp.user_id = $1
  GROUP BY hist.water_target_ml`,
  [userId, input.logged_date]
);

  const summary = summaryResult.rows[0];
  const dailyTotal = parseInt(summary?.daily_total ?? "0", 10);
  const targetMl   = summary?.water_target_ml ?? null;

  // Check 80% threshold and update water streak if hit.
  let streakUpdated = false;
  if (targetMl && dailyTotal >= targetMl * 0.8) {
    void updateWaterStreak(userId, input.logged_date);
    streakUpdated = true;
  }

  console.log(
    `[REMOVE LOG LATER] Water logged. user. ${userId}. ` +
    `amount. ${input.amount_ml}ml. daily total. ${dailyTotal}ml. target. ${targetMl}ml`
  );

  return {
    entry: insertResult.rows[0],
    dailyTotal,
    targetMl,
    streakUpdated,
  };
};

// ---------------------------------------------------------------------------
// getWaterLogs
// Returns all water log entries for a user on a specific date,
// plus the daily total and their current target.
// ---------------------------------------------------------------------------
export const getWaterLogs = async (userId: string, date?: string) => {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  const [logsResult, summaryResult] = await Promise.all([
    pgPool.query(
      `SELECT id, amount_ml, logged_date, logged_at
       FROM water_logs
       WHERE user_id = $1 AND logged_date = $2
       ORDER BY logged_at ASC`,
      [userId, targetDate]
    ),
    pgPool.query(
      `SELECT
        COALESCE(SUM(wl.amount_ml), 0) AS daily_total,
        hist.water_target_ml
      FROM health_profiles hp
      LEFT JOIN water_logs wl
        ON wl.user_id = hp.user_id AND wl.logged_date = $2
      LEFT JOIN water_target_history hist
        ON hist.user_id = hp.user_id
        AND hist.effective_from <= $2::date
        AND (hist.effective_to IS NULL OR hist.effective_to > $2::date)
      WHERE hp.user_id = $1
      GROUP BY hist.water_target_ml`,
      [userId, targetDate]
    ),
  ]);

  const summary = summaryResult.rows[0];

  return {
    date: targetDate,
    logs: logsResult.rows,
    daily_total: parseInt(summary?.daily_total ?? "0", 10),
    target_ml: summary?.water_target_ml ?? null,
  };
};

// ---------------------------------------------------------------------------
// deleteWaterLog
// Deletes a specific water entry. user_id in WHERE prevents cross-user deletion.
// ---------------------------------------------------------------------------
export const deleteWaterLog = async (
  userId: string,
  logId: string
): Promise<void> => {
  const result = await pgPool.query(
    "DELETE FROM water_logs WHERE id = $1 AND user_id = $2",
    [logId, userId]
  );

  if (result.rowCount === 0) {
    throw new AppError("Water log not found.", 404, "LOG_NOT_FOUND");
  }
};