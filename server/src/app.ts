import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { userRouter } from "./modules/user/user.routes.js";
import { spinRouter } from "./modules/spin/spin.routes.js";
import { pantryRouter } from "./modules/pantry/pantry.routes.js";
import { mealLogRouter } from "./modules/meal-log/meallog.routes.js";
import { chatRouter } from "./modules/chat/chat.routes.js";
import { foodRouter } from "./modules/foods/food.routes.js";
import { waterRouter } from "./modules/water/water.routes.js";
import { streakRouter } from "./modules/streaks/streak.routes.js";
import { notificationRouter } from "./modules/notifications/notification.routes.js";
import { runScheduledChecksHandler } from "./modules/notifications/scheduler.controller.js";
import httpLogger from "./middleware/httpLogger.js";

export const app = express();

// Trust the first proxy hop. Required for req.ip to contain the real
// client IP when running behind Render's load balancer or any reverse proxy.
// Without this, req.ip is undefined and all rate limit keys collapse into one.
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", env.CLIENT_URL],
        fontSrc: ["'self'", "https:", "data:"], // Allows fonts from HTTPS font CDNs, your server, base64 fonts.
        objectSrc: ["'none'"], //Prevents Flash / plugin injection.
        baseUri: ["'self'"], // Stops attackers changing how URLs resolve.
        frameAncestors: ["'none'"], // Prevents clickjacking by disallowing site to be framed by any site. Adjust if you need to allow framing from specific origins (e.g., for embedding in a trusted partner site).
        upgradeInsecureRequests: [], // Tells browsers to upgrade HTTP requests to HTTPS automatically
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  })
);

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  })
);
// logger
app.use(httpLogger);

// The scan endpoint accepts a real photo, base64 encoded, which needs
// real room well past the 20kb default. Excluded here so it gets its
// own separate, larger, but still explicitly capped limit applied
// directly on that one route in meallog.routes.ts. Every other
// endpoint in this app keeps the small default, which is what
// actually guards against abuse everywhere else.
app.use((req, res, next) => {
  if (req.path === "/api/meal-logs/scan") return next();
  express.json({ limit: "20kb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "20kb" })); // Allows form submission
app.use(cookieParser());

// Render pings this endpoint to verify the service is active. We can also add more info here later, like version number, uptime, etc.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.status(200).json({ status: "ok", message: "Welcome to Flax API", timestamp: new Date().toISOString() });
});


app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/spin", spinRouter);
app.use("/api/pantry", pantryRouter);
app.use("/api/meal-logs", mealLogRouter);
app.use("/api/chat", chatRouter);
app.use("/api/foods", foodRouter);
app.use("/api/streaks", streakRouter);
app.use("/api/water", waterRouter);
app.use("/api/notifications", notificationRouter);
app.post("/internal/run-scheduled-checks", runScheduledChecksHandler);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    code: "NOT_FOUND",
  });
});

// This is last because it receives any error passed via next(err) from routes
app.use(errorHandler);