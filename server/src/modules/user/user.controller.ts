import type { Request, Response, NextFunction } from "express";
import {
  getFullProfile,
  updateProfile,
  updateHealthProfile,
  changePassword,
  deleteAccount,
  setTimezone,
} from "./user.service.js";
import { sendSuccess } from "../../shared/response.js";
import type {
  UpdateProfileInput,
  UpdateHealthInput,
  ChangePasswordInput,
  DeleteAccountInput,
} from "./user.schema.js";
import { promise } from "zod";

// ---------------------------------------------------------------------------
// GET /api/users/profile
// ---------------------------------------------------------------------------
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const profile = await getFullProfile(req.user!.id); // the req.user! is a non-null assertion. We can be sure it's there because this route is protected by the authenticate middleware which guarantees req.user is set.
    sendSuccess({ res, data: { profile } });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/users/profile
// ---------------------------------------------------------------------------
export const patchProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as UpdateProfileInput;
    const profile = await updateProfile(req.user!.id, input);
    sendSuccess({ res, message: "Profile updated successfully", data: { profile } });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/users/health
// ---------------------------------------------------------------------------
export const patchHealth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as UpdateHealthInput;
    const profile = await updateHealthProfile(req.user!.id, input);
    sendSuccess({
      res,
      message: "Health profile updated successfully",
      data: { profile },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/users/password
// ---------------------------------------------------------------------------
export const patchPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as ChangePasswordInput;
    await changePassword(req.user!.id, input);
    sendSuccess({
      res,
      message: "Password changed successfully. Please log in again.",
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/users/account
// ---------------------------------------------------------------------------
export const deleteUserAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as DeleteAccountInput;
    await deleteAccount(req.user!.id, input);

    // Clear the refresh cookie since all sessions are now revoked
    res.clearCookie("refresh_token", {
      path: "/api/auth",
      secure: process.env.NODE_ENV === "production",
      sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
    });

    sendSuccess({ res, message: "Account deleted successfully." });
  } catch (err) {
    next(err);
  }
};

//---------------------------------------------------------------------------------------
// PATCH /api/users/timezone
//----------------------------------------------------------------------------------------
export const patchTimezone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const timezone = req.body.timezone as string;
    await setTimezone(req.user!.id, timezone);
    sendSuccess({
      res,
      message: "Timezone successfully set.",
    });
  } catch (err) {
    next(err);
  }
} 
