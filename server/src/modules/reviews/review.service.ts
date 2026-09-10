import { pgPool } from "../../config/db.postgres.js";
import { AppError } from "../../shared/errors.js";
import { notifyUser } from "../notifications/notification.service.js";

export interface ReviewReply {
  id: string;
  message: string;
  is_edited: boolean;
  seen_by_user: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  message: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  user: {
    display_name: string;
    avatar_url: string | null;
  };
  reply: ReviewReply | null;
}

const reviewWithRelations = `
  SELECT
    r.id,
    r.user_id,
    r.message,
    r.is_edited,
    r.created_at,
    r.updated_at,
    json_build_object(
      'display_name', u.display_name,
      'avatar_url',   u.avatar_url
    ) AS "user",
    CASE WHEN rr.id IS NOT NULL THEN
      json_build_object(
        'id',           rr.id,
        'message',      rr.message,
        'is_edited',    rr.is_edited,
        'seen_by_user', rr.seen_by_user,
        'created_at',   rr.created_at
      )
    ELSE NULL END AS reply
  FROM reviews r
  JOIN  users u         ON u.id  = r.user_id
  LEFT JOIN review_replies rr ON rr.review_id = r.id
`;

// Returns only the calling user's own reviews and the admin reply on each.
export const getUserReviews = async (userId: string): Promise<Review[]> => {
  const result = await pgPool.query<Review>(
    `${reviewWithRelations}
     WHERE r.user_id = $1
     ORDER BY r.created_at ASC`,
    [userId],
  );
  return result.rows;
};

// Admin only. Returns every user's reviews, newest first.
export const getAllReviews = async (): Promise<Review[]> => {
  const result = await pgPool.query<Review>(
    `${reviewWithRelations}
     WHERE u.deleted_at IS NULL
     ORDER BY r.created_at DESC`,
  );
  return result.rows;
};

export const createReview = async (userId: string, message: string): Promise<Review> => {
  const { rows } = await pgPool.query<{ id: string }>(
    `INSERT INTO reviews (user_id, message) VALUES ($1, $2) RETURNING id`,
    [userId, message.trim()],
  );
  const { rows: full } = await pgPool.query<Review>(
    `${reviewWithRelations} WHERE r.id = $1`,
    [rows[0].id],
  );
  return full[0];
};

export const updateReview = async (reviewId: string, userId: string, message: string): Promise<void> => {
  const { rowCount } = await pgPool.query(
    `UPDATE reviews
     SET message = $1, is_edited = TRUE, updated_at = NOW()
     WHERE id = $2 AND user_id = $3`,
    [message.trim(), reviewId, userId],
  );
  if (!rowCount) throw new AppError("Review not found", 404, "REVIEW_NOT_FOUND");
};

export const deleteReview = async (reviewId: string, userId: string): Promise<void> => {
  const { rowCount } = await pgPool.query(
    `DELETE FROM reviews WHERE id = $1 AND user_id = $2`,
    [reviewId, userId],
  );
  if (!rowCount) throw new AppError("Review not found", 404, "REVIEW_NOT_FOUND");
};

// ON CONFLICT handles the case where a reply already exists (edit in place).
// seen_by_user resets to FALSE so the user sees the updated reply.
export const createOrUpdateReply = async (reviewId: string, message: string): Promise<void> => {
  const { rows } = await pgPool.query<{ user_id: string }>(
    `SELECT user_id FROM reviews WHERE id = $1`,
    [reviewId],
  );
  if (!rows.length) throw new AppError("Review not found", 404, "REVIEW_NOT_FOUND");

  await pgPool.query(
    `INSERT INTO review_replies (review_id, message)
     VALUES ($1, $2)
     ON CONFLICT (review_id)
     DO UPDATE SET message = $2, is_edited = TRUE, seen_by_user = FALSE, updated_at = NOW()`,
    [reviewId, message.trim()],
  );

  await notifyUser(
    rows[0].user_id,
    "review_reply",
    "Admin replied to your review",
    "You have a new reply. Open the reviews panel to see it.",
    "/",
  );
};

export const updateReply = async (replyId: string, message: string): Promise<void> => {
  const { rowCount } = await pgPool.query(
    `UPDATE review_replies
     SET message = $1, is_edited = TRUE, seen_by_user = FALSE, updated_at = NOW()
     WHERE id = $2`,
    [message.trim(), replyId],
  );
  if (!rowCount) throw new AppError("Reply not found", 404, "REPLY_NOT_FOUND");
};

export const deleteReply = async (replyId: string): Promise<void> => {
  const { rowCount } = await pgPool.query(
    `DELETE FROM review_replies WHERE id = $1`,
    [replyId],
  );
  if (!rowCount) throw new AppError("Reply not found", 404, "REPLY_NOT_FOUND");
};

export const markRepliesRead = async (userId: string): Promise<void> => {
  await pgPool.query(
    `UPDATE review_replies rr
     SET seen_by_user = TRUE
     FROM reviews r
     WHERE rr.review_id = r.id
       AND r.user_id = $1
       AND rr.seen_by_user = FALSE`,
    [userId],
  );
};

export const hasUnreadReplies = async (userId: string): Promise<boolean> => {
  const { rows } = await pgPool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM review_replies rr
     JOIN reviews r ON r.id = rr.review_id
     WHERE r.user_id = $1 AND rr.seen_by_user = FALSE`,
    [userId],
  );
  return parseInt(rows[0].count) > 0;
};