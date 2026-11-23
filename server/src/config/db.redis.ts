import { createClient } from "redis";
import { env } from "./env.js";

// ---------------------------------------------------------------------------
// Redis client
//
// Redis is an optimisation here (rate limit counters and food caches), never
// a hard dependency. Every caller has a fallback, so the client is set up to
// FAIL FAST instead of waiting:
//
// - disableOfflineQueue: while the client is reconnecting, commands are
//   rejected immediately instead of being queued until Redis comes back.
//   Queuing is what made login, refresh and spin hang indefinitely when the
//   Upstash connection dropped.
// - pingInterval: Upstash closes idle connections and a dropped connection
//   is not always reported. A regular PING surfaces a dead socket as an
//   error, which triggers a reconnect.
// - connectTimeout / reconnectStrategy: bounded connect attempts and capped
//   backoff, reconnection continues in the background indefinitely.
//
// Callers additionally wrap every command in withRedisTimeout
// (shared/redisSafe.ts), covering the case where a socket looks connected
// but never answers.
// ---------------------------------------------------------------------------
export const redis = createClient({
  url: env.REDIS_URL,
  disableOfflineQueue: true,
  pingInterval: 60_000,
  socket: {
    connectTimeout: 10_000,
    reconnectStrategy: (retries) => Math.min(250 * 2 ** retries, 10_000),
  },
});

redis.on("error", (err) => {
  console.error("Redis client error:", err.message);
});

// How long server start waits for Redis before continuing without it.
const STARTUP_CONNECT_WAIT_MS = 10_000;

// ---------------------------------------------------------------------------
// connectRedis
// Waits up to STARTUP_CONNECT_WAIT_MS for the first connection. If Redis is
// unreachable the server still starts, rate limiting uses its in-memory
// store and caches are skipped, and the client keeps reconnecting in the
// background. Previously an unreachable Redis kept the whole API from ever
// starting.
// ---------------------------------------------------------------------------
export async function connectRedis(): Promise<void> {
  const connecting = redis.connect().then(
    () => true,
    (err: unknown) => {
      console.error("Redis connect failed:", err instanceof Error ? err.message : err);
      return false;
    },
  );

  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), STARTUP_CONNECT_WAIT_MS);
  });

  const connected = await Promise.race([connecting, timedOut]);
  clearTimeout(timer);

  if (connected) {
    console.log("Redis connected!");
  } else {
    console.error(
      "Redis not reachable at startup. Starting without it: rate limiting uses " +
        "the in-memory fallback and caches are skipped until it reconnects.",
    );
    redis.once("ready", () => console.log("Redis connected (after startup)."));
  }
}
