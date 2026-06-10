import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import { chat, getHistory, clearHistory } from "./chat.controller.js";

export const chatRouter = Router();

// Tighter rate limit on the send message endpoint to protect Groq token budget.
const chatLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 20, // 20 messages per minute
  keyPrefix: "chat:send",
});

chatRouter.use(authenticate);

chatRouter.post("/", chatLimiter, chat);
chatRouter.get("/history", getHistory);
chatRouter.delete("/history", clearHistory);