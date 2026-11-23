import type { Request, Response, NextFunction } from "express";
import { redis } from "../config/db.redis.js";
import { sendError } from "../shared/response.js";
import { redisUsable, withRedisTimeout } from "../shared/redisSafe.js";
import logger from "../config/logger.js";

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
}

// ---------------------------------------------------------------------------
// In-memory fallback store
// Active only when Redis is unreachable.
// Safe on single Render instance. On multiple instances, effective limit becomes (maxRequests * instanceCount) because stores do not share state.
//
// If at all i scale beyond one render I have to replace this fallback
// with a hard rejection when Redis is down and set up alerting instead.
// ---------------------------------------------------------------------------
interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();

function memoryRateCheck(
  key: string,
  windowMs: number,
  maxRequests: number
): boolean {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count += 1;
  return entry.count <= maxRequests;
}

// Sweep expired entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (now > entry.resetAt) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// Redis health
// Tracked in shared/redisSafe.ts, shared with the caches. Calls there have a
// time limit, a failure pauses Redis for every caller and a dead connection
// is replaced. Previously this limiter awaited Redis with no time limit, so a
// silently dropped Upstash connection made login, refresh, spin and chat hang,
// and a single failed call could leave it on the memory store until restart.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Key builder
// ---------------------------------------------------------------------------
const getClientKey = (req: Request, prefix: string): string => {
  // req.ip is populated correctly only after app.set("trust proxy", 1) in app.ts.
  // And if the request is authenticated we use req.user.id instead to ensure the limit is per user not per IP, which is more user friendly and effective against brute force attacks.

  if (req.user?.id) {
    return `rl:${prefix}:user:${req.user.id}`;
  }

  // Unauthenticated routes (login, register, forgot password) use IP address.
  const ip = req.ip ??
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    "NO_IP_FOUND";

  if (ip === "NO_IP_FOUND") {
    logger.error(
      "Rate limiter could not determine client IP. " +
      "Check that app.set trust proxy is configured in app.ts."
    );
  }

  // Each prefix is unique per endpoint so counters are fully independent.
  return `rl:${prefix}:${ip}`;
};

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------
export function rateLimiter({
  windowSeconds,
  maxRequests,
  keyPrefix,
}: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = getClientKey(req, keyPrefix);
    const windowMs = windowSeconds * 1000;

    // Path A — Redis available
    if (redisUsable()) {
      try {
        // Never waits longer than REDIS_OP_TIMEOUT_MS, see redisSafe.ts.
        const results = await withRedisTimeout(() => {
          const pipeline = redis.multi();
          pipeline.incr(key);
          pipeline.expire(key, windowSeconds);
          return pipeline.exec();
        });

        // pipeline.exec() returns ReplyUnion[], a union type that TypeScript cannot safely narrow to number with a direct cast.
        // I cast through unknown first (safe because I confirmed the shape with the test-redis.ts output results[0] is always a number here),
        // then guard with typeof to satisfy TypeScript's type checker.

        const rawCount = results?.[0] as unknown;
        const count = typeof rawCount === "number" ? rawCount : 0;

        // If count is 0 here it means the cast failed unexpectedly.
        // Log it to catch any future Redis version behaviour change.
        if (count === 0 && results?.[0] !== undefined) {
        logger.error(
            "Rate limiter: unexpected pipeline exec result type:",
            typeof results?.[0], results?.[0]
        );
        }

        if (count > maxRequests) {
          sendError({
            res,
            message: "Too many requests. Please slow down.",
            statusCode: 429,
            code: "RATE_LIMITED",
          });
          return;
        }

        res.setHeader("X-RateLimit-Limit", maxRequests);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - count));
        next();
        return;
      } catch {
        // Already recorded by withRedisTimeout, use the memory store below.
      }
    }

    // Path B — in-memory fallback
    logger.warn(
      "Rate limiter using in-memory fallback for key:", key
    );

    const allowed = memoryRateCheck(key, windowMs, maxRequests);

    if (!allowed) {
      sendError({
        res,
        message: "Too many requests. Please slow down.",
        statusCode: 429,
        code: "RATE_LIMITED",
      });
      return;
    }

    next();
  };
}

// Pre-built limiters, import directly in route files
// Each limiter has unique prefix that specifies specific endpoint.
// This ensures counters are independent. hitting /login does not affect /register.

// Login. tightest limit to prevent brute force attacks.
export const loginLimiter = rateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 10,
  keyPrefix: "auth:login",
});

// Register. slightly more generous. account creation is less sensitive than login.
export const registerLimiter = rateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 5,
  keyPrefix: "auth:register",
});

// Forgot password. very tight. prevents email enumeration and spam.
export const forgotPasswordLimiter = rateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 3,
  keyPrefix: "auth:forgot",
});

// OTP verification. per attempt limit handled in service layer too.
export const verifyOtpLimiter = rateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 10,
  keyPrefix: "auth:verify-otp",
});

// Resend OTP. tight to prevent email spam abuse.
export const resendOtpLimiter = rateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 3,
  keyPrefix: "auth:resend-otp",
});

// Refresh. generous.
export const refreshLimiter = rateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 30,
  keyPrefix: "auth:refresh",
});

// Spin. per minute window.
export const spinLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 30,
  keyPrefix: "spin",
});

// Chat. per minute window. protects Groq API token budget.
export const chatLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 20,
  keyPrefix: "chat",
});

export const reviewPostLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 5,
  keyPrefix: "review:post",
});

export const reviewMutateLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 10,
  keyPrefix: "review:mutate",
});