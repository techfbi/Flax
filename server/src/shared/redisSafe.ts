import { redis } from "../config/db.redis.js";
import logger from "../config/logger.js";

// ---------------------------------------------------------------------------
// Redis safety layer, shared by the rate limiter and every cache.
//
// Redis is an optimisation here, never a hard dependency. This module makes
// sure no request ever waits on it for long:
//
// 1. Every call has a time limit (withRedisTimeout).
// 2. Any failure pauses Redis use for RETRY_AFTER_MS for EVERY caller, so
//    only the first request after a failure waits, the rest use their
//    fallback instantly (in-memory rate limiting, MongoDB instead of cache).
// 3. A reply that never arrives means the connection died without the client
//    noticing. Commands already sent on it will never be answered, so the
//    connection is replaced, not reused.
// 4. A fresh successful connection ("ready") ends the pause immediately.
//
// Previously the rate limiter awaited Redis with no time limit, so a
// silently dropped Upstash connection made login, refresh, spin and chat hang.
// ---------------------------------------------------------------------------

// Upstash answers in a few milliseconds from Render, these only ever trigger
// when Redis is down or the connection is dead.
export const REDIS_OP_TIMEOUT_MS = 1500;
const CACHE_WRITE_TIMEOUT_MS = 3000; // cache payloads can be a few hundred KB
const RETRY_AFTER_MS = 30_000;

let pausedUntil = 0;
let degraded = false;
let resetting = false;

export class RedisUnavailableError extends Error {
  readonly isTimeout: boolean;
  constructor(reason: string, isTimeout = false) {
    super(`Redis unavailable: ${reason}`);
    this.name = "RedisUnavailableError";
    this.isTimeout = isTimeout;
  }
}

/** True when Redis is connected and not paused after a recent failure. */
export const redisUsable = (): boolean => redis.isReady && Date.now() >= pausedUntil;

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const markFailure = (reason: string): void => {
  pausedUntil = Date.now() + RETRY_AFTER_MS;
  if (!degraded) {
    degraded = true;
    logger.error(
      `Redis unavailable (${reason}). Rate limiting uses the in-memory store and ` +
        "caches are skipped until it recovers. Brute force protection is degraded on multi-instance deployments.",
    );
  }
};

const markSuccess = (): void => {
  if (degraded) {
    degraded = false;
    logger.info("Redis reachable again. Rate limiting and caching restored.");
  }
};

// Drop the dead socket (rejecting anything still waiting on it) and open a
// new connection in the background. Only one reset runs at a time.
const resetConnection = (): void => {
  if (resetting || !redis.isOpen) return;
  resetting = true;
  logger.warn("Redis did not reply in time. Replacing the connection.");
  try {
    redis.destroy();
  } catch {
    // already closed
  }
  redis
    .connect()
    .catch((err: unknown) => logger.error(`Redis reconnect failed. ${reasonOf(err)}`))
    .finally(() => {
      resetting = false;
    });
};

redis.on("error", (err: Error) => markFailure(err.message));
redis.on("ready", () => {
  pausedUntil = 0;
});

// ---------------------------------------------------------------------------
// withRedisTimeout
// Runs a Redis command but never waits longer than `ms`. Rejects immediately
// while Redis is disconnected or paused. Callers catch the rejection and use
// their fallback.
// ---------------------------------------------------------------------------
export const withRedisTimeout = async <T>(
  op: () => Promise<T>,
  ms: number = REDIS_OP_TIMEOUT_MS,
): Promise<T> => {
  if (!redisUsable()) {
    throw new RedisUnavailableError(redis.isReady ? "paused after a recent failure" : "client not connected");
  }

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RedisUnavailableError(`no reply within ${ms}ms`, true)), ms);
  });

  try {
    // Promise.race subscribes to op() too, so if op() rejects after the
    // timeout already won, that late rejection is handled, not unhandled.
    const value = await Promise.race([op(), timeout]);
    markSuccess();
    return value;
  } catch (err) {
    markFailure(reasonOf(err));
    if (err instanceof RedisUnavailableError && err.isTimeout) resetConnection();
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

// ---------------------------------------------------------------------------
// Cache helpers. A cache must never block a response: on any Redis problem a
// read behaves like a cache miss and a write is skipped. While Redis is known
// to be unavailable they return instantly without logging on every request.
// ---------------------------------------------------------------------------
export const cacheGet = async (key: string): Promise<string | null> => {
  if (!redisUsable()) return null;
  try {
    const value = await withRedisTimeout(() => redis.get(key));
    return typeof value === "string" ? value : null;
  } catch (err) {
    logger.warn(`Cache read skipped for ${key}. ${reasonOf(err)}`);
    return null;
  }
};

export const cacheSet = async (key: string, ttlSeconds: number, value: string): Promise<void> => {
  if (!redisUsable()) return;
  try {
    await withRedisTimeout(() => redis.setEx(key, ttlSeconds, value), CACHE_WRITE_TIMEOUT_MS);
  } catch (err) {
    logger.warn(`Cache write skipped for ${key}. ${reasonOf(err)}`);
  }
};
