import { pgPool } from "../../config/db.postgres.js";

const DAILY_SCAN_LIMIT = 3;

// Atomic claim, the WHERE clause on the update branch means this can
// never race two simultaneous requests into both succeeding past the
// limit, the database enforces it, not application logic checking
// then incrementing in two separate steps.
export const claimScanUsage = async (
  userId: string,
  localDate: string,
): Promise<boolean> => {
  const result = await pgPool.query(
    `INSERT INTO meal_scan_usage (user_id, scan_date, count)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id, scan_date)
     DO UPDATE SET count = meal_scan_usage.count + 1
     WHERE meal_scan_usage.count < $3
     RETURNING count`,
    [userId, localDate, DAILY_SCAN_LIMIT],
  );
  return (result.rowCount ?? 0) > 0;
};

export const refundScanUsage = async (
  userId: string,
  localDate: string,
): Promise<void> => {
  await pgPool.query(
    `UPDATE meal_scan_usage SET count = GREATEST(count - 1, 0) WHERE user_id = $1 AND scan_date = $2`,
    [userId, localDate],
  );
};

export const getScanUsage = async (
  userId: string,
  localDate: string,
): Promise<{ used: number; remaining: number; limit: number }> => {
  const result = await pgPool.query(
    `SELECT count FROM meal_scan_usage WHERE user_id = $1 AND scan_date = $2`,
    [userId, localDate],
  );
  const used = result.rows[0]?.count ?? 0;
  return { used, remaining: Math.max(0, DAILY_SCAN_LIMIT - used), limit: DAILY_SCAN_LIMIT };
};

export { DAILY_SCAN_LIMIT };