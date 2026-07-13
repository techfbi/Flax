import { runScheduledChecks } from "./modules/notifications/notification.events.js";
import { cleanupOldSpinHistory } from "./modules/spin/spin.service.js";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const startScheduler = (): void => {
  setInterval(() => {
    runScheduledChecks().catch((err) => {
      console.error("[scheduler] runScheduledChecks failed", err);
    });
  }, CHECK_INTERVAL_MS);

  setInterval(() => {
    cleanupOldSpinHistory().catch((err) => {
      console.error("[scheduler] cleanupOldSpinHistory failed", err);
    });
  }, CLEANUP_INTERVAL_MS);

  // Run once immediately too, so a server restart does not wait a
  // full day before the first cleanup happens.
  cleanupOldSpinHistory().catch((err) => {
    console.error("[scheduler] initial cleanup failed", err);
  });

  console.log("[REMOVELOG LATER] notification scheduler started, checking every 15 minutes");
  console.log("[REMOVE LOG LATER] spin history cleanup started, running once every 24 hours");
};