import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import {
  updateProfileSchema,
  updateHealthSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from "./user.schema.js";
import {
  getProfile,
  patchProfile,
  patchHealth,
  patchPassword,
  deleteUserAccount,
  patchTimezone,
} from "./user.controller.js";

export const userRouter = Router();

// These limiters are defined inline here rather than in rateLimiter.ts because they are only ever used in this module.
const passwordChangeLimiter = rateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 5,
  keyPrefix: "user:password",
});

const deleteAccountLimiter = rateLimiter({
  windowSeconds: 15 * 60,
  maxRequests: 3,
  keyPrefix: "user:delete",
});

// All user routes require authentication.
// authenticate middleware applied to every route via router.use().
userRouter.use(authenticate);

userRouter.get("/profile", getProfile);
userRouter.patch("/profile", validate(updateProfileSchema), patchProfile);
userRouter.patch("/health", validate(updateHealthSchema), patchHealth);
userRouter.patch( "/password", passwordChangeLimiter, validate(changePasswordSchema), patchPassword );
userRouter.delete( "/account", deleteAccountLimiter, validate(deleteAccountSchema), deleteUserAccount );
userRouter.patch("/timezone",  patchTimezone)