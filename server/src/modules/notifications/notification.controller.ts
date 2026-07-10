import type { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
import { getRecentNotifications, getUnreadCount, markAllRead } from "./notification.model.js";
import {
  saveSubscription,
  removeSubscription,
  getVapidPublicKey,
} from "./notification.service.js";

// ---------------------------------------------------------------------------
// GET /api/notifications/vapid-key
// Returns the public VAPID key. for frontend to register a push subscription with the browser. Public key is not sensitive.
// ---------------------------------------------------------------------------
export const getVapidKeyHandler = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    sendSuccess({ res, data: { publicKey: getVapidPublicKey() } });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/notifications/subscribe
// Receives the PushSubscription object from the frontend after the user grants notification permission and the browser generates a subscription.
// ---------------------------------------------------------------------------
export const subscribeHandler = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { endpoint, p256dh, auth } = req.body;

    if (!endpoint || !p256dh || !auth) {
      throw new AppError(
        "Invalid subscription object. endpoint, p256dh and auth are required.",
        400,
        "INVALID_SUBSCRIPTION"
      );
    }

    await saveSubscription(req.user!.id, { endpoint, p256dh, auth });
    sendSuccess({ res, statusCode: 201, message: "Push notifications enabled." });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/notifications/subscribe
// Called when the user disables notifications. Removes the subscription so no further pushes are sent to this browser.
// ---------------------------------------------------------------------------
export const unsubscribeHandler = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      throw new AppError("endpoint is required.", 400, "MISSING_ENDPOINT");
    }

    await removeSubscription(req.user!.id, endpoint);
    sendSuccess({ res, message: "Push notifications disabled." });
  } catch (err) {
    next(err);
  }
};

//--------------------------------------------------------------------------------------
export const listNotificationsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const notifications = await getRecentNotifications(req.user!.id);
    const unreadCount = await getUnreadCount(req.user!.id);
    sendSuccess({ res, data: { notifications, unreadCount } });
  } catch (err) {
    next(err);
  }
};

export const markReadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await markAllRead(req.user!.id);
    sendSuccess({ res, data: { success: true } });
  } catch (err) {
    next(err);
  }
};