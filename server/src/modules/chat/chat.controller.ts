import type { Request, Response, NextFunction } from "express";
import { sendMessage, getChatHistory, clearChatHistory } from "./chat.service.js";
import { sendSuccess } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
import { checkMessageDomain, OFF_TOPIC_RESPONSE } from "./chat.guard.js";

// ---------------------------------------------------------------------------
// POST /api/chat
// Receives a user message, runs it through the domain guard, and if allowed sends it to the AI and returns the response.
// ---------------------------------------------------------------------------
export const chat = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const message = req.body?.message;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      throw new AppError("Message is required.", 400, "MISSING_MESSAGE");
    }

    if (message.trim().length > 1000) {
      throw new AppError(
        "Message is too long. Please keep it under 1000 characters.",
        400,
        "MESSAGE_TOO_LONG"
      );
    }

    // Run the domain guard before touching the AI.
    const guard = checkMessageDomain(message.trim());

    if (!guard.allowed) {
      // Guard blocked the message. return the canned response immediately. not saved to history either since it never reached the AI.
      sendSuccess({
        res,
        data: {
          reply: OFF_TOPIC_RESPONSE,
          modelUsed: "guard",
          isFallback: false,
        },
      });
      return;
    }

    const { reply, modelUsed, isFallback } = await sendMessage(
      req.user!.id,
      message.trim()
    );

    sendSuccess({
      res,
      data: { reply, modelUsed, isFallback },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/chat/history
// Returns the full stored message history for the authenticated user.
// ---------------------------------------------------------------------------
export const getHistory = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const history = await getChatHistory(req.user!.id);
    sendSuccess({ res, data: history });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/chat/history
// Clears all messages from the user's chat session.
// ---------------------------------------------------------------------------
export const clearHistory = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    await clearChatHistory(req.user!.id);
    sendSuccess({ res, message: "Chat history cleared." });
  } catch (err) {
    next(err);
  }
};