import { pgPool } from "../../config/db.postgres.js";
import { AppError } from "../../shared/errors.js";
import type { AddPantryItemInput, UpdatePantryItemInput } from "./pantry.schema.js";

// Maximum number of pantry items per user. Enforced before every insert.
const PANTRY_LIMIT = 20;

// ---------------------------------------------------------------------------
// getPantryItems
// Returns all pantry items for a user ordered alphabetically.
// Alphabetical order makes the frontend dropdown easy to scan.
// ---------------------------------------------------------------------------
export const getPantryItems = async (userId: string) => {
  const result = await pgPool.query(
    `SELECT id, name, created_at
     FROM pantry_items
     WHERE user_id = $1
     ORDER BY name ASC`,
    [userId]
  );

  return result.rows;
};

// ---------------------------------------------------------------------------
// addPantryItem
// Adds a new ingredient to the user's pantry. Checks the 20-item limit before inserting.
// ON CONFLICT DO NOTHING handles the case where the user tries to add an ingredient they already have. returns the existing item silently.
// ---------------------------------------------------------------------------
export const addPantryItem = async (
  userId: string,
  input: AddPantryItemInput
) => {
  // Check current count before inserting
  const countResult = await pgPool.query(
    "SELECT COUNT(*) FROM pantry_items WHERE user_id = $1",
    [userId]
  );

  const currentCount = parseInt(countResult.rows[0].count, 10);

  if (currentCount >= PANTRY_LIMIT) {
    throw new AppError(
      `You can have a maximum of ${PANTRY_LIMIT} pantry items.`,
      400,
      "PANTRY_LIMIT_EXCEEDED"
    );
  }

  // RETURNING gives us the inserted or existing row.
  const result = await pgPool.query(
    `INSERT INTO pantry_items (user_id, name)
     VALUES ($1, $2)
     ON CONFLICT (user_id, name) DO NOTHING
     RETURNING id, name, created_at`,
    [userId, input.name]
  );

  // If nothing was returned, the item already existed.
  // Fetch and return the existing item.
  if (result.rows.length === 0) {
    const existing = await pgPool.query(
      "SELECT id, name, created_at FROM pantry_items WHERE user_id = $1 AND name = $2",
      [userId, input.name]
    );
    return existing.rows[0];
  }

  console.log(
    `[REMOVE LOG LATER] Pantry item added. user. ${userId}. item. ${input.name}`
  );

  return result.rows[0];
};

// ---------------------------------------------------------------------------
// updatePantryItem
// The WHERE clause includes user_id to prevent users from editing other users' pantry items by guessing IDs.
// ---------------------------------------------------------------------------
export const updatePantryItem = async (
  userId: string,
  itemId: number,
  input: UpdatePantryItemInput
) => {
  // Check if the new name already exists for this user to prevent duplicates
  const duplicateCheck = await pgPool.query(
    "SELECT id FROM pantry_items WHERE user_id = $1 AND name = $2 AND id != $3",
    [userId, input.name, itemId]
  );

  if (duplicateCheck.rows.length > 0) {
    throw new AppError(
      `"${input.name}" is already in your pantry.`,
      409,
      "PANTRY_DUPLICATE"
    );
  }

  const result = await pgPool.query(
    `UPDATE pantry_items
     SET name = $1
     WHERE id = $2 AND user_id = $3
     RETURNING id, name, created_at`,
    [input.name, itemId, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError("Pantry item not found", 404, "PANTRY_ITEM_NOT_FOUND");
  }

  return result.rows[0];
};

// ---------------------------------------------------------------------------
// deletePantryItem
// The WHERE clause includes user_id for ownership verification.
// rowCount of 0 means the item did not exist or belonged to another user.
// ---------------------------------------------------------------------------
export const deletePantryItem = async (
  userId: string,
  itemId: number
): Promise<void> => {
  const result = await pgPool.query(
    "DELETE FROM pantry_items WHERE id = $1 AND user_id = $2",
    [itemId, userId]
  );

  if (result.rowCount === 0) {
    throw new AppError("Pantry item not found", 404, "PANTRY_ITEM_NOT_FOUND");
  }

  console.log(
    `[REMOVE LOG LATER] Pantry item deleted. user. ${userId}. itemId. ${itemId}`
  );
};

// ---------------------------------------------------------------------------
// getUserPantryNames
// Returns only the ingredient names as a plain string array.
// Used by the spin service to pass pantry items to the food matching logic.
// A separate function keeps the spin service decoupled from the pantry table structure. And will be called on every spin request
// ---------------------------------------------------------------------------
export const getUserPantryNames = async (userId: string): Promise<string[]> => {
  const result = await pgPool.query(
    "SELECT name FROM pantry_items WHERE user_id = $1",
    [userId]
  );

  return result.rows.map((r: { name: string }) => r.name);
};