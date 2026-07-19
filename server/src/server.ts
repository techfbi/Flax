import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { pgPool } from "./config/db.postgres.js";
import { connectMongo } from "./config/db.mongo.js";
import { connectRedis } from "./config/db.redis.js";

async function startServer(): Promise<void> {
  try {
    console.log(`Starting Flax server in [${env.NODE_ENV}] mode...`);

    await pgPool.query("SELECT 1");
    console.log("PostgreSQL connected and responsive");

    await connectMongo();
    await connectRedis();

    // Notification checks and both cleanup jobs no longer run as
    // internal timers inside this process. Spin history and pending
    // registrations now clean themselves up via pg_cron, running
    // inside Postgres directly. Notification checks are triggered
    // externally, on /internal/run-scheduled-checks, so this
    // process only ever does that work when something outside it
    // actually asks, not continuously on its own schedule.

    app.listen(env.PORT, () => {
      console.log(`Server listening on port ${env.PORT}`);
      console.log(`Health check: http://localhost:${env.PORT}/health`);
    });
  } catch (err) {
    console.error("FATAL: Server failed to start:", err);
    process.exit(1);
  }
}

startServer();