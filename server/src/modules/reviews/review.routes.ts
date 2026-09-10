import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
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

// Review CRUD
router.get("/", getReviews);
router.post("/", postReview);
router.patch("/:id", editReview);
router.delete("/:id", removeReview);

// Reply routes
router.post("/:id/reply", postReply);
router.patch("/reply/:id", editReply);
router.delete("/reply/:id", removeReply);

export default router;