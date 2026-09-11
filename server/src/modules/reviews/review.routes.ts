import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import {
  reviewPostLimiter,
  reviewMutateLimiter,
} from "../../middleware/rateLimiter.js";
import {
  getReviews, postReview, editReview, removeReview,
  postReply, editReply, removeReply, markRead, checkUnread,
} from "./review.controller.js";

const router = Router();
router.use(authenticate);

// Static routes must come before /:id to avoid Express treating
// "unread" and "read" as review IDs.
router.get("/unread", checkUnread);
router.post("/read", markRead);

router.get("/", getReviews);
router.post("/", reviewPostLimiter, postReview);
router.patch("/:id", reviewMutateLimiter, editReview);
router.delete("/:id", reviewMutateLimiter, removeReview);

router.post("/:id/reply", reviewMutateLimiter, postReply);
router.patch("/reply/:id", reviewMutateLimiter, editReply);
router.delete("/reply/:id", reviewMutateLimiter, removeReply);

export default router;