// One-time script to pull food data from USDA FoodData Central API and insert into MongoDB food_items collection.
// Usage: npx tsx scripts/usda-import.ts
//
// How it works.
// 1. defined a list of food names to search for.
// 2. For each name, the script queries the USDA API.
// 3. It maps the USDA response to our food_items schema.
// 4. It inserts into MongoDB, skipping duplicates.

import "dotenv/config"; // must be first
import mongoose from "mongoose";
import axios from "axios";
import { env } from "../config/env.js";
import { FoodItem } from "../models/food.model.js";

const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const REGION = "America"; // change when importing for other regions

const FOODS_TO_IMPORT = [
  {
    searchTerm: "grilled salmon fillet",
    mealTypes: ["lunch", "dinner"],
    tags: ["high-protein", "healthy", "low-carb"],
  },
  {
    searchTerm: "chicken caesar salad",
    mealTypes: ["lunch"],
    tags: ["high-protein", "light", "salad"],
  },
  {
    searchTerm: "beef taco",
    mealTypes: ["lunch", "dinner", "snack"],
    tags: ["high-protein", "popular", "filling"],
  },
  {
    searchTerm: "clam chowder soup",
    mealTypes: ["lunch", "dinner"],
    tags: ["soups", "creamy", "filling"],
  },
  {
    searchTerm: "pancakes with maple syrup",
    mealTypes: ["breakfast", "brunch"],
    tags: ["high-carb", "sweet", "popular"],
  },
  {
    searchTerm: "scrambled eggs with toast",
    mealTypes: ["breakfast", "brunch"],
    tags: ["high-protein", "light", "popular"],
  },
];

// ---------------------------------------------------------------------------
// USDA API types. minimal, only what we use
// ---------------------------------------------------------------------------
interface USDANutrient {
  nutrientId: number;
  nutrientName: string;
  value: number;
}

interface USDAFood {
  fdcId: number;
  description: string;
  foodNutrients: USDANutrient[];
}

interface USDASearchResponse {
  foods: USDAFood[];
}

// USDA nutrient IDs. these are stable across the API.
const NUTRIENT_IDS = {
  calories: 1008,
  protein: 1003,
  carbs: 1005,
  fat: 1004,
};

const getNutrientValue = (
  nutrients: USDANutrient[],
  nutrientId: number
): number => {
  const match = nutrients.find((n) => n.nutrientId === nutrientId);
  return match ? Math.round(match.value * 10) / 10 : 0;
};

// ---------------------------------------------------------------------------
// Search USDA for a food by name and return the best match
// ---------------------------------------------------------------------------
const searchUSDA = async (query: string): Promise<USDAFood | null> => {
  try {
    const response = await axios.get<USDASearchResponse>(
      `${USDA_BASE_URL}/foods/search`,
      {
        params: {
          query,
          dataType: "Survey (FNDDS)",
          pageSize: 1,
          api_key: env.USDA_API_KEY,
        },
      }
    );

    const foods = response.data.foods;

    if (!foods || foods.length === 0) {
      console.warn(`No USDA results found for. ${query}`);
      return null;
    }

    return foods[0];
  } catch (err: any) {
    console.error(
      `USDA API error for query. ${query}.`,
      err.response?.status ?? err.message
    );
    return null;
  }
};

// ---------------------------------------------------------------------------
// Map a USDA food result to our food_items schema
// ---------------------------------------------------------------------------
const mapToFoodItem = (
  usdaFood: USDAFood,
  searchConfig: (typeof FOODS_TO_IMPORT)[0]
) => {
  const calories = getNutrientValue(
    usdaFood.foodNutrients,
    NUTRIENT_IDS.calories
  );
  const protein = getNutrientValue(
    usdaFood.foodNutrients,
    NUTRIENT_IDS.protein
  );
  const carbs = getNutrientValue(usdaFood.foodNutrients, NUTRIENT_IDS.carbs);
  const fat = getNutrientValue(usdaFood.foodNutrients, NUTRIENT_IDS.fat);

  // Clean up USDA description which is often ALL CAPS with extra detail
  const cleanName = usdaFood.description
    .split(",")[0]
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  return {
    name: cleanName,
    regional_names: [],
    description:
      `${usdaFood.description}. Nutrition data sourced from USDA FoodData Central. ` +
      `FDC ID. ${usdaFood.fdcId}.`,
    tags: searchConfig.tags,
    meal_types: searchConfig.mealTypes,
    allergen_tags: [],  // USDA does not reliably provide allergen data. review manually.
    ingredients: [],  // TRACK. populate manually in Atlas after reviewing each USDA item
    region: REGION,
    image_path: `foods/${REGION.toLowerCase()}/${cleanName
      .toLowerCase()
      .replace(/\s+/g, "-")}.jpg`,
    calories_per_100g: calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    is_verified: false,  // marked unverified until manually reviewed in Atlas
    usda_ref: usdaFood.fdcId.toString(),
  };
};

// ---------------------------------------------------------------------------
// Main import runner
// ---------------------------------------------------------------------------
const runImport = async (): Promise<void> => {
  await mongoose.connect(env.MONGO_URI);

  console.log("MongoDB connected. Starting USDA import.");

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const foodConfig of FOODS_TO_IMPORT) {
    console.log(`Searching USDA for. ${foodConfig.searchTerm}`);

    const usdaFood = await searchUSDA(foodConfig.searchTerm);

    if (!usdaFood) {
      failed++;
      continue;
    }

    const mapped = mapToFoodItem(usdaFood, foodConfig);

    console.log(
      `  Matched. ${mapped.name} (calories. ${mapped.calories_per_100g} per 100g)`
    );

    try {
      await FoodItem.create(mapped);
      inserted++;
      console.log(`  Inserted. ${mapped.name}`);
    } catch (err: any) {
      if (err.code === 11000) {
        skipped++;
        console.log(`  Skipped. ${mapped.name} already exists.`);
      } else {
        failed++;
        console.error(`  Failed to insert. ${mapped.name}.`, err.message);
      }
    }

    // Respect USDA rate limit. 1000 requests per hour on free tier.
    // 200ms between requests keeps us well within the limit.
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
  }

  console.log(
    `\nImport complete. inserted. ${inserted}. skipped. ${skipped}. failed. ${failed}`
  );
  console.log(
    "USDA imported items are marked is_verified: false. " +
    "Review each item in MongoDB Atlas and set is_verified: true after confirming accuracy."
  );

  await mongoose.disconnect();
};

runImport().catch(console.error);