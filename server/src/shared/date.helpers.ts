import { pgPool } from "../config/db.postgres.js";

// Looks up the IANA timezone on record for this user, the same
// column the notification scheduler already relies on. Falls back to
// UTC if it is somehow not set yet, rather than failing outright.
export const getUserTimezone = async (userId: string): Promise<string> => {
  const result = await pgPool.query(
    "SELECT timezone FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0]?.timezone ?? "UTC";
};

// True if dateStr (YYYY-MM-DD) is today or yesterday in the given
// timezone, computed from the server's own real clock. The timezone
// only tells us which calendar day that real clock falls on for this
// user, the client's device clock is never consulted or trusted.
export const isTodayOrYesterdayInTimezone = (
  dateStr: string,
  timezone: string
): boolean => {
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);

  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(yesterday);

  return dateStr === todayStr || dateStr === yesterdayStr;
};