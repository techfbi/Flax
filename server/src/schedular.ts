import { runScheduledChecks } from "./modules/notifications/notification.events.js";

// Runs every 15 minutes. No new dependency needed, setInterval is
// enough for a single long running Node process, this is not a
// distributed job queue and does not need to be one at this scale.
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export const startScheduler = (): void => {
  setInterval(() => {
    runScheduledChecks().catch((err) => {
      console.error("[scheduler] runScheduledChecks failed", err);
    });
  }, CHECK_INTERVAL_MS);

  console.log("[scheduler] notification scheduler started, checking every 15 minutes");
};