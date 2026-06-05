import type { Request, Response, NextFunction } from "express";
import {
  getPantryItems,
  addPantryItem,
  updatePantryItem,
  deletePantryItem,
} from "./pantry.service.js";
import { sendSuccess } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
import type { AddPantryItemInput, UpdatePantryItemInput } from "./pantry.schema.js";

// ---------------------------------------------------------------------------
// GET /api/pantry
// Returns all pantry items for the authenticated user.
// Used to populate the pantry management screen and the dropdown on the spin filter UI.
// ---------------------------------------------------------------------------
export const getPantry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const items = await getPantryItems(req.user!.id);
    sendSuccess({ res, data: { pantry_items: items } });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/pantry
// Adds a new ingredient to the user's pantry.
// Returns the created item so the frontend can add it to the list immediately without a full refetch.
// ---------------------------------------------------------------------------
export const addItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as AddPantryItemInput;
    const item = await addPantryItem(req.user!.id, input);
    sendSuccess({
      res,
      statusCode: 201,
      message: `"${item.name}" added to your pantry.`,
      data: { item },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/pantry/:id
// Updates the name of a pantry item.
// Returns the updated item.
// ---------------------------------------------------------------------------
export const updateItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const itemId = parseInt(req.params.id as string, 10);

    if (isNaN(itemId)) {
      throw new AppError("Invalid pantry item ID", 400, "INVALID_ID");
    }

    const input = req.body as UpdatePantryItemInput;
    const item = await updatePantryItem(req.user!.id, itemId, input);
    sendSuccess({
      res,
      message: "Pantry item updated.",
      data: { item },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/pantry/:id
// Returns only a success message. the frontend removes the item from the local list optimistically before this call completes.
// ---------------------------------------------------------------------------
export const deleteItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const itemId = parseInt(req.params.id as string, 10);

    if (isNaN(itemId)) {
      throw new AppError("Invalid pantry item ID", 400, "INVALID_ID");
    }

    await deletePantryItem(req.user!.id, itemId);
    sendSuccess({ res, message: "Pantry item removed." });
  } catch (err) {
    next(err);
  }
};