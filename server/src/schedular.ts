import { runScheduledChecks } from "./modules/notifications/notification.events.js";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export const startScheduler = (): void => {
  setInterval(() => {
    runScheduledChecks().catch((err) => {
      console.error("[scheduler] runScheduledChecks failed", err);
    });
  }, CHECK_INTERVAL_MS);

  console.log("[scheduler] notification scheduler started, checking every 30 minutes");
  // Spin history cleanup now runs as a pg_cron job directly inside
  // Postgres, see the cleanup-spin-history job, no longer needs the
  // Node process to be awake and polling for this.
};