import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import {
  getVapidKeyHandler,
  subscribeHandler,
  unsubscribeHandler,
} from "./notification.controller.js";

export const notificationRouter = Router();

// VAPID key endpoint is public. No authenticate
notificationRouter.get("/vapid-key", getVapidKeyHandler);

// Subscribe and unsubscribe require authentication.
notificationRouter.post("/subscribe",   authenticate, subscribeHandler);
notificationRouter.delete("/subscribe", authenticate, unsubscribeHandler);