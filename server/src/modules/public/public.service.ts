import { FoodItem } from "../../models/food.model.js";
import { redis } from "../../config/db.redis.js";
import { buildImageUrl } from "../../shared/food.helpers.js";
import logger from "../../config/logger.js";

// ---------------------------------------------------------------------------
// Public, read-only view of the verified food catalogue. Powers the SEO
// food pages on the website (/foods/<region>/<slug>). Nothing here is user
// specific and nothing here writes anywhere. Only fields that are safe to
// publish are returned, internal fields like usda_ref, is_verified,
// image_path and the Mongo _id never leave this function.
// ---------------------------------------------------------------------------

export interface PublicFood {
  slug: string;
  name: string;
  regional_names: string[];
  description: string;
  region: string;
  region_slug: string;
  image_url: string;
  tags: string[];
  meal_types: string[];
  allergen_tags: string[];
  ingredients: string[];
  calories_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_sizes: { label: string; grams: number }[];
  updated_at: string;
}

// Bump the version suffix whenever the PublicFood shape changes so an old
// cached payload is never served in the new shape.
const CACHE_KEY = "public:foods:v1";
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour, catalogue changes rarely

// "Ọ̀fadà Rice & Stew" -> "ofada-rice-stew". Strips accents so URLs stay
// plain ASCII, which every crawler and every chat app link parser handles.
export const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getPublicFoods = async (): Promise<PublicFood[]> => {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached) as PublicFood[];
  } catch (err) {
    // Cache failure never blocks the response, fall through to Mongo.
    logger.error("Public foods cache read failed.", err);
  }

  // Sorted by _id (creation order) so slug collision suffixes below are
  // stable: the food that existed first always keeps the clean slug, a
  // later food with a clashing name is the one that gets a suffix.
  const foods = await FoodItem.find({ is_verified: true })
    .select(
      "name regional_names description region image_path tags meal_types allergen_tags ingredients calories_per_100g protein_g carbs_g fat_g serving_sizes updatedAt",
    )
    .sort({ _id: 1 })
    .lean();

  const usedSlugs = new Set<string>();

  const publicFoods: PublicFood[] = foods.map((food) => {
    const regionSlug = slugify(food.region);
    let slug = slugify(food.name) || String(food._id).slice(-8);
    const key = () => `${regionSlug}/${slug}`;
    if (usedSlugs.has(key())) slug = `${slug}-${String(food._id).slice(-6)}`;
    usedSlugs.add(key());

    return {
      slug,
      name: food.name,
      regional_names: food.regional_names ?? [],
      description: food.description,
      region: food.region,
      region_slug: regionSlug,
      image_url: buildImageUrl(food.image_path),
      tags: food.tags ?? [],
      meal_types: food.meal_types ?? [],
      allergen_tags: food.allergen_tags ?? [],
      ingredients: food.ingredients ?? [],
      calories_per_100g: food.calories_per_100g,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      serving_sizes: (food.serving_sizes ?? []).map((s) => ({ label: s.label, grams: s.grams })),
      updated_at: new Date(food.updatedAt ?? Date.now()).toISOString(),
    };
  });

  publicFoods.sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name));

  try {
    await redis.setEx(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(publicFoods));
  } catch (err) {
    logger.error("Public foods cache write failed.", err);
  }

  return publicFoods;
};
