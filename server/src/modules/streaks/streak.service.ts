import { pgPool } from "../../config/db.postgres.js";

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
  // Get today's calorie total and the user's calorie target in one query.
  const result = await pgPool.query(
    `SELECT
       COALESCE(SUM(ml.calories), 0) AS daily_calories,
       hp.calorie_target
     FROM health_profiles hp
     LEFT JOIN meal_logs ml
       ON ml.user_id = hp.user_id
       AND ml.logged_date = $2
     WHERE hp.user_id = $1
     GROUP BY hp.calorie_target`,
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

// ---------------------------------------------------------------------------
// getStreaks
// ---------------------------------------------------------------------------
export const getStreaks = async (userId: string) => {
  return getOrCreateStreaks(userId);
};