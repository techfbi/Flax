import { type Request, type Response, type NextFunction } from "express";
import {
  getUserReviews, getAllReviews, createReview, updateReview, deleteReview,
  createOrUpdateReply, updateReply, deleteReply, markRepliesRead, hasUnreadReplies,
} from "./review.service.js";
import { sendSuccess } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
import { z } from "zod";

const messageSchema = z
  .string()
  .min(1, "Message cannot be empty")
  .max(1000, "Message cannot exceed 1000 characters")
  .trim()
;

export const getReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isAdmin = req.user!.role === "admin";
    const reviews = isAdmin
      ? await getAllReviews()
      : await getUserReviews(req.user!.sub);
    sendSuccess({ res, data: { reviews } });
  } catch (err) { next(err); }
};

export const postReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = messageSchema.safeParse(req.body.message);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400, "VALIDATION_ERROR");
    const review = await createReview(req.user!.sub, parsed.data);
    sendSuccess({ res, statusCode: 201, data: { review }, message: "Review posted" });
  } catch (err) { next(err); }
};

export const editReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = messageSchema.safeParse(req.body.message);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400, "VALIDATION_ERROR");
    await updateReview(req.params.id as string, req.user!.sub, parsed.data);
    sendSuccess({ res, message: "Review updated" });
  } catch (err) { next(err); }
};

export const removeReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await deleteReview(req.params.id as string, req.user!.sub);
    sendSuccess({ res, message: "Review deleted" });
  } catch (err) { next(err); }
};

export const postReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user!.role !== "admin") throw new AppError("Forbidden", 403, "FORBIDDEN");
    const parsed = messageSchema.safeParse(req.body.message);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400, "VALIDATION_ERROR");
    await createOrUpdateReply(req.params.id as string, parsed.data);
    sendSuccess({ res, statusCode: 201, message: "Reply posted" });
  } catch (err) { next(err); }
};

export const editReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user!.role !== "admin") throw new AppError("Forbidden", 403, "FORBIDDEN");
    const parsed = messageSchema.safeParse(req.body.message);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400, "VALIDATION_ERROR");
    await updateReply(req.params.id as string, parsed.data);
    sendSuccess({ res, message: "Reply updated" });
  } catch (err) { next(err); }
};

export const removeReply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user!.role !== "admin") throw new AppError("Forbidden", 403, "FORBIDDEN");
    await deleteReply(req.params.id as string);
    sendSuccess({ res, message: "Reply deleted" });
  } catch (err) { next(err); }
};

export const markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await markRepliesRead(req.user!.sub);
    sendSuccess({ res, message: "Marked as read" });
  } catch (err) { next(err); }
};

export const checkUnread = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hasUnread = await hasUnreadReplies(req.user!.sub);
    sendSuccess({ res, data: { hasUnread } });
  } catch (err) { next(err); }
};