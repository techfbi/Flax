import type { Request, Response, NextFunction } from "express";
import { FoodItem } from "../../models/food.model.js";
import { pgPool } from "../../config/db.postgres.js";
import { withImageUrl } from "../../shared/food.helpers.js";
import { AppError } from "../../shared/errors.js";
import { sendSuccess } from "../../shared/response.js";
import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// GET /api/foods/search?q=jollof&limit=10
//
// Searches the food catalogue scoped to the authenticated user's region.
// Matching happens on name and regional_names using a case-insensitive. partial regex so typing "joll" returns "Jollof Rice".
// ---------------------------------------------------------------------------
export const searchFoods = async ( req: Request, res: Response, next: NextFunction ): Promise<void> => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const limitRaw = parseInt(req.query.limit as string, 10);

    // Clamp limit between 1 and 20. default to 10 if not provided or invalid.
    const limit = isNaN(limitRaw) ? 10 : Math.min(Math.max(limitRaw, 1), 20);

    if (!q || q.length < 2) {
      throw new AppError(
        "Search query must be at least 2 characters.",
        400,
        "QUERY_TOO_SHORT"
      );
    }

    // Fetch the user's region from their health profile.
    const profileResult = await pgPool.query(
      "SELECT region FROM health_profiles WHERE user_id = $1",
      [req.user!.id]
    );

    const region = profileResult.rows[0]?.region;

    if (!region) {
      throw new AppError(
        "Please complete your profile and set your region before searching meals.",
        400,
        "NO_REGION_SET"
      );
    }

    // The MongoDB query.
    // $options "i" makes the regex case-insensitive. $or means a match on either name or regional_names qualifies.
    // we are using regex search here for now, if at larger food catalogue size we can consider adding a full text index in MongoDB and switch to $text search for better performance and relevance ranking.
    const query: Record<string, unknown> = {
      region,
      is_verified: true,
      $or: [
        { name: { $regex: q, $options: "i" } },
        { regional_names: { $regex: q, $options: "i" } },
      ],
    };

    const foods = await FoodItem.find(query)
      .select("name regional_names description image_path meal_types tags allergen_tags calories_per_100g protein_g carbs_g fat_g")
      .limit(limit)
      .lean();

    // Attach full image URLs using the same helper the spin module uses
    // so image URL construction is consistent across the entire app.
    const results = foods.map((food) =>
      withImageUrl({
        ...food,
        _id: (food._id as mongoose.Types.ObjectId).toString(),
      })
    );

    sendSuccess({
      res,
      data: {
        results,
        count: results.length,
        query: q,
        region,
      },
    });
  } catch (err) {
    next(err);
  }
};