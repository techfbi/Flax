import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { pgPool } from "./config/db.postgres.js";
import { connectMongo } from "./config/db.mongo.js";
import { connectRedis } from "./config/db.redis.js";
import { startCleanupJob } from "./config/cleanup.js";

async function startServer(): Promise<void> {
  try {
    console.log(`Starting Flax server in [${env.NODE_ENV}] mode...`);

    await pgPool.query("SELECT 1");
    console.log("PostgreSQL connected and responsive");

    await connectMongo();
    await connectRedis();
    
    startCleanupJob();

    app.listen(env.PORT, () => {
      console.log(`Server listening on port ${env.PORT}`);
      console.log(`Health check: http://localhost:${env.PORT}/health`);
    });
  } catch (err) {
    console.error("FATAL: Server failed to start:", err);
    // REMOVE LOG LATER, send to alerting service before exit in production
    process.exit(1);
  }
}

startServer();