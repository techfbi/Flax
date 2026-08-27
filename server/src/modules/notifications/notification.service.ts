import { pgPool } from "../../config/db.postgres.js";
import logger from "../../config/logger.js";
import { webpush } from "../../config/webpush.js";
import { insertNotification } from "./notification.model.js";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh:   string;
  auth:     string;
}

// ---------------------------------------------------------------------------
// notifyUser
// The one function every event checker calls. Always writes the
// in-app row, and additionally sends a push if the user has an active
// subscription. This is what makes the bell work regardless of push
// permission state.
// ---------------------------------------------------------------------------
export const notifyUser = async (
  userId: string,
  type: string,
  title: string,
  body: string,
  url?: string
): Promise<void> => {
  await insertNotification(userId, type, title, body, url);
  await sendPushToUser(userId, { title, body, url });
};

// ---------------------------------------------------------------------------
// saveSubscription
// Stores the browser push subscription for this user.
// ON CONFLICT on endpoint means if the same browser re-registers after a service worker update, we update the keys rather than duplicating.
// ---------------------------------------------------------------------------
export const saveSubscription = async ( userId: string, sub: PushSubscriptionInput ): Promise<void> => {
  await pgPool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh,
       auth   = EXCLUDED.auth`,
    [userId, sub.endpoint, sub.p256dh, sub.auth]
  );

  logger.info(` Push subscription saved. user. ${userId}`);
};

// ---------------------------------------------------------------------------
// removeSubscription
// Called when the user disables notifications in the UI. Removes by endpoint which is the browser unique ID
// ---------------------------------------------------------------------------
export const removeSubscription = async ( userId: string, endpoint: string ): Promise<void> => {
  await pgPool.query(
    "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
    [userId, endpoint]
  );
};

// ---------------------------------------------------------------------------
// sendPushToUser
// Sends a push notification to all of a user's registered browsers.
// If a subscription returns 410 (Gone), the browser has unsubscribed and
// we clean it up from our database automatically.
// Other errors are logged but do not throw. push delivery is best effort.
// ---------------------------------------------------------------------------
export const sendPushToUser = async ( userId: string, payload: { title: string; body: string; url?: string } ): Promise<void> => {
  const result = await pgPool.query(
    "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
    [userId]
  );

  if (result.rows.length === 0) return;

  const payloadString = JSON.stringify(payload);

  // promise.all will fail all if one fails, but promise.allsettled allows proccess to continue if any fails
  await Promise.allSettled(
    result.rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadString
        );
      } catch (err: any) {
        if (err?.statusCode === 410) {
          // 410 Gone means the browser has unsubscribed, the subscription no longer exists. clean up.
          await pgPool.query(
            "DELETE FROM push_subscriptions WHERE id = $1",
            [sub.id]
          );
          logger.info(
            ` Removed expired push subscription. ${sub.endpoint}`
          );
        } else {
          logger.error(
            " Push notification send failed.",
            err?.message ?? err
          );
        }
      }
    })
  );
};

// ---------------------------------------------------------------------------
// getVapidPublicKey
// Returns the public VAPID key so the frontend can register a push subscription. The public key is not secret, the private key never leaves the server.
// ---------------------------------------------------------------------------
export const getVapidPublicKey = (): string => {
  return process.env.VAPID_PUBLIC_KEY!;
};