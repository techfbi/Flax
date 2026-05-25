// This runs on server startup and every 24 hours to delete expired pending registrations.

import { pgPool } from "./db.postgres.js";

// Deletes pending registrations older than 3 days.
// Called once at startup and then every 24 hours.
const cleanupPendingRegistrations = async (): Promise<void> => {
  try {
    const result = await pgPool.query(
      `DELETE FROM pending_registrations
       WHERE created_at < NOW() - INTERVAL '3 days'
       RETURNING id`
    );

    // if (result.rowCount && result.rowCount > 0) {
    //   console.log(
    //     `Cleanup. deleted ${result.rowCount} expired pending registrations.`
    //   );
    // }
  } catch (err) {
    console.error("Pending user cleanup job failed.", err);
  }
};

export const startCleanupJob = (): void => {
  // Run immediately on startup to catch anything that expired while server was down
  cleanupPendingRegistrations();

  // Then run every 24 hours
  setInterval(cleanupPendingRegistrations, 24 * 60 * 60 * 1000);

  console.log("Cleanup job started. runs every 24 hours.");
};