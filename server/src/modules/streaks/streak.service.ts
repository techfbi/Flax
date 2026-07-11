import { pgPool } from "../../config/db.postgres.js";
import { AppError } from "../../shared/errors.js";

type StreakStatus = "active" | "restorable" | "none";

// ---------------------------------------------------------------------------
// getOrCreateStreaks
// Returns the streak row for a user, creating it with zeros if it does not
// exist yet. UPSERT pattern avoids a separate insert on first use.
// ---------------------------------------------------------------------------
export const getOrCreateStreaks = async (userId: string) => {
  const result = await pgPool.query(
    `INSERT INTO streaks (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = streaks.updated_at
     RETURNING
       goal_streak, goal_streak_best, last_goal_date,
       water_streak, water_streak_best, last_water_log_date`,
    [userId]
  );

  return result.rows[0];
};

// ---------------------------------------------------------------------------
// checkAndUpdateGoalStreak
// Called after every meal log creation or deletion.
// Fetches the day's total calories and the user's calorie target.
// If total >= 80% of target, the goal streak advances for that date.
// If total drops below 80% (after a deletion), streak is NOT decremented
// because we do not penalise users for correcting a logging mistake.
// Streak only ever moves forward within a day. never backward.
// ---------------------------------------------------------------------------
export const checkAndUpdateGoalStreak = async ( userId: string, loggedDate: string ): Promise<void> => {
  // Judged against the target that was actually in effect on loggedDate,
  // not the live health_profiles value, since meals can be logged for a
  // past date and the target may have changed since then. health_profiles
  // stays the driving table so a row is always returned even if history
  // has a gap, same safe fallback as before, no target means no credit.
  const result = await pgPool.query(
    `SELECT
       COALESCE(SUM(ml.calories), 0) AS daily_calories,
       hist.calorie_target
     FROM health_profiles hp
     LEFT JOIN meal_logs ml
       ON ml.user_id = hp.user_id
       AND ml.logged_date = $2
     LEFT JOIN calorie_target_history hist
       ON hist.user_id = hp.user_id
       AND hist.effective_from <= $2::date
       AND (hist.effective_to IS NULL OR hist.effective_to > $2::date)
     WHERE hp.user_id = $1
     GROUP BY hist.calorie_target`,
    [userId, loggedDate]
  );

  const row = result.rows[0];
  const dailyCalories = parseFloat(row?.daily_calories ?? "0");
  const calorieTarget = row?.calorie_target ?? null;

  // Cannot check the goal if no calorie target is set. This happens when the user has not completed their health profile yet.
  if (!calorieTarget || calorieTarget <= 0) return;

  const hitGoal = dailyCalories >= calorieTarget * 0.8;
  if (!hitGoal) return;

  // Goal hit. update the streak using the same atomic UPSERT pattern.
  await pgPool.query(
    `INSERT INTO streaks (user_id, goal_streak, goal_streak_best, last_goal_date)
     VALUES ($1, 1, 1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       goal_streak = CASE
         WHEN streaks.last_goal_date = $2::date
           THEN streaks.goal_streak
         WHEN streaks.last_goal_date = $2::date - INTERVAL '1 day'
           THEN streaks.goal_streak + 1
         ELSE 1
       END,
       goal_streak_best = GREATEST(
         streaks.goal_streak_best,
         CASE
           WHEN streaks.last_goal_date = $2::date
             THEN streaks.goal_streak
           WHEN streaks.last_goal_date = $2::date - INTERVAL '1 day'
             THEN streaks.goal_streak + 1
           ELSE 1
         END
       ),
       last_goal_date = CASE
         WHEN streaks.last_goal_date = $2::date THEN streaks.last_goal_date
         ELSE $2::date
       END,
       updated_at = NOW()`,
    [userId, loggedDate]
  );
};

// ---------------------------------------------------------------------------
// updateWaterStreak
// Called from water.service.ts after 80% threshold is confirmed hit.
// ---------------------------------------------------------------------------
export const updateWaterStreak = async (
  userId: string,
  loggedDate: string
): Promise<void> => {
  await pgPool.query(
    `INSERT INTO streaks (user_id, water_streak, water_streak_best, last_water_log_date)
     VALUES ($1, 1, 1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       water_streak = CASE
         WHEN streaks.last_water_log_date = $2::date
           THEN streaks.water_streak
         WHEN streaks.last_water_log_date = $2::date - INTERVAL '1 day'
           THEN streaks.water_streak + 1
         ELSE 1
       END,
       water_streak_best = GREATEST(
         streaks.water_streak_best,
         CASE
           WHEN streaks.last_water_log_date = $2::date
             THEN streaks.water_streak
           WHEN streaks.last_water_log_date = $2::date - INTERVAL '1 day'
             THEN streaks.water_streak + 1
           ELSE 1
         END
       ),
       last_water_log_date = CASE
         WHEN streaks.last_water_log_date = $2::date THEN streaks.last_water_log_date
         ELSE $2::date
       END,
       updated_at = NOW()`,
    [userId, loggedDate]
  );
};

//----------------------------------------------------------------------------
// Pure date math on YYYY-MM-DD strings, both are always DATE-only so
// this is safe regardless of server timezone.
//----------------------------------------------------------------------------------
const computeStatus = (
  lastDate: string | null,
  today: string
): StreakStatus => {
  if (!lastDate) return "none";
  const diffDays = Math.round(
    (new Date(today).getTime() - new Date(lastDate).getTime()) / 86400000
  );
  if (diffDays <= 1) return "active";
  if (diffDays === 2) return "restorable";
  return "none";
};
// ---------------------------------------------------------------------------
// getStreaks
// Lazily evaluates whether each streak is still active, in its 24 hour
// restore window, or has fully expired, based on today's date rather
// than only reacting to write events. This is what actually stops a
// stale streak count from showing forever after the user stops
// logging, previous version had no path that ever reset it.
// ---------------------------------------------------------------------------
export const getStreaks = async (userId: string, today: string) => {
  const row = await getOrCreateStreaks(userId);

  const goalStatus = computeStatus(row.last_goal_date, today);
  const waterStatus = computeStatus(row.last_water_log_date, today);

  // Restore window fully closed, zero it out for good so a stale
  // number can never come back without a genuine new streak.
  if (goalStatus === "none" && row.goal_streak > 0) {
    await pgPool.query(
      "UPDATE streaks SET goal_streak = 0, updated_at = NOW() WHERE user_id = $1",
      [userId]
    );
    row.goal_streak = 0;
    }
  if (waterStatus === "none" && row.water_streak > 0) {
    await pgPool.query(
      "UPDATE streaks SET water_streak = 0, updated_at = NOW() WHERE user_id = $1",
      [userId]
    );
    row.water_streak = 0;
  }

  return {
    goal_streak: row.goal_streak,
    goal_streak_best: row.goal_streak_best,
    last_goal_date: row.last_goal_date,
    goal_streak_status: goalStatus,
    water_streak: row.water_streak,
    water_streak_best: row.water_streak_best,
    last_water_log_date: row.last_water_log_date,
    water_streak_status: waterStatus,
  };
};

// ---------------------------------------------------------------------------
// restoreStreak
// Only allowed while status is "restorable". Sets the last qualifying
// date to today, which immediately makes the streak read as active
// again on the next getStreaks call, the count itself is untouched
// since it was never zeroed during the restore window.
// ---------------------------------------------------------------------------
export const restoreStreak = async (
  userId: string,
  type: "goal" | "water",
  today: string
) => {
  const row = await getOrCreateStreaks(userId);
  const lastDate = type === "goal" ? row.last_goal_date : row.last_water_log_date;
  const status = computeStatus(lastDate, today);

  if (status !== "restorable") {
    throw new AppError(
      "This streak is not currently restorable",
      400,
      "STREAK_NOT_RESTORABLE"
    );
  }

  const column = type === "goal" ? "last_goal_date" : "last_water_log_date";
  await pgPool.query(
    `UPDATE streaks SET ${column} = $2, updated_at = NOW() WHERE user_id = $1`,
    [userId, today]
  );

  return getStreaks(userId, today);
};