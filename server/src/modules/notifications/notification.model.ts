import { pgPool } from "../../config/db.postgres.js";

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  is_read: boolean;
  created_at: string;
}

// Creates an in-app notification row. Always called alongside a push
// send so the bell stays accurate whether or not push is enabled for
// that user.
export const insertNotification = async (
  userId: string,
  type: string,
  title: string,
  body: string,
  url?: string
): Promise<NotificationRow> => {
  const result = await pgPool.query(
    `INSERT INTO notifications (user_id, type, title, body, url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, type, title, body, url ?? null]
  );
  return result.rows[0];
};

export const getRecentNotifications = async (
  userId: string,
  limit = 30
): Promise<NotificationRow[]> => {
  const result = await pgPool.query(
    `SELECT * FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  const result = await pgPool.query(
    "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE",
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
};

export const markAllRead = async (userId: string): Promise<void> => {
  await pgPool.query(
    "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
    [userId]
  );
};

// Returns true if this exact event has already fired for this user
// today, false and logs it if not. Used to dedupe scheduled checks.
export const claimDailyEvent = async (
  userId: string,
  eventType: string,
  eventDate: string
): Promise<boolean> => {
  const result = await pgPool.query(
    `INSERT INTO notification_event_log (user_id, event_type, event_date)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, event_type, event_date) DO NOTHING
     RETURNING user_id`,
    [userId, eventType, eventDate]
  );
  return result.rows.length > 0; // true means this call just claimed it, safe to send
};